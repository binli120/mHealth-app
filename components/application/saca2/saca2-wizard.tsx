/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { splitWizardState } from "@/lib/phi-token/token"
import { PhiResumePrompt, PhiSaveExitDialog } from "@/components/application/phi-save-exit-dialog"
import { WizardLayout } from "@/components/application/wizard-layout"
import { Button } from "@/components/ui/button"
import { getStepPersonIndex, STEP_TITLES, validateStep } from "@/lib/masshealth/saca2/questions"
import {
  buildSaca2Snapshot,
  buildSaca2SaveKey,
  createInitialWizardState,
  getWizardSteps,
  nearestVisibleStep,
  normalizeRestoredSaca2State,
  normalizeSaca2State,
  saca2WizardReducer,
} from "@/lib/masshealth/saca2/wizard-state"
import { restorePhiDraftState } from "@/lib/phi-token/restore"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { Saca2StepForm } from "./saca2-step-form"

interface Saca2WizardProps {
  applicationId: string
  actingForPatientId?: string
}

interface PendingResume {
  resumeId: string
  hasServerKey: boolean
  serverState: Record<string, unknown>
}

const AUTOSAVE_DELAY_MS = 700
const FAILURE_BACKOFF_MS = 15_000

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function Saca2Wizard({ applicationId, actingForPatientId }: Saca2WizardProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(saca2WizardReducer, undefined, createInitialWizardState)
  const [hydrated, setHydrated] = useState(false)
  const [pendingResume, setPendingResume] = useState<PendingResume | null>(null)
  const [saveExitOpen, setSaveExitOpen] = useState(false)
  const [restoreError, setRestoreError] = useState(false)

  const stateRef = useRef(state)
  const backoffUntilRef = useRef(0)
  const lastSavedKeyRef = useRef<string | null>(null)
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true))

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const headers = useMemo(() => {
    const h: Record<string, string> = {}
    if (actingForPatientId) h["X-Acting-For-Patient"] = actingForPatientId
    return h
  }, [actingForPatientId])

  // ── Hydrate from the server draft (PHI-free) and the encrypted PHI blob ──
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      let draftState: unknown = null
      let resumeId: string | null = null
      let hasServerKey = false

      try {
        const response = await authenticatedFetch(`/api/applications/${encodeURIComponent(applicationId)}/draft`, {
          method: "GET",
          cache: "no-store",
          headers,
        })
        if (response.ok) {
          const payload = (await response.json()) as {
            draftState?: unknown
            record?: { phiDraftResumeId?: string | null; phiDraftKeyEnc?: string | null }
          }
          draftState = payload.draftState ?? null
          resumeId = payload.record?.phiDraftResumeId ?? null
          hasServerKey = Boolean(payload.record?.phiDraftKeyEnc)
        }
      } catch {
        // Fall through to a fresh form; autosave will create the draft.
      }

      let restored: Record<string, unknown> | null = null
      if (resumeId) {
        const base = toRecord(draftState)
        if (hasServerKey) {
          try {
            restored = await restorePhiDraftState({
              applicationId,
              resumeId,
              serverState: base,
              actingForPatientId,
            })
          } catch {
            restored = null
          }
        }
        if (!restored && !cancelled) {
          setPendingResume({ resumeId, hasServerKey, serverState: base })
        }
      }

      if (cancelled) return
      let normalized = restored ? normalizeRestoredSaca2State(restored) : normalizeSaca2State(draftState)
      if (restored && !normalized) {
        // Never drop a restored PHI blob silently: fall back to the resume prompt.
        setPendingResume({ resumeId: resumeId as string, hasServerKey, serverState: toRecord(draftState) })
        normalized = normalizeSaca2State(draftState)
      }
      if (normalized) {
        dispatch({ type: "hydrate", payload: normalized })
        stateRef.current = normalized
      }
      setHydrated(true)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [applicationId, actingForPatientId, headers])

  // ── Autosave the PHI-free snapshot ──
  const doSave = useCallback(async (): Promise<boolean> => {
    if (Date.now() < backoffUntilRef.current) return false

    // Read the latest state when this save STARTS so queued saves send the newest edits.
    const sentState = stateRef.current
    const sentKey = buildSaca2SaveKey(sentState)
    const markSavedIfCurrent = () => {
      if (buildSaca2SaveKey(stateRef.current) === sentKey) dispatch({ type: "mark_saved" })
    }
    if (sentKey === lastSavedKeyRef.current) {
      markSavedIfCurrent()
      return true
    }

    try {
      const { safeState } = splitWizardState(buildSaca2Snapshot(sentState))
      const response = await authenticatedFetch(`/api/applications/${encodeURIComponent(applicationId)}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ applicationType: "saca2", wizardState: safeState }),
      })
      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) {
          backoffUntilRef.current = Date.now() + FAILURE_BACKOFF_MS
        }
        return false
      }
      backoffUntilRef.current = 0
      lastSavedKeyRef.current = sentKey
      markSavedIfCurrent()
      return true
    } catch {
      backoffUntilRef.current = Date.now() + FAILURE_BACKOFF_MS
      return false
    }
  }, [applicationId, headers])

  // Chain saves so two PUTs never overlap or complete out of order.
  const saveDraftNow = useCallback((): Promise<boolean> => {
    const run = chainRef.current.then(doSave, doSave)
    chainRef.current = run.catch(() => false)
    return run
  }, [doSave])

  useEffect(() => {
    if (!hydrated || !state.dirty) return
    const timer = window.setTimeout(() => {
      void saveDraftNow()
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [hydrated, state, saveDraftNow])

  // ── Warn before leaving with PHI that has not been secured ──
  useEffect(() => {
    if (!state.phiDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [state.phiDirty])

  // ── Navigation ──
  const stepIds = useMemo(() => getWizardSteps(state.data, new Date()), [state.data])
  const effectiveStepId = stepIds.includes(state.currentStepId)
    ? state.currentStepId
    : nearestVisibleStep(stepIds, state.currentStepId)
  const currentIndex = Math.max(0, stepIds.indexOf(effectiveStepId))
  const isLastStep = currentIndex === stepIds.length - 1
  const personIndex = getStepPersonIndex(effectiveStepId)

  useEffect(() => {
    if (hydrated && effectiveStepId !== state.currentStepId) {
      dispatch({ type: "set_step", stepId: effectiveStepId })
    }
  }, [hydrated, effectiveStepId, state.currentStepId])

  const handleNext = useCallback(() => {
    const errors = validateStep(effectiveStepId, state.data, new Date())
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "set_errors", errors })
      return
    }
    dispatch({ type: "mark_complete", stepId: effectiveStepId })
    if (isLastStep) {
      setSaveExitOpen(true)
      return
    }
    dispatch({ type: "set_step", stepId: stepIds[currentIndex + 1] })
  }, [effectiveStepId, state.data, isLastStep, stepIds, currentIndex])

  const handleBack = useCallback(() => {
    if (currentIndex > 0) dispatch({ type: "set_step", stepId: stepIds[currentIndex - 1] })
  }, [currentIndex, stepIds])

  const onResumeRestored = useCallback((merged: Record<string, unknown>) => {
    const normalized = normalizeRestoredSaca2State(merged)
    if (!normalized) {
      setRestoreError(true)
      return
    }
    dispatch({ type: "hydrate", payload: normalized })
    setRestoreError(false)
    setPendingResume(null)
  }, [])

  const layoutSteps = stepIds.map((id, index) => ({
    id,
    title: STEP_TITLES[id],
    completed: state.completedSteps.includes(id),
    current: index === currentIndex,
  }))

  const exitHref = actingForPatientId
    ? `/social-worker/patients/${encodeURIComponent(actingForPatientId)}/applications`
    : "/customer/dashboard"

  if (!hydrated) {
    return <div data-testid="saca2-loading" className="p-6 text-sm text-muted-foreground">Loading your application…</div>
  }

  return (
    <div data-testid="saca2-wizard">
      <WizardLayout
        steps={layoutSteps}
        currentStep={currentIndex + 1}
        title={STEP_TITLES[effectiveStepId]}
        contentClassName="max-w-3xl"
        onSaveAndExit={() => setSaveExitOpen(true)}
      >
        <div className="space-y-6">
          {restoreError ? (
            <p role="alert" className="text-sm text-destructive">
              We couldn&apos;t restore your saved details. Try again or skip.
            </p>
          ) : null}
          {pendingResume ? (
            <PhiResumePrompt
              applicationId={applicationId}
              resumeId={pendingResume.resumeId}
              hasServerKey={pendingResume.hasServerKey}
              actingForPatientId={actingForPatientId}
              serverState={pendingResume.serverState}
              onRestored={onResumeRestored}
              onSkip={() => setPendingResume(null)}
            />
          ) : null}

          <Saca2StepForm
            stepId={effectiveStepId}
            answers={state.data}
            personIndex={personIndex}
            errors={state.errors}
            onChange={(path, value) => dispatch({ type: "set_answer", path, value })}
          />

          <div className="flex items-center justify-between gap-3">
            {currentIndex > 0 ? (
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setSaveExitOpen(true)}>
                Save &amp; Exit
              </Button>
              <Button type="button" onClick={handleNext}>
                {isLastStep ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </WizardLayout>

      <PhiSaveExitDialog
        open={saveExitOpen}
        applicationId={applicationId}
        wizardState={buildSaca2Snapshot(state)}
        actingForPatientId={actingForPatientId}
        onBeforeSecureSave={() => saveDraftNow()}
        onExit={() => {
          setSaveExitOpen(false)
          dispatch({ type: "mark_phi_secured" })
          router.push(exitHref)
        }}
        onCancel={() => setSaveExitOpen(false)}
      />
    </div>
  )
}
