/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { PhiResumePrompt, PhiSaveExitDialog } from "@/components/application/phi-save-exit-dialog"
import { WizardLayout } from "@/components/application/wizard-layout"
import { Button } from "@/components/ui/button"
import { getStepPersonIndex, STEP_TITLES, validateStep } from "@/lib/masshealth/saca2/questions"
import {
  buildSaca2Snapshot,
  createInitialWizardState,
  getWizardSteps,
  normalizeSaca2State,
  saca2WizardReducer,
} from "@/lib/masshealth/saca2/wizard-state"
import { restorePhiDraftState } from "@/lib/phi-token/restore"
import { splitWizardState } from "@/lib/phi-token/token"
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

  const stateRef = useRef(state)
  const backoffUntilRef = useRef(0)
  const lastSavedKeyRef = useRef<string | null>(null)

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
      const normalized = normalizeSaca2State(restored ?? draftState)
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
  const saveDraftNow = useCallback(async (): Promise<boolean> => {
    if (Date.now() < backoffUntilRef.current) return false

    const { safeState } = splitWizardState(buildSaca2Snapshot(stateRef.current))
    const comparable = { ...safeState } as Record<string, unknown>
    delete comparable.persistedAt
    const key = JSON.stringify(comparable)
    if (key === lastSavedKeyRef.current) {
      dispatch({ type: "mark_saved" })
      return true
    }

    try {
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
      lastSavedKeyRef.current = key
      dispatch({ type: "mark_saved" })
      return true
    } catch {
      backoffUntilRef.current = Date.now() + FAILURE_BACKOFF_MS
      return false
    }
  }, [applicationId, headers])

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
  const currentIndex = Math.max(0, stepIds.indexOf(state.currentStepId))
  const isLastStep = currentIndex === stepIds.length - 1
  const personIndex = getStepPersonIndex(state.currentStepId)

  const handleNext = useCallback(() => {
    const errors = validateStep(state.currentStepId, state.data, new Date())
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "set_errors", errors })
      return
    }
    dispatch({ type: "mark_complete", stepId: state.currentStepId })
    if (isLastStep) {
      setSaveExitOpen(true)
      return
    }
    dispatch({ type: "set_step", stepId: stepIds[currentIndex + 1] })
  }, [state.currentStepId, state.data, isLastStep, stepIds, currentIndex])

  const handleBack = useCallback(() => {
    if (currentIndex > 0) dispatch({ type: "set_step", stepId: stepIds[currentIndex - 1] })
  }, [currentIndex, stepIds])

  const onResumeRestored = useCallback((merged: Record<string, unknown>) => {
    const normalized = normalizeSaca2State(merged)
    if (normalized) dispatch({ type: "hydrate", payload: normalized })
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
        title={STEP_TITLES[state.currentStepId]}
        contentClassName="max-w-3xl"
        onSaveAndExit={() => setSaveExitOpen(true)}
      >
        <div className="space-y-6">
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
            stepId={state.currentStepId}
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
