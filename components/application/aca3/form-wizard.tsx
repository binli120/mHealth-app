/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { WizardLayout } from "@/components/application/wizard-layout"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import {
  ACA_PDF_VIEW_ENDPOINT,
  STEP_METADATA,
} from "@/lib/constant"
import { cn } from "@/lib/utils"
import { hasFirstAndLastName } from "@/lib/utils/person-name"
import { formatCurrency, formatPhoneNumber, formatSsn, parseCurrency } from "@/lib/utils/input-format"
import {
  buildDependentsListValue,
  computeAgeFromDob,
  countDependentsFromRows,
  formatUsDate,
  getExclusiveCheckboxOptions,
  isFilled,
  normalizeDateInput,
  normalizeNumberInput,
  parseDate,
  parseDependentsListValue,
  splitFullName,
  splitSpouseNameDobValue,
  toAnnualAmount,
  toBooleanYesNo,
  toMonthlyIncome,
  validateDobBounds,
} from "@/lib/utils/aca3-form"
import { evaluateConditionalRule, useConditional } from "@/hooks/use-conditional"
import { useField } from "@/hooks/use-field"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { buildPhiToken, splitWizardState } from "@/lib/phi-token/token"
import { PHI_DATA_KEYS } from "@/lib/phi-token/phi-fields"
import { restorePhiDraftState } from "@/lib/phi-token/restore"
import { PhiTokenExportDialog } from "@/components/application/phi-token-manager"
import { PhiSaveExitDialog, PhiResumePrompt } from "@/components/application/phi-save-exit-dialog"
import type { PhiToken } from "@/lib/phi-token/token"
import {
  createApplication,
  DEFAULT_APPLICATION_ID,
  setActiveApplication,
  setApplicationWizardState,
} from "@/lib/redux/features/application-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import type {
  AddressGroupFieldProps,
  AddressValidationResponse,
  DependentEntry,
  FieldRendererProps,
  FieldValue,
  FormContextValue,
  FormRecord,
  PersonState,
  StepContentProps,
  ValidationParams,
  WizardAction,
  WizardData,
  WizardState,
} from "./types"
import {
  clampPersonCount,
  createInitialData,
  createInitialState,
  formReducer,
  getFormCacheKey,
  makeDefaultPersonState,
  normalizeScalarFieldValue,
  seedFieldDefaults,
} from "./wizard-reducer"
import { mapWizardToAnalysisWorkflowData } from "./wizard-mappings"
import {
  FormContext,
  useFormContext,
  normalizeHydratedState,
  buildPersistedStateSnapshot,
  buildSafeServerSnapshot,
  choosePreferredHydratedRaw,
  hasMeaningfulPhiData,
  mergePhiDataFromRaw,
  toHydrationRecord,
  getRepeatableRowDefault,
  getActiveSubFields,
} from "./form-wizard-context"
import {
  AddressGroupField,
  FieldRenderer,
  isAddressCoreField,
  requiresFullNameFormat,
} from "./form-wizard-field-renderer"
import {
  validateStepWithWizardRules,
  useStepValidation,
} from "./form-wizard-validation"
import {
  Step1ProgramSelection,
  Step2PrimaryApplicant,
  Step3HouseholdMembers,
  PersonStepTabs,
} from "./form-wizard-steps"
import { ReviewPdfStep } from "./form-wizard-review-step"
import { sleep, ValidateAndSubmitStep } from "./form-wizard-submit-step"

export { validateStepWithWizardRules } from "./form-wizard-validation"

const PDF_GENERATION_TIMEOUT_MS = 120_000

function clampWizardProgressToFirstIncomplete(state: WizardState): WizardState {
  for (let step = 1; step < state.currentStep; step += 1) {
    if (Object.keys(validateStepWithWizardRules(step, state.data)).length > 0) {
      return {
        ...state,
        currentStep: step,
        completedSteps: state.completedSteps.filter((completedStep) => completedStep < step),
      }
    }
  }

  return state
}

