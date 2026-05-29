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
import { AlertTriangle, CalendarIcon, CheckCircle2, ChevronDown, CircleCheck, Download, FileCheck2 } from "lucide-react"
import { WizardLayout } from "@/components/application/wizard-layout"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Spinner } from "@/components/ui/spinner"
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
import type { MassHealthAcaPayload } from "@/lib/pdf/masshealth-aca-payload"
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
  markApplicationSubmitted,
  setActiveApplication,
  setApplicationWizardState,
} from "@/lib/redux/features/application-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  evaluateAca3Eligibility,
  type Aca3EligibilityApplicantInput,
  type Aca3EligibilityResult,
  type EligibilityIncomeInput,
} from "@/lib/masshealth/aca3-eligibility-engine"
import { IdentityVerificationBanner } from "@/components/identity/IdentityVerificationBanner"
import { openScanner } from "@/lib/redux/features/identity-verification-slice"
import { IncomeEvidenceChecklist } from "@/components/application/income-verification/income-evidence-checklist"
import type {
  AddressGroupFieldProps,
  AddressValidationResponse,
  AnimatedRuleResult,
  DependentEntry,
  FieldRendererProps,
  FieldValue,
  FormContextValue,
  FormRecord,
  PersonState,
  ReviewPdfStepProps,
  StepContentProps,
  ValidateAndSubmitStepProps,
  ValidationPanelFinding,
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
import {
  inferCitizenshipStatus,
  mapWizardToEligibilityInput,
  mapWizardToPdfPayload,
} from "./wizard-mappings"
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
  getIncomeChecklistMemberId,
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
  StepContainer,
  Step1ProgramSelection,
  Step2PrimaryApplicant,
  PersonIdentitySummaryCard,
  Step3HouseholdMembers,
  PersonStepTabs,
} from "./form-wizard-steps"
import { ReviewPdfStep, getEngineRuleFixTarget } from "./form-wizard-review-step"

