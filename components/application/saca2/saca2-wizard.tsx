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
import { Saca2Download } from "./saca2-download"
import { Saca2SaveStatus, type Saca2SaveStatusValue } from "./saca2-save-status"
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
// Retrying the same request cannot succeed (or isn't the client's to fix): no backoff, and never blocks Save & Exit.
const FATAL_SAVE_STATUSES = new Set([400, 403, 409, 413, 422])

const PROGRESS_NOT_SAVED_WARNING =
  "Your answers are secured, but some progress (the programs you selected and which steps you have completed) could not be saved to your account and may revert when you resume. Try again later if you can."

type SaveResult = "saved" | "retryable" | "fatal"

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function Saca2Wizard({ applicationId, actingForPatientId }: Saca2WizardProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(saca2WizardReducer, undefined, createInitialWizardState)
  const [hydrated, setHydrated] = useState(false)
  const [pendingResume, setPendingResume] = useState<PendingResume | null>(null)
  const [saveExitOpen, setSaveExitOpen] = useState(false)
  // Finish on the last step shows the completion panel; the wizard state stays mounted behind it.
  const [showComplete, setShowComplete] = useState(false)
  const [restoreError, setRestoreError] = useState(false)
  const [saveStatus, setSaveStatus] = useState<Saca2SaveStatusValue>("idle")

  const stateRef = useRef(state)
  const backoffUntilRef = useRef(0)
  const lastSavedKeyRef = useRef<string | null>(null)
  const chainRef = useRef<Promise<SaveResult>>(Promise.resolve("saved"))
  const saveSeqRef = useRef(0)

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
  // Only the most recently STARTED save may set the final status, so a slow older save can't overwrite it.
  const doSave = useCallback(
    async (options?: { force?: boolean }): Promise<SaveResult> => {
      const force = options?.force === true
      // Autosave pauses during the backoff; a forced save (Retry, Save & Exit) never waits for it.
      if (!force && Date.now() < backoffUntilRef.current) return "retryable"

      // Read the latest state when this save STARTS so queued saves send the newest edits.
      const sentState = stateRef.current
      const sentKey = buildSaca2SaveKey(sentState)
      const seq = ++saveSeqRef.current
      const finish = (status: Saca2SaveStatusValue) => {
        if (saveSeqRef.current === seq) setSaveStatus(status)
      }
      // "Saved" only if no newer edit has changed the snapshot since this save started.
      const markSavedIfCurrent = () => {
        if (buildSaca2SaveKey(stateRef.current) === sentKey) {
          dispatch({ type: "mark_saved" })
          finish("saved")
        } else {
          finish("idle")
        }
      }
      if (sentKey === lastSavedKeyRef.current) {
        markSavedIfCurrent()
        return "saved"
      }

      setSaveStatus("saving")
      try {
        const { safeState } = splitWizardState(buildSaca2Snapshot(sentState))
        const response = await authenticatedFetch(`/api/applications/${encodeURIComponent(applicationId)}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ applicationType: "saca2", wizardState: safeState }),
        })
        if (!response.ok) {
          finish("error")
          if (FATAL_SAVE_STATUSES.has(response.status)) return "fatal"
          // 429, 5xx and anything else unexpected: pause autosave (a forced save ignores this).
          backoffUntilRef.current = Date.now() + FAILURE_BACKOFF_MS
          return "retryable"
        }
        backoffUntilRef.current = 0
        lastSavedKeyRef.current = sentKey
        markSavedIfCurrent()
        return "saved"
      } catch {
        backoffUntilRef.current = Date.now() + FAILURE_BACKOFF_MS
        finish("error")
        return "retryable"
      }
    },
    [applicationId, headers],
  )

  // Chain saves so two PUTs never overlap or complete out of order (forced saves included).
  const saveDraftNow = useCallback(
    (options?: { force?: boolean }): Promise<SaveResult> => {
      const run = chainRef.current.then(() => doSave(options), () => doSave(options))
      chainRef.current = run.catch((): SaveResult => "retryable")
      return run
    },
    [doSave],
  )

  const handleRetrySave = useCallback(() => {
    void saveDraftNow({ force: true })
  }, [saveDraftNow])

  // Save & Exit: a non-retryable 4xx must not trap the user, but the encrypted blob holds only the PHI
  // fields. Programs, signer, current step and completed steps live in the server draft, so warn.
  const handleBeforeSecureSave = useCallback(async () => {
    const result = await saveDraftNow({ force: true })
    if (result === "retryable") return { ok: false }
    if (result === "fatal") return { ok: true, warning: PROGRESS_NOT_SAVED_WARNING }
    return true
  }, [saveDraftNow])

  useEffect(() => {
    // Under the blocking resume prompt the state is the PHI-free server draft: saving it would
    // overwrite the saved progress marker with a lower one.
    if (!hydrated || !state.dirty || pendingResume) return
    const timer = window.setTimeout(() => {
      void saveDraftNow()
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [hydrated, state, pendingResume, saveDraftNow])

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
    // Wait out the resume prompt: steps that depend on PHI look hidden until it is restored or skipped.
    if (hydrated && !pendingResume && effectiveStepId !== state.currentStepId) {
      dispatch({ type: "set_step", stepId: effectiveStepId })
    }
  }, [hydrated, pendingResume, effectiveStepId, state.currentStepId])

  const handleNext = useCallback(() => {
    const errors = validateStep(effectiveStepId, state.data, new Date())
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "set_errors", errors })
      return
    }
    dispatch({ type: "mark_complete", stepId: effectiveStepId })
    if (isLastStep) {
      setShowComplete(true)
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
        // While a resume is unresolved, the header Save & Exit just leaves (nothing is unsaved and the encrypted
        // blob persists); it must not open the dialog over the prompt, and it must not fall back to the layout's link.
        onSaveAndExit={pendingResume ? () => router.push(exitHref) : () => setSaveExitOpen(true)}
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
              onSkip={() => {
                setRestoreError(false)
                setPendingResume(null)
              }}
            />
          ) : showComplete ? (
            <section
              data-testid="saca2-complete"
              className="space-y-4 rounded-lg border bg-card p-6 text-card-foreground"
              aria-labelledby="saca2-complete-title"
            >
              <h2 id="saca2-complete-title" className="text-lg font-semibold">
                Your answers are ready
              </h2>
              <p className="text-sm text-muted-foreground">
                Download the filled SACA-2 to print, sign, and send in. You can also save your progress and finish later.
              </p>
              <Saca2Download
                applicationId={applicationId}
                wizardState={buildSaca2Snapshot(state)}
                actingForPatientId={actingForPatientId}
              />
              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setShowComplete(false)}>
                  Back to editing
                </Button>
                <Button type="button" variant="outline" onClick={() => setSaveExitOpen(true)}>
                  Save &amp; Exit
                </Button>
              </div>
            </section>
          ) : (
            <>
              <Saca2StepForm
                stepId={effectiveStepId}
                answers={state.data}
                personIndex={personIndex}
                errors={state.errors}
                onChange={(path, value) => dispatch({ type: "set_answer", path, value })}
              />

              <Saca2SaveStatus status={saveStatus} phiDirty={state.phiDirty} onRetry={handleRetrySave} />

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
            </>
          )}
        </div>
      </WizardLayout>

      <PhiSaveExitDialog
        open={saveExitOpen}
        applicationId={applicationId}
        wizardState={buildSaca2Snapshot(state)}
        actingForPatientId={actingForPatientId}
        onBeforeSecureSave={handleBeforeSecureSave}
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