function FormProvider({
  children,
  applicationId,
  actingForPatientId,
  prefillFormData,
}: {
  children: ReactNode
  applicationId?: string
  /** When set (social worker acting for patient), all API calls include X-Acting-For-Patient header */
  actingForPatientId?: string
  prefillFormData?: Partial<import("@/lib/redux/features/application-slice").ApplicationFormData>
}) {
  const [state, dispatch] = useReducer(formReducer, undefined, createInitialState)
  const [isHydratedReady, setIsHydratedReady] = useState(false)
  const prefillAppliedRef = useRef(false)
  const [hydratedApplicationIdState, setHydratedApplicationIdState] = useState<string | null>(null)
  const reduxDispatch = useAppDispatch()
  const activeApplicationId = useAppSelector((rootState) => rootState.application.activeApplicationId)
  const resolvedApplicationId = applicationId ?? activeApplicationId ?? DEFAULT_APPLICATION_ID
  const applicationRecord = useAppSelector(
    (rootState) => rootState.application.applicationsById[resolvedApplicationId],
  )
  const hydratedRef = useRef(false)
  const hydratedApplicationRef = useRef<string | null>(null)
  const skipNextPersistRef = useRef(false)
  const saveTimeoutRef = useRef<number | null>(null)
  const saveFailureBackoffUntilRef = useRef(0)

  // ── PHI token export ──────────────────────────────────────────────────────
  const [pendingPhiToken, setPendingPhiToken] = useState<PhiToken | null>(null)

  // ── PHI resume prompt ─────────────────────────────────────────────────────
  const [pendingPhiResumeId, setPendingPhiResumeId] = useState<string | null>(null)
  const [pendingPhiHasServerKey, setPendingPhiHasServerKey] = useState(false)
  const [serverStateForResume, setServerStateForResume] = useState<Record<string, unknown> | null>(null)

  const dismissPhiResume = useCallback(() => {
    setPendingPhiResumeId(null)
    setPendingPhiHasServerKey(false)
    setServerStateForResume(null)
  }, [])

  const onPhiRestored = useCallback(
    (mergedState: Record<string, unknown>) => {
      // Extract only the PHI keys from the decrypted blob and merge them into
      // the current form state, which may have newer step/completedSteps data
      // than the server-side snapshot used inside PhiResumePrompt.
      const restoredData = (mergedState.data ?? {}) as Record<string, unknown>
      const phiData: Record<string, unknown> = {}
      for (const key of ["contact", "preApp", "persons"] as const) {
        if (key in restoredData) phiData[key] = restoredData[key]
      }
      const mergedWithCurrent = {
        ...(state as unknown as Record<string, unknown>),
        data: { ...(state.data as unknown as Record<string, unknown>), ...phiData },
      }
      const normalized = normalizeHydratedState(mergedWithCurrent)
      if (normalized) {
        dispatch({ type: "hydrate", payload: normalized })
      }
      setPendingPhiResumeId(null)
      setPendingPhiHasServerKey(false)
      setServerStateForResume(null)
    },
    [dispatch, state],
  )

  const exportPhiToken = useCallback(async (): Promise<boolean> => {
    try {
      const full = buildPersistedStateSnapshot(state)
      const { phiPayload } = splitWizardState(full)
      const token = await buildPhiToken(resolvedApplicationId, phiPayload)
      setPendingPhiToken(token)
      return true
    } catch {
      return false
    }
  }, [state, resolvedApplicationId])

  // ── Income verification: API-backed flag ──────────────────────────────────
  // Fetched from the income verification case; never inferred from form fields.
  const [apiIncomeVerified, setApiIncomeVerified] = useState(false)

  useEffect(() => {
    if (!resolvedApplicationId || resolvedApplicationId === DEFAULT_APPLICATION_ID) return

    let cancelled = false

    authenticatedFetch(`/api/masshealth/income-verification/${resolvedApplicationId}`)
      .then(async (resp) => {
        if (cancelled || !resp.ok) return
        const data = (await resp.json()) as { incomeVerified?: boolean }
        if (!cancelled) setApiIncomeVerified(Boolean(data.incomeVerified))
      })
      .catch(() => { /* non-fatal — flag stays false */ })

    return () => { cancelled = true }
  }, [resolvedApplicationId])

  useEffect(() => {
    if (!applicationRecord) {
      reduxDispatch(
        createApplication({
          applicationId: resolvedApplicationId,
          setActive: true,
        }),
      )
      return
    }

    if (activeApplicationId !== resolvedApplicationId) {
      reduxDispatch(setActiveApplication(resolvedApplicationId))
    }
  }, [
    activeApplicationId,
    applicationRecord,
    reduxDispatch,
    resolvedApplicationId,
  ])

  const saveDraftNow = useCallback(
    async (overrideState?: WizardState) => {
      if (Date.now() < saveFailureBackoffUntilRef.current) {
        return false
      }

      const sourceState = overrideState ?? state
      // Full snapshot goes to localStorage; PHI-free snapshot goes to the server.
      const safeServerState = buildSafeServerSnapshot(sourceState)

      try {
        const putHeaders: Record<string, string> = { "Content-Type": "application/json" }
        if (actingForPatientId) putHeaders["X-Acting-For-Patient"] = actingForPatientId
        const response = await authenticatedFetch(
          `/api/applications/${encodeURIComponent(resolvedApplicationId)}/draft`,
          {
            method: "PUT",
            headers: putHeaders,
            body: JSON.stringify({
              wizardState: safeServerState,
              applicationType:
                typeof sourceState.data.contact.application_type === "string"
                  ? sourceState.data.contact.application_type
                  : undefined,
            }),
          },
        )

        if (!response.ok) {
          if (response.status >= 500 || response.status === 429) {
            saveFailureBackoffUntilRef.current = Date.now() + 15_000
          }
          return false
        }

        saveFailureBackoffUntilRef.current = 0
        return response.ok
      } catch {
        saveFailureBackoffUntilRef.current = Date.now() + 15_000
        return false
      }
    },
    [resolvedApplicationId, state, actingForPatientId],
  )

  useEffect(() => {
    if (hydratedApplicationRef.current === resolvedApplicationId && hydratedRef.current) {
      return
    }

    hydratedApplicationRef.current = resolvedApplicationId
    hydratedRef.current = false
    let cancelled = false
    const applyHydratedState = (nextState: WizardState) => {
      if (cancelled) {
        return
      }

      skipNextPersistRef.current = true
      dispatch({ type: "hydrate", payload: nextState })
      hydratedRef.current = true
      setIsHydratedReady(true)
      setHydratedApplicationIdState(resolvedApplicationId)
    }

    const hydrateFromServerThenCache = async () => {
      setPendingPhiResumeId(null)
      setPendingPhiHasServerKey(false)
      setServerStateForResume(null)

      const cacheKey = getFormCacheKey(resolvedApplicationId)
      let localRaw: unknown = null

      try {
        const raw = window.localStorage.getItem(cacheKey)
        localRaw = raw ? JSON.parse(raw) as unknown : null
      } catch {
        localRaw = null
      }

      const fromReduxRaw = applicationRecord?.aca3Wizard ?? null

      // Always fetch the server draft to check for a pending PHI resume blob,
      // even when local/redux state exists. Local cache only holds non-PHI fields
      // (PHI is stripped before saving), so we must prompt the user to restore
      // their PHI from the encrypted blob regardless of cache presence.
      let serverRaw: unknown = null
      let serverPhiResumeId: string | null = null
      let serverPhiHasKey = false
      try {
        const getHeaders: Record<string, string> = {}
        if (actingForPatientId) getHeaders["X-Acting-For-Patient"] = actingForPatientId
        const response = await authenticatedFetch(
          `/api/applications/${encodeURIComponent(resolvedApplicationId)}/draft`,
          {
            method: "GET",
            cache: "no-store",
            headers: getHeaders,
          },
        )

        if (response.ok) {
          const payload = (await response.json()) as {
            record?: { phiDraftResumeId?: string | null; phiDraftKeyEnc?: string | null }
            draftState?: unknown
          }
          serverRaw = payload.draftState ?? null

          serverPhiResumeId = payload.record?.phiDraftResumeId ?? null
          serverPhiHasKey = Boolean(payload.record?.phiDraftKeyEnc)
        }
      } catch {
        serverRaw = null
      }

      const hasServerDraft = Boolean(normalizeHydratedState(serverRaw))
      // Include server draft in the timestamp-based comparison so that fresher
      // local/Redux data (e.g. just saved by the intake chat) wins over a stale
      // server draft rather than always deferring to the server.
      const hydrationCandidates: Array<{ source: "local" | "server" | "redux"; raw: unknown }> = [
        { source: "local", raw: localRaw },
        { source: "redux", raw: fromReduxRaw },
      ]
      if (hasServerDraft) {
        hydrationCandidates.push({ source: "server", raw: serverRaw })
      }
      let preferredRaw = choosePreferredHydratedRaw(hydrationCandidates)

      const localPhiSource = [localRaw, fromReduxRaw].find(hasMeaningfulPhiData)
      if (!hasMeaningfulPhiData(preferredRaw) && localPhiSource) {
        preferredRaw = mergePhiDataFromRaw(preferredRaw, localPhiSource)
      }

      if (serverPhiResumeId && !hasMeaningfulPhiData(preferredRaw)) {
        const resumeBaseState = toHydrationRecord(preferredRaw ?? serverRaw)

        if (serverPhiHasKey) {
          try {
            preferredRaw = await restorePhiDraftState({
              applicationId: resolvedApplicationId,
              resumeId: serverPhiResumeId,
              serverState: resumeBaseState,
              actingForPatientId,
            })
          } catch {
            if (!cancelled) {
              setPendingPhiResumeId(serverPhiResumeId)
              setPendingPhiHasServerKey(serverPhiHasKey)
              setServerStateForResume(resumeBaseState)
            }
          }
        } else if (!cancelled) {
          setPendingPhiResumeId(serverPhiResumeId)
          setPendingPhiHasServerKey(false)
          setServerStateForResume(resumeBaseState)
        }
      }

      const normalized = normalizeHydratedState(preferredRaw)
      applyHydratedState(clampWizardProgressToFirstIncomplete(normalized ?? createInitialState()))
    }

    void hydrateFromServerThenCache()

    return () => {
      cancelled = true
    }
  }, [applicationRecord?.aca3Wizard, resolvedApplicationId, actingForPatientId])

  // Apply prefill data once after hydration completes.
  // Maps ApplicationFormData keys → wizard contact field IDs.
  useEffect(() => {
    if (!isHydratedReady || !prefillFormData || prefillAppliedRef.current) return
    prefillAppliedRef.current = true

    const set = (fieldId: string, value: string) => {
      if (!value) return
      if (isFilled(state.data.contact[fieldId])) return
      dispatch({ type: "set_root_field", payload: { scope: "contact", fieldId, value } })
    }

    const { firstName, lastName, dob, email, phone, otherPhone, address, apartment, city, state: stateCode, zip, county, preferredSpokenLanguage, preferredWrittenLanguage, citizenship } = prefillFormData

    const fullName = [firstName, lastName].filter(Boolean).join(" ")
    set("p1_name", fullName)
    set("p1_dob", dob ?? "")
    set("p1_email", email ?? "")
    set("p1_phone", phone ?? "")
    set("p1_other_phone", otherPhone ?? "")
    set("p1_home_street", address ?? "")
    set("p1_home_apt", apartment ?? "")
    set("p1_home_city", city ?? "")
    set("p1_home_state", stateCode ?? "")
    set("p1_home_zip", zip ?? "")
    set("p1_home_county", county ?? "")
    set("p1_language_spoken", preferredSpokenLanguage ?? "")
    set("p1_language_written", preferredWrittenLanguage ?? "")

    // Map citizenship status → person 0 coverage.us_citizen ("Yes"/"No")
    if (citizenship) {
      const usCitizen = citizenship === "citizen" ? "Yes" : "No"
      if (!isFilled(state.data.persons[0]?.coverage.us_citizen)) {
        dispatch({ type: "set_person_field", payload: { personIndex: 0, section: "coverage", fieldId: "us_citizen", value: usCitizen } })
      }
    }
  }, [isHydratedReady, prefillFormData, state.data.contact, state.data.persons])

  useEffect(() => {
    if (!hydratedRef.current) {
      return
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }

    const persistedState = buildPersistedStateSnapshot(state)
    const cacheKey = getFormCacheKey(resolvedApplicationId)

    window.localStorage.setItem(
      cacheKey,
      JSON.stringify(persistedState),
    )

    reduxDispatch(
      setApplicationWizardState({
        applicationId: resolvedApplicationId,
        wizardState: persistedState as unknown as Record<string, unknown>,
      }),
    )

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void saveDraftNow(persistedState as unknown as WizardState)
    }, 700)

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [reduxDispatch, resolvedApplicationId, saveDraftNow, state])

  useEffect(() => {
    if (!state.dirty) {
      return
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [state.dirty])

  const value = useMemo<FormContextValue>(
    () => ({
      state,
      dispatch,
      applicationId: resolvedApplicationId,
      actingForPatientId,
      saveDraftNow,
      exportPhiToken,
      apiIncomeVerified,
      pendingPhiResumeId,
      pendingPhiHasServerKey,
      serverStateForResume,
      dismissPhiResume,
      onPhiRestored,
    }),
    [
      resolvedApplicationId,
      actingForPatientId,
      saveDraftNow,
      exportPhiToken,
      state,
      apiIncomeVerified,
      pendingPhiResumeId,
      pendingPhiHasServerKey,
      serverStateForResume,
      dismissPhiResume,
      onPhiRestored,
    ],
  )

  return (
    <FormContext.Provider value={value}>
      {isHydratedReady && hydratedApplicationIdState === resolvedApplicationId ? (
        children
      ) : (
        <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading saved application...
        </div>
      )}
      {pendingPhiToken && (
        <PhiTokenExportDialog
          token={pendingPhiToken}
          applicationId={resolvedApplicationId}
          onDismiss={() => setPendingPhiToken(null)}
        />
      )}
    </FormContext.Provider>
  )
}

function StepContent({
  step,
  reviewMode,
  onSetReviewMode,
  pdfUrl,
  pdfError,
  isGeneratingPdf,
  pdfStale,
  onGeneratePdf,
  onGoToStep,
  onValidateStep,
}: StepContentProps) {
  switch (step) {
    case 1:
      return <Step1ProgramSelection />
    case 2:
      return <Step2PrimaryApplicant />
    case 3:
      return <Step3HouseholdMembers />
    case 4:
      return <PersonStepTabs step={4} />
    case 5:
      return <PersonStepTabs step={5} />
    case 6:
      return <PersonStepTabs step={6} />
    case 7:
      return <PersonStepTabs step={7} />
    case 8:
      return (
        <ReviewPdfStep
          reviewMode={reviewMode}
          onSetReviewMode={onSetReviewMode}
          pdfUrl={pdfUrl}
          pdfError={pdfError}
          isGeneratingPdf={isGeneratingPdf}
          pdfStale={pdfStale}
          onGeneratePdf={onGeneratePdf}
          onGoToStep={onGoToStep}
          onValidate={onValidateStep}
        />
      )
    case 9:
      return <ValidateAndSubmitStep onBackToReview={() => onGoToStep(8)} onGoToStep={onGoToStep} />
    default:
      return null
  }
}

function FormWizardBody() {
  const {
    state, dispatch, applicationId, actingForPatientId, saveDraftNow, exportPhiToken, apiIncomeVerified,
    pendingPhiResumeId, pendingPhiHasServerKey, serverStateForResume, dismissPhiResume, onPhiRestored,
  } = useFormContext()
  const router = useRouter()
  const validateStep = useStepValidation()
  const firstErrorRef = useRef<HTMLDivElement | null>(null)
  const personCount = clampPersonCount(state.data.contact.p1_num_people || state.data.persons.length || 1)
  const currentStepActiveTab =
    state.currentStep >= 4 && state.currentStep <= 7 ? state.tabByStep[state.currentStep] ?? 0 : -1
  const [reviewMode, setReviewMode] = useState<"pdf" | "edit">("pdf")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [lastGeneratedDataHash, setLastGeneratedDataHash] = useState("")
  const [saveExitDialogOpen, setSaveExitDialogOpen] = useState(false)
  const pdfGenerationAbortRef = useRef<AbortController | null>(null)
  const autoGeneratedPdfHashRef = useRef<string | null>(null)
  const formDataHash = useMemo(() => JSON.stringify(state.data), [state.data])
  const pdfStale = Boolean(pdfUrl) && lastGeneratedDataHash !== formDataHash

  useEffect(() => {
    if (state.currentStep >= 4 && state.currentStep <= 7) {
      dispatch({
        type: "set_tab",
        payload: {
          step: state.currentStep,
          tab: 0,
        },
      })
    }
  }, [dispatch, state.currentStep])

  useEffect(() => {
    window.scrollTo?.({ top: 0, behavior: "smooth" })
  }, [state.currentStep, currentStepActiveTab])

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
      pdfGenerationAbortRef.current?.abort()
    }
  }, [pdfUrl])

  // Intercept browser back button when the form has unsaved changes.
  useEffect(() => {
    if (!state.dirty) return
    window.history.pushState(null, "", window.location.href)
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href)
      setSaveExitDialogOpen(true)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [state.dirty])

  const generatePdfPreview = useCallback(async () => {
    pdfGenerationAbortRef.current?.abort()
    const abortController = new AbortController()
    pdfGenerationAbortRef.current = abortController
    const timeoutId = window.setTimeout(() => {
      abortController.abort()
    }, PDF_GENERATION_TIMEOUT_MS)

    setIsGeneratingPdf(true)
    setPdfError(null)

    try {
      const response = await authenticatedFetch(ACA_PDF_VIEW_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId,
          workflowData: mapWizardToAnalysisWorkflowData(state.data),
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: unknown } | null
        const message = typeof body?.error === "string"
          ? body.error
          : `Failed to generate PDF preview (${response.status}).`
        throw new Error(message)
      }

      const blob = await response.blob()
      const nextUrl = URL.createObjectURL(blob)

      setPdfUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl)
        }
        return nextUrl
      })
      setLastGeneratedDataHash(formDataHash)
      return true
    } catch (error) {
      if (abortController.signal.aborted) {
        // Reset the hash so the auto-generate effect can retry on the next
        // render. This handles React Strict Mode's fake unmount/remount: the
        // cleanup effect aborts the first attempt, then the remount re-runs the
        // effect with a cleared hash so it generates again successfully.
        autoGeneratedPdfHashRef.current = null
      } else {
        setPdfError(error instanceof Error ? error.message : "Unable to generate PDF preview.")
      }
      return false
    } finally {
      window.clearTimeout(timeoutId)
      if (pdfGenerationAbortRef.current === abortController) {
        pdfGenerationAbortRef.current = null
      }
      setIsGeneratingPdf(false)
    }
  }, [applicationId, formDataHash, state.data])

  useEffect(() => {
    if (state.currentStep !== 8 || pdfUrl || isGeneratingPdf) {
      return
    }

    if (autoGeneratedPdfHashRef.current === formDataHash) {
      return
    }

    autoGeneratedPdfHashRef.current = formDataHash
    void generatePdfPreview()
  }, [formDataHash, generatePdfPreview, isGeneratingPdf, pdfUrl, state.currentStep])

  const steps = STEP_METADATA.map((stepMeta, index) => {
    const stepNumber = index + 1

    return {
      id: stepMeta.id,
      title: stepMeta.title,
      shortTitle: stepMeta.shortTitle,
      completed: state.completedSteps.includes(stepNumber),
      current: stepNumber === state.currentStep,
    }
  })

  const canGoBack = state.currentStep > 1
  const isLastStep = state.currentStep === 9
  const showGlobalNext = state.currentStep < 8

  const canProceedCurrentStep = useMemo(() => {
    if (state.currentStep === 1) {
      return true
    }

    if (state.currentStep >= 8) {
      return false
    }

    const stepErrors = validateStep(state.currentStep)
    return Object.keys(stepErrors).length === 0
  }, [state.currentStep, validateStep])

  const allPersonTabsComplete = useMemo(() => {
    if (state.currentStep < 4 || state.currentStep > 7) {
      return true
    }

    const stepErrors = validateStep(state.currentStep)

    return Array.from({ length: personCount }, (_, personIndex) => {
      const prefix = `step${state.currentStep}.person${personIndex + 1}.`
      return !Object.keys(stepErrors).some((key) => key.startsWith(prefix))
    }).every(Boolean)
  }, [personCount, state.currentStep, validateStep])

  const moveToStep = (nextStep: number) => {
    dispatch({ type: "set_step", payload: nextStep })
  }

  const moveToValidateStep = () => {
    dispatch({ type: "mark_step_complete", payload: 8 })
    moveToStep(9)
  }

  const handleNext = () => {
    if (state.currentStep === 1) {
      dispatch({ type: "mark_step_complete", payload: 1 })
      moveToStep(2)
      return
    }

    if (state.currentStep >= 8) {
      return
    }

    const errors = validateStep(state.currentStep)
    dispatch({ type: "set_errors", payload: errors })

    const firstErrorKey = Object.keys(errors)[0]
    if (firstErrorKey) {
      const target = document.querySelector<HTMLElement>(`[data-error-key=\"${firstErrorKey}\"]`)
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" })
        firstErrorRef.current = target as HTMLDivElement
      }
      return
    }

    dispatch({ type: "mark_step_complete", payload: state.currentStep })
    moveToStep(Math.min(9, state.currentStep + 1))
  }

  const handleSaveAndExit = useCallback(() => {
    setSaveExitDialogOpen(true)
  }, [])

  return (
    <>
    <WizardLayout
      steps={steps}
      currentStep={state.currentStep}
      title={STEP_METADATA[state.currentStep - 1]?.title ?? "ACA-03 Wizard"}
      contentClassName="max-w-5xl"
      onSaveAndExit={handleSaveAndExit}
    >
      <div className="space-y-6">
        {pendingPhiResumeId && serverStateForResume && (
          <PhiResumePrompt
            applicationId={applicationId}
            resumeId={pendingPhiResumeId}
            hasServerKey={pendingPhiHasServerKey}
            actingForPatientId={actingForPatientId}
            serverState={serverStateForResume}
            onRestored={onPhiRestored}
            onSkip={dismissPhiResume}
          />
        )}

        <StepContent
          step={state.currentStep}
          reviewMode={reviewMode}
          onSetReviewMode={setReviewMode}
          pdfUrl={pdfUrl}
          pdfError={pdfError}
          isGeneratingPdf={isGeneratingPdf}
          pdfStale={pdfStale}
          onGeneratePdf={generatePdfPreview}
          onGoToStep={moveToStep}
          onValidateStep={moveToValidateStep}
        />

        {state.currentStep >= 4 && state.currentStep <= 7 && !allPersonTabsComplete ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">
            Each person tab must be complete. For optional sections, explicitly mark them as skipped.
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {canGoBack ? (
            <Button type="button" variant="outline" onClick={() => moveToStep(Math.max(1, state.currentStep - 1))}>
              Back
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAndExit}
            >
              Save &amp; Exit
            </Button>

            {showGlobalNext && !isLastStep ? (
              <Button type="button" onClick={handleNext} disabled={!canProceedCurrentStep}>
                Next
              </Button>
            ) : null}
          </div>
        </div>

      </div>
    </WizardLayout>
    <PhiSaveExitDialog
      open={saveExitDialogOpen}
      applicationId={applicationId}
      wizardState={state}
      actingForPatientId={actingForPatientId}
      onBeforeSecureSave={() => saveDraftNow({ ...state, errors: {}, dirty: false })}
      onExit={() => {
        setSaveExitDialogOpen(false)
        dispatch({ type: "set_dirty", payload: false })
        router.push(
          actingForPatientId
            ? `/social-worker/patients/${encodeURIComponent(actingForPatientId)}/applications`
            : "/customer/dashboard",
        )
      }}
      onCancel={() => setSaveExitDialogOpen(false)}
    />
    </>
  )
}

export function FormWizard({
  applicationId,
  actingForPatientId,
  prefillFormData,
}: {
  applicationId?: string
  actingForPatientId?: string
  prefillFormData?: Partial<import("@/lib/redux/features/application-slice").ApplicationFormData>
}) {
  return (
    <FormProvider applicationId={applicationId} actingForPatientId={actingForPatientId} prefillFormData={prefillFormData}>
      <FormWizardBody />
    </FormProvider>
  )
}