export { validateStepWithWizardRules } from "./form-wizard-validation"

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
      let preferredRaw = hasServerDraft
        ? serverRaw
        : choosePreferredHydratedRaw(
          [
            { source: "local", raw: localRaw },
            { source: "redux", raw: fromReduxRaw },
          ],
        )

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
      applyHydratedState(normalized ?? createInitialState())
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
      dispatch({ type: "set_person_field", payload: { personIndex: 0, section: "coverage", fieldId: "us_citizen", value: usCitizen } })
    }
  }, [isHydratedReady, prefillFormData])

  useEffect(() => {
    if (!hydratedRef.current) {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function ValidateAndSubmitStep({ onBackToReview, onGoToStep }: ValidateAndSubmitStepProps) {
  const { state, dispatch, applicationId, saveDraftNow, apiIncomeVerified } = useFormContext()
  const reduxDispatch = useAppDispatch()
  const validateStep = useStepValidation()
  const identityStatus = useAppSelector((rootState) => rootState.identityVerification.status)
  const identityVerified = identityStatus === "verified"
  const [findings, setFindings] = useState<ValidationPanelFinding[]>([])
  const [eligibilityResult, setEligibilityResult] = useState<Aca3EligibilityResult | null>(null)
  const [animatedRules, setAnimatedRules] = useState<AnimatedRuleResult[]>([])
  const [hasRunValidation, setHasRunValidation] = useState(false)
  const [isRunningValidation, setIsRunningValidation] = useState(false)
  const [rulePanelOpen, setRulePanelOpen] = useState(true)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitAcknowledged, setSubmitAcknowledged] = useState(false)
  const runTokenRef = useRef(0)

  const animateRules = useCallback(async (rules: Array<Omit<AnimatedRuleResult, "runtimeStatus">>) => {
    const runToken = runTokenRef.current + 1
    runTokenRef.current = runToken

    setAnimatedRules(
      rules.map((rule) => ({
        ...rule,
        runtimeStatus: "pending",
      })),
    )

    for (let index = 0; index < rules.length; index += 1) {
      if (runTokenRef.current !== runToken) {
        return
      }

      setAnimatedRules((previous) =>
        previous.map((rule, ruleIndex) =>
          ruleIndex === index
            ? {
                ...rule,
                runtimeStatus: "running",
              }
            : rule,
        ),
      )

      await sleep(260)

      if (runTokenRef.current !== runToken) {
        return
      }

      setAnimatedRules((previous) =>
        previous.map((rule, ruleIndex) =>
          ruleIndex === index
            ? {
                ...rule,
                runtimeStatus: rule.status,
              }
            : rule,
        ),
      )

      await sleep(120)
    }
  }, [])

  const runRulesEngine = async () => {
    setIsRunningValidation(true)
    setHasRunValidation(false)
    const nextFindings: ValidationPanelFinding[] = []
    const precheckRules: Array<Omit<AnimatedRuleResult, "runtimeStatus">> = []

    try {
      const blockingStepIssues: Array<{ step: number; count: number }> = []
      for (const step of [2, 3, 4, 5, 6, 7]) {
        const stepErrors = validateStep(step)
        const errorCount = Object.keys(stepErrors).length
        if (errorCount > 0) {
          blockingStepIssues.push({ step, count: errorCount })
        }
      }

      if (blockingStepIssues.length > 0) {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_REQUIRED_FIELDS",
          label: "Required Fields Completion",
          status: "fail",
          fixStep: blockingStepIssues[0]?.step ?? 2,
          fixLabel: `Step ${blockingStepIssues[0]?.step ?? 2}`,
          message: `Missing required fields: ${blockingStepIssues
            .map((item) => `Step ${item.step}: ${item.count} issue${item.count > 1 ? "s" : ""}`)
            .join(" | ")}`,
        })
        nextFindings.push({
          source: "precheck",
          code: "STEP_VALIDATION_BLOCKED",
          level: "error",
          message: precheckRules[precheckRules.length - 1]?.message ?? "Required fields are missing.",
        })
      } else {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_REQUIRED_FIELDS",
          label: "Required Fields Completion",
          status: "pass",
          message: "All required fields are complete across Steps 2-7.",
        })
      }

      const expectedCount = clampPersonCount(state.data.contact.p1_num_people || 1)
      if (state.data.persons.length !== expectedCount) {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_HOUSEHOLD_COUNT",
          label: "Household Count Consistency",
          status: "fail",
          fixStep: 2,
          fixLabel: "Step 2",
          message: `Expected ${expectedCount} person records but found ${state.data.persons.length}.`,
        })
        nextFindings.push({
          source: "precheck",
          code: "HOUSEHOLD_COUNT_MISMATCH",
          level: "error",
          message: `Expected ${expectedCount} person records but found ${state.data.persons.length}.`,
        })
      } else {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_HOUSEHOLD_COUNT",
          label: "Household Count Consistency",
          status: "pass",
          message: `Household count matches (${expectedCount} person record${expectedCount > 1 ? "s" : ""}).`,
        })
      }

      const applyingCount = state.data.persons.filter(
        (person) => String(person.coverage.applying_for_coverage ?? "") === "Yes",
      ).length
      if (applyingCount === 0) {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_COVERAGE_REQUEST",
          label: "Coverage Request",
          status: "warning",
          fixStep: 6,
          fixLabel: "Step 6",
          message: "No household member is marked as applying for coverage.",
        })
        nextFindings.push({
          source: "precheck",
          code: "NO_COVERAGE_APPLICANTS",
          level: "warning",
          message: "No one is applying for coverage. Confirm this is expected before submission.",
        })
      } else {
        precheckRules.push({
          source: "precheck",
          id: "PRECHECK_COVERAGE_REQUEST",
          label: "Coverage Request",
          status: "pass",
          message: `${applyingCount} household member${applyingCount > 1 ? "s are" : " is"} applying for coverage.`,
        })
      }

      if (!nextFindings.some((finding) => finding.level === "error")) {
        const eligibilityInput = mapWizardToEligibilityInput(state.data, apiIncomeVerified)
        const result = evaluateAca3Eligibility(eligibilityInput)
        setEligibilityResult(result)

        for (const finding of result.findings) {
          nextFindings.push({
            source: "engine",
            ...finding,
          })
        }

        await animateRules([
          ...precheckRules,
          ...result.rule_results.map((ruleResult) => ({
            ...ruleResult,
            source: "engine" as const,
            fixStep: getEngineRuleFixTarget(ruleResult.id)?.step,
            fixLabel: getEngineRuleFixTarget(ruleResult.id)?.label,
          })),
        ])
      } else {
        setEligibilityResult(null)
        await animateRules(precheckRules)
      }

      if (!nextFindings.some((finding) => finding.level === "error")) {
        nextFindings.push({
          source: "precheck",
          code: "VALIDATION_READY",
          level: "success",
          message: "Validation completed. Review result and submit when ready.",
        })
      }
    } finally {
      setFindings(nextFindings)
      setHasRunValidation(true)
      setIsRunningValidation(false)
    }
  }

  const hasBlockingErrors = findings.some((finding) => finding.level === "error")
  const statusBlocksSubmission =
    eligibilityResult?.status === "DENIED" || eligibilityResult?.status === "REDIRECT_ACA2"
  const canSubmit = hasRunValidation && !hasBlockingErrors && !statusBlocksSubmission && state.data.attestation && identityVerified
  const allRulesPassed =
    hasRunValidation &&
    !isRunningValidation &&
    animatedRules.length > 0 &&
    animatedRules.every((rule) => rule.runtimeStatus === "pass")

  useEffect(() => {
    if (!hasRunValidation) {
      setRulePanelOpen(true)
      return
    }

    setRulePanelOpen(!allRulesPassed)
  }, [allRulesPassed, hasRunValidation])

  return (
    <StepContainer
      title="Validate & Submit"
      description="Run MassHealth validation rules before final submission."
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onBackToReview}>
          Back to Review
        </Button>
        <Button type="button" onClick={runRulesEngine} disabled={isRunningValidation}>
          {isRunningValidation ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              Running Validation...
            </span>
          ) : (
            "Run Validation"
          )}
        </Button>
      </div>

      {animatedRules.length > 0 ? (
        <Card>
          <Collapsible open={rulePanelOpen} onOpenChange={setRulePanelOpen}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Rule Execution</CardTitle>
                  <CardDescription>
                    {allRulesPassed
                      ? "All rules passed. Expand to view full execution details."
                      : "Rules ran in sequence with pass/fail status and fix links."}
                  </CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    {rulePanelOpen ? "Collapse" : "Expand"}
                    <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", rulePanelOpen ? "rotate-180" : "")} />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-2">
                {animatedRules.map((rule) => (
                  <div
                    key={`${rule.source}-${rule.id}`}
                    className={cn(
                      "rounded-md border p-3 text-sm transition-colors",
                      rule.runtimeStatus === "pending" && "border-muted bg-muted/30 text-muted-foreground",
                      rule.runtimeStatus === "running" && "border-sky-500/40 bg-sky-500/10 text-sky-800",
                      rule.runtimeStatus === "pass" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
                      rule.runtimeStatus === "fail" && "border-destructive/40 bg-destructive/10 text-destructive",
                      rule.runtimeStatus === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-800",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{rule.label}</p>
                        <p>{rule.message}</p>
                        {(rule.runtimeStatus === "fail" || rule.runtimeStatus === "warning") && rule.fixStep ? (
                          <div className="pt-1">
                            <Button type="button" size="sm" variant="link" className="h-auto px-0" onClick={() => onGoToStep(rule.fixStep!)}>
                              Fix in Step {rule.fixStep}: {rule.fixLabel ?? "Go to step"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0">
                        {rule.runtimeStatus === "running" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium">
                            <Spinner className="size-3.5" />
                            RUNNING
                          </span>
                        ) : (
                          <span className="text-xs font-medium uppercase">{rule.runtimeStatus}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ) : null}

      {hasRunValidation ? (
        <div className="space-y-3">
          {findings.map((finding, index) => (
            <div
              key={`${finding.source}-${finding.code}-${index}`}
              className={cn(
                "rounded-md border p-3 text-sm",
                finding.level === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
                finding.level === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-800",
                finding.level === "info" && "border-sky-500/40 bg-sky-500/10 text-sky-800",
                finding.level === "success" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
              )}
            >
              <p className="font-medium">{finding.code}</p>
              <p className="mt-1">{finding.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Validation has not been run yet.
        </p>
      )}

      {eligibilityResult ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Eligibility Engine Result</CardTitle>
            <CardDescription>Computed from ACA-3 data and MassHealth rule set.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Applicant ID:</span> {eligibilityResult.applicant_id}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span> {eligibilityResult.status}
            </div>
            <div>
              <span className="text-muted-foreground">Program:</span> {eligibilityResult.eligible_program}
            </div>
            <div>
              <span className="text-muted-foreground">Household size:</span> {eligibilityResult.household_size}
            </div>
            <div>
              <span className="text-muted-foreground">MAGI income:</span> ${eligibilityResult.income.toLocaleString()}
            </div>
            <div>
              <span className="text-muted-foreground">FPL percent:</span> {eligibilityResult.fpl_percent}%
            </div>
            <div className="md:col-span-2">
              <span className="text-muted-foreground">Required documents:</span>{" "}
              {eligibilityResult.required_documents.length > 0
                ? eligibilityResult.required_documents.join(", ")
                : "None"}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {statusBlocksSubmission ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Submission is blocked because the current result status is {eligibilityResult?.status}.
        </div>
      ) : null}

      {/* Income proof upload — shown whenever applicationId is available */}
      {applicationId ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Income Proof Documents</CardTitle>
            </div>
            <CardDescription>
              Upload supporting documents for each income source. Verified documents strengthen your application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeEvidenceChecklist
              applicationId={applicationId}
              householdMembers={state.data.persons.map((p, i) => {
                const income = p.income as Record<string, unknown> | undefined
                const jobs = Array.isArray(income?.employment_jobs) ? income!.employment_jobs as Array<Record<string, unknown>> : []
                const other = (income?.other_income as Record<string, { selected?: boolean }>) ?? {}
                const sources: string[] = []
                if (jobs.length > 0) sources.push("employment")
                if (income?.self_employment_net_income) sources.push("self_employment")
                if (other.unemployment?.selected) sources.push("unemployment")
                if (other.social_security?.selected) sources.push("social_security")
                if (other.pension_annuity?.selected) sources.push("pension_annuity")
                if (other.rental?.selected) sources.push("rental")
                if (other.interest_dividend?.selected) sources.push("interest_dividend")
                const hasIncome = sources.length > 0
                if (!hasIncome) sources.push("zero_income")
                return {
                  memberId: getIncomeChecklistMemberId(applicationId, i),
                  memberName: String(p.identity?.name ?? "") || (i === 0 ? String(state.data.contact.p1_name ?? "") : `Member ${i + 1}`),
                  incomeSources: sources as import("@/lib/masshealth/types").IncomeSourceType[],
                  hasIncome,
                }
              })}
              onCaseUpdated={(updatedCase) => {
                // apiIncomeVerified is refreshed from the API on the next poll;
                // for immediate feedback update context state via a dispatch if needed
                void updatedCase
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
        <Checkbox
          checked={state.data.attestation}
          onCheckedChange={(checked) =>
            dispatch({ type: "set_attestation", payload: Boolean(checked) })
          }
        />
        <span>I attest that the information provided is true and complete to the best of my knowledge.</span>
      </label>

      {/* Identity verification hard gate */}
      {!identityVerified && !state.submitted && (
        <IdentityVerificationBanner className="w-full" />
      )}

      <Button
        type="button"
        className="w-full"
        disabled={!canSubmit || state.submitted}
        onClick={() => {
          if (!identityVerified) {
            reduxDispatch(openScanner())
            return
          }
          setSubmitAcknowledged(false)
          setSubmitDialogOpen(true)
        }}
        title={!identityVerified ? "Identity verification is required before submitting" : undefined}
      >
        {state.submitted ? "Application Submitted" : "Submit Application"}
      </Button>

      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submission Disclaimer</DialogTitle>
            <DialogDescription>
              Please review and acknowledge before final submission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900">
              By submitting, you confirm the application data is accurate to the best of your knowledge and understand
              that false or incomplete information can delay processing, require additional documents, or affect eligibility.
            </div>

            <label className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox checked={submitAcknowledged} onCheckedChange={(checked) => setSubmitAcknowledged(Boolean(checked))} />
              <span>I acknowledge this disclaimer and authorize submission of this application.</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!submitAcknowledged}
              onClick={async () => {
                const submittedState: WizardState = {
                  ...state,
                  submitted: true,
                  dirty: false,
                  errors: {},
                }
                dispatch({ type: "set_submitted", payload: true })
                dispatch({ type: "set_dirty", payload: false })
                reduxDispatch(markApplicationSubmitted({ applicationId }))
                await saveDraftNow(submittedState)
                setSubmitDialogOpen(false)
              }}
            >
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {state.submitted ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Application submitted after validation.
        </div>
      ) : null}
    </StepContainer>
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
    setIsGeneratingPdf(true)
    setPdfError(null)

    try {
      const payload = mapWizardToPdfPayload(state.data)
      const response = await authenticatedFetch(ACA_PDF_VIEW_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error("Failed to generate PDF preview.")
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
    } catch {
      setPdfError("Unable to generate PDF preview. Configure the PDF view API endpoint and try again.")
      return false
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [formDataHash, state.data])

  useEffect(() => {
    if (state.currentStep === 8 && !pdfUrl && !isGeneratingPdf) {
      void generatePdfPreview()
    }
  }, [generatePdfPreview, isGeneratingPdf, pdfUrl, state.currentStep])

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
