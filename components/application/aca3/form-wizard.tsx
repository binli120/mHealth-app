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
import { AlertTriangle, CalendarIcon, CheckCircle2, ChevronDown, CircleCheck } from "lucide-react"
import { WizardLayout } from "@/components/application/wizard-layout"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Spinner } from "@/components/ui/spinner"
import {
  ACA3_PERSON_SECTIONS_BY_ID,
  ACA3_SCHEMA,
  ACA_PDF_VIEW_ENDPOINT,
  DOB_FIELD_PATTERN,
  EMAIL_PATTERN,
  FORM_CACHE_KEY_PREFIX,
  FULL_NAME_FIELD_IDS,
  HOUSEHOLD_SIZE_FIELD_ID,
  HOUSEHOLD_SIZE_OPTIONS,
  MAX_DOB_AGE_YEARS,
  MAX_PERSON_COUNT,
  PERSON_SECTION_MAP,
  PERSON_STEP_SECTION_IDS,
  SSN_PATTERN,
  STEP_METADATA,
  SUPPORTED_LANGUAGE_FIELD_IDS,
  SUPPORTED_LANGUAGE_OPTIONS,
  US_STATE_CODES,
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
  type CitizenshipStatus,
  type EligibilityIncomeInput,
} from "@/lib/masshealth/aca3-eligibility-engine"
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
  SchemaField,
  StepContentProps,
  ValidateAndSubmitStepProps,
  ValidationPanelFinding,
  ValidationParams,
  WizardAction,
  WizardData,
  WizardState,
} from "./types"

function getFormCacheKey(applicationId: string): string {
  return `${FORM_CACHE_KEY_PREFIX}:${applicationId}`
}

function normalizeScalarFieldValue(field: SchemaField): FieldValue {
  if (field.value !== null && field.value !== undefined) {
    return field.value as FieldValue
  }

  switch (field.type) {
    case "checkbox":
      return false
    case "checkbox_group":
      return []
    case "repeatable_group":
      return []
    case "income_checklist":
    case "deduction_checklist": {
      const result: Record<string, unknown> = {}
      for (const item of field.items ?? []) {
        result[item.id] = {
          selected: false,
        }
      }
      return result
    }
    case "number":
    case "currency":
    case "text":
    case "textarea":
    case "date":
    case "email":
    case "phone":
    case "zip":
    case "ssn":
    case "radio":
    case "select":
      return ""
    default:
      return ""
  }
}

function seedFieldDefaults(fields: SchemaField[], target: FormRecord): void {
  for (const field of fields) {
    if (target[field.id] === undefined) {
      target[field.id] = normalizeScalarFieldValue(field)
    }

    if (field.type === "address_group" && field.fields) {
      seedFieldDefaults(Object.values(field.fields), target)
    }

    if (field.type === "repeatable_group" && Array.isArray(target[field.id])) {
      target[field.id] = []
    }

    if (field.sub_fields) {
      for (const subGroup of Object.values(field.sub_fields)) {
        seedFieldDefaults(subGroup, target)
      }
    }
  }
}

function makeDefaultPersonState(index: number): PersonState {
  const state: PersonState = {
    identity: {},
    demographics: {},
    ssn: {},
    tax: {},
    coverage: {},
    income: {},
    skippedOptional: {},
  }

  for (const section of ACA3_SCHEMA.person_schema.sub_sections) {
    const sectionId = section.sub_section_id
    if (!sectionId) {
      continue
    }

    const key = PERSON_SECTION_MAP[sectionId]
    if (!key) {
      continue
    }

    seedFieldDefaults(section.fields, state[key])

    if (index === 0 && sectionId === "ss_identity") {
      state.identity.relationship_to_p1 = "SELF"
    }
  }

  return state
}

function clampPersonCount(value: unknown): number {
  const parsed = Number.parseInt(String(value || "1"), 10)

  if (!Number.isFinite(parsed)) {
    return 1
  }

  return Math.min(MAX_PERSON_COUNT, Math.max(1, parsed))
}

function createInitialData(): WizardData {
  const preApp: FormRecord = {}
  const contact: FormRecord = {}
  const assister: FormRecord = {}

  seedFieldDefaults(ACA3_SCHEMA.pre_application.fields, preApp)
  seedFieldDefaults(ACA3_SCHEMA.step1_contact.fields, contact)
  seedFieldDefaults(ACA3_SCHEMA.enrollment_assister.fields, assister)

  const personCount = clampPersonCount(contact.p1_num_people || 1)
  const persons = Array.from({ length: personCount }, (_, index) => makeDefaultPersonState(index))

  contact.p1_num_people = String(personCount)

  return {
    preApp,
    contact,
    assister,
    assisterEnabled: false,
    persons,
    attestation: false,
  }
}

function createInitialState(): WizardState {
  return {
    data: createInitialData(),
    currentStep: 1,
    completedSteps: [],
    tabByStep: {
      4: 0,
      5: 0,
      6: 0,
      7: 0,
    },
    errors: {},
    dirty: false,
    submitted: false,
  }
}

function isAddressCoreField(field: SchemaField): boolean {
  const id = field.id.toLowerCase()
  if (id.includes("apt") || id.includes("county")) {
    return false
  }

  return id.includes("street") || id.includes("city") || id.includes("state") || id.includes("zip")
}

function requiresFullNameFormat(field: SchemaField): boolean {
  if (field.type !== "text") {
    return false
  }

  if (FULL_NAME_FIELD_IDS.has(field.id)) {
    return true
  }

  const label = field.label.toLowerCase()
  return label.includes("first name") && label.includes("last name")
}

function getRepeatableRowDefault(groupSchema: SchemaField[]): Record<string, unknown> {
  const row: Record<string, unknown> = {}

  for (const field of groupSchema) {
    row[field.id] = normalizeScalarFieldValue(field)

    if (field.sub_fields) {
      for (const subFields of Object.values(field.sub_fields)) {
        for (const subField of subFields) {
          row[subField.id] = normalizeScalarFieldValue(subField)
        }
      }
    }
  }

  return row
}

function getActiveSubFields(field: SchemaField, value: unknown): SchemaField[] {
  if (!field.sub_fields) {
    return []
  }

  const active: SchemaField[] = []
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : value

  for (const [key, subFields] of Object.entries(field.sub_fields)) {
    if (key === "if_yes" && normalizedValue === "yes") {
      active.push(...subFields)
    }

    if (key === "if_no" && normalizedValue === "no") {
      active.push(...subFields)
    }

    if (key.startsWith("if_includes_")) {
      const option = key.replace("if_includes_", "")
      if (Array.isArray(value) && value.includes(option)) {
        active.push(...subFields)
      }
    }
  }

  return active
}

function mapWizardToPdfPayload(data: WizardData): MassHealthAcaPayload {
  const primary = data.persons[0] ?? makeDefaultPersonState(0)
  const { firstName, lastName } = splitFullName(String(data.contact.p1_name ?? ""))
  const homeState = String(data.contact.p1_home_state ?? "MA").trim().toUpperCase() || "MA"
  const homeZip = String(data.contact.p1_home_zip ?? "").replace(/\D/g, "").slice(0, 5)
  const householdSize = clampPersonCount(data.contact.p1_num_people || data.persons.length || 1)
  const firstJob = Array.isArray(primary.income.employment_jobs)
    ? (primary.income.employment_jobs[0] as Record<string, unknown> | undefined)
    : undefined
  const wagesAmount = parseCurrency(String(firstJob?.wages_amount ?? ""))
  const wagesFrequency = String(firstJob?.wages_frequency ?? "")
  const monthlyIncome = toMonthlyIncome(wagesAmount, wagesFrequency)
  const annualIncomeFromField = parseCurrency(String(primary.income.total_income_current_year ?? ""))
  const annualIncome = annualIncomeFromField > 0 ? annualIncomeFromField : monthlyIncome * 12
  const citizenship: MassHealthAcaPayload["citizenship"] =
    String(primary.coverage.us_citizen ?? "") === "Yes" ? "citizen" : "other"

  return {
    firstName,
    lastName,
    dateOfBirth: String(data.contact.p1_dob ?? ""),
    email: String(data.contact.p1_email ?? ""),
    ssn: String(primary.ssn.ssn ?? ""),
    streetAddress: String(data.contact.p1_home_street ?? ""),
    apartment: String(data.contact.p1_home_apt ?? ""),
    city: String(data.contact.p1_home_city ?? ""),
    state: homeState,
    zipCode: homeZip,
    county: String(data.contact.p1_home_county ?? ""),
    phone: String(data.contact.p1_phone ?? ""),
    otherPhone: String(data.contact.p1_other_phone ?? ""),
    householdSize,
    citizenship,
    preferredSpokenLanguage: String(data.contact.p1_language_spoken ?? ""),
    preferredWrittenLanguage: String(data.contact.p1_language_written ?? ""),
    employerName: String(firstJob?.employer_name_address ?? ""),
    monthlyIncome,
    annualIncome,
    weeklyHours: Number.parseFloat(String(firstJob?.hours_per_week ?? "0")) || undefined,
    signatureName: String(data.contact.p1_name ?? ""),
    signatureDate: new Date().toISOString().slice(0, 10),
  }
}

function inferCitizenshipStatus(primaryCoverage: FormRecord): CitizenshipStatus {
  if (toBooleanYesNo(primaryCoverage.us_citizen)) {
    return "US_CITIZEN"
  }

  if (toBooleanYesNo(primaryCoverage.eligible_immigration_status)) {
    const immigrationText = String(primaryCoverage.immigration_status_type ?? "")
      .trim()
      .toLowerCase()

    if (immigrationText.includes("refugee")) {
      return "REFUGEE"
    }

    if (immigrationText.includes("asylee")) {
      return "ASYLEE"
    }

    if (immigrationText.includes("temporary protected status") || immigrationText.includes("tps")) {
      return "TPS"
    }

    if (immigrationText.includes("permanent")) {
      return "LEGAL_PERMANENT_RESIDENT"
    }

    return "QUALIFIED_NONCITIZEN"
  }

  return "UNDOCUMENTED"
}

function mapWizardToEligibilityInput(data: WizardData): Aca3EligibilityApplicantInput {
  const person1 = data.persons[0] ?? makeDefaultPersonState(0)
  const coverage = person1.coverage
  const tax = person1.tax
  const ssn = person1.ssn
  const incomeSection = person1.income
  const contact = data.contact

  const jobs = Array.isArray(incomeSection.employment_jobs)
    ? (incomeSection.employment_jobs as Array<Record<string, unknown>>)
    : []
  const wagesAnnual = jobs.reduce((sum, job) => {
    const amount = parseCurrency(String(job.wages_amount ?? ""))
    const frequency = String(job.wages_frequency ?? "")
    return sum + toAnnualAmount(amount, frequency)
  }, 0)

  const selfEmploymentRaw = parseCurrency(String(incomeSection.self_employment_net_income ?? ""))
  const selfEmploymentProfitLoss = String(incomeSection.self_employment_profit_loss ?? "")
    .trim()
    .toLowerCase()
  const selfEmploymentAnnual =
    selfEmploymentProfitLoss === "loss"
      ? -toAnnualAmount(selfEmploymentRaw, "monthly")
      : toAnnualAmount(selfEmploymentRaw, "monthly")

  const otherIncomeChecklist =
    (incomeSection.other_income as Record<string, Record<string, unknown>>) ?? {}
  const resolveChecklistAnnual = (id: string): number => {
    const item = otherIncomeChecklist[id]
    if (!item || !item.selected) {
      return 0
    }
    return toAnnualAmount(parseCurrency(String(item.amount ?? "")), String(item.frequency ?? ""))
  }

  const directAnnualTotal = parseCurrency(String(incomeSection.total_income_current_year ?? ""))

  const incomeInput: EligibilityIncomeInput = {
    wages: wagesAnnual,
    selfEmployment: selfEmploymentAnnual,
    unemployment: resolveChecklistAnnual("inc_unemployment"),
    socialSecurityTaxable: resolveChecklistAnnual("inc_social_security"),
    rentalIncome: resolveChecklistAnnual("inc_rental_royalty"),
    interest: resolveChecklistAnnual("inc_investment"),
    pension: resolveChecklistAnnual("inc_retirement_pension"),
  }

  const claimDependents = toBooleanYesNo(tax.claim_dependents)
  const dependentsCount = claimDependents
    ? countDependentsFromRows(tax.dependents_list__rows ?? tax.dependents_list)
    : 0
  const unbornChildren = toBooleanYesNo(coverage.is_pregnant)
    ? Number.parseInt(String(coverage.num_babies ?? "0"), 10) || 0
    : 0
  const ssnDigits = String(ssn.ssn ?? "").replace(/\D/g, "")
  const hasSsn = toBooleanYesNo(ssn.has_ssn)
  const applicantId = `ACA3-${String(contact.p1_name ?? "APPLICANT")
    .trim()
    .replace(/\s+/g, "-")
    .toUpperCase()}`

  const eligibilityInput = {
    applicantId,
    age: computeAgeFromDob(String(contact.p1_dob ?? "")),
    stateResident: toBooleanYesNo(coverage.ma_resident)
      ? "MA"
      : String(contact.p1_home_state ?? "").trim().toUpperCase(),
    identityVerified: hasSsn && ssnDigits.length === 9,
    citizenshipStatus: inferCitizenshipStatus(coverage),
    married: toBooleanYesNo(tax.legally_married),
    taxDependents: dependentsCount,
    taxFiler: toBooleanYesNo(tax.aptc_agree),
    pregnant: toBooleanYesNo(coverage.is_pregnant),
    unbornChildren,
    disabled: toBooleanYesNo(coverage.has_disability),
    medicalVerification: true,
    hasOtherInsurance: false,
    income:
      directAnnualTotal > 0
        ? {
            ...incomeInput,
            wages: directAnnualTotal,
          }
        : incomeInput,
    verification: {
      ssnVerified: hasSsn && ssnDigits.length === 9,
      incomeVerified: directAnnualTotal > 0 || wagesAnnual > 0 || !toBooleanYesNo(incomeSection.has_income),
      immigrationVerified:
        toBooleanYesNo(coverage.us_citizen) ||
        toBooleanYesNo(coverage.eligible_immigration_status),
    },
  }

  return eligibilityInput
}

function formReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "hydrate":
      return action.payload

    case "set_step":
      return {
        ...state,
        currentStep: action.payload,
        errors: {},
      }

    case "mark_step_complete":
      return {
        ...state,
        completedSteps: state.completedSteps.includes(action.payload)
          ? state.completedSteps
          : [...state.completedSteps, action.payload],
      }

    case "set_root_field": {
      const { scope, fieldId, value } = action.payload
      return {
        ...state,
        data: {
          ...state.data,
          [scope]: {
            ...state.data[scope],
            [fieldId]: value,
          },
        },
        dirty: true,
      }
    }

    case "set_assister_enabled":
      return {
        ...state,
        data: {
          ...state.data,
          assisterEnabled: action.payload,
        },
        dirty: true,
      }

    case "set_person_count": {
      const count = clampPersonCount(action.payload)
      const current = state.data.persons
      let nextPeople: PersonState[] = current

      if (current.length > count) {
        nextPeople = current.slice(0, count)
      }

      if (current.length < count) {
        nextPeople = [...current]
        for (let index = current.length; index < count; index += 1) {
          nextPeople.push(makeDefaultPersonState(index))
        }
      }

      const currentTabs = { ...state.tabByStep }
      for (const step of [4, 5, 6, 7]) {
        if ((currentTabs[step] ?? 0) > count - 1) {
          currentTabs[step] = 0
        }
      }

      return {
        ...state,
        tabByStep: currentTabs,
        data: {
          ...state.data,
          contact: {
            ...state.data.contact,
            p1_num_people: String(count),
          },
          persons: nextPeople,
        },
        dirty: true,
      }
    }

    case "set_person_field": {
      const { personIndex, section, fieldId, value } = action.payload
      const nextPeople = [...state.data.persons]
      const person = nextPeople[personIndex]

      if (!person) {
        return state
      }

      nextPeople[personIndex] = {
        ...person,
        [section]: {
          ...person[section],
          [fieldId]: value,
        },
      }

      return {
        ...state,
        data: {
          ...state.data,
          persons: nextPeople,
        },
        dirty: true,
      }
    }

    case "set_person_optional_skip": {
      const { personIndex, sectionId, value } = action.payload
      const nextPeople = [...state.data.persons]
      const person = nextPeople[personIndex]

      if (!person) {
        return state
      }

      nextPeople[personIndex] = {
        ...person,
        skippedOptional: {
          ...person.skippedOptional,
          [sectionId]: value,
        },
      }

      return {
        ...state,
        data: {
          ...state.data,
          persons: nextPeople,
        },
        dirty: true,
      }
    }

    case "set_tab":
      return {
        ...state,
        tabByStep: {
          ...state.tabByStep,
          [action.payload.step]: action.payload.tab,
        },
      }

    case "set_errors":
      return {
        ...state,
        errors: action.payload,
      }

    case "clear_errors":
      return {
        ...state,
        errors: {},
      }

    case "set_attestation":
      return {
        ...state,
        data: {
          ...state.data,
          attestation: action.payload,
        },
        dirty: true,
      }

    case "set_submitted":
      return {
        ...state,
        submitted: action.payload,
        dirty: false,
      }

    case "set_dirty":
      return {
        ...state,
        dirty: action.payload,
      }

    default:
      return state
  }
}

const FormContext = createContext<FormContextValue | null>(null)

function useFormContext(): FormContextValue {
  const context = useContext(FormContext)

  if (!context) {
    throw new Error("useFormContext must be used inside FormProvider")
  }

  return context
}

function normalizeHydratedState(raw: unknown): WizardState | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const fallback = createInitialState()
  const value = raw as Partial<WizardState>
  const data = value.data

  if (!data || typeof data !== "object") {
    return null
  }

  const initialData = createInitialData()
  const hydratedData: WizardData = {
    ...initialData,
    ...data,
    preApp: {
      ...initialData.preApp,
      ...((data as Partial<WizardData>).preApp ?? {}),
    },
    contact: {
      ...initialData.contact,
      ...((data as Partial<WizardData>).contact ?? {}),
    },
    assister: {
      ...initialData.assister,
      ...((data as Partial<WizardData>).assister ?? {}),
    },
    persons: Array.isArray((data as Partial<WizardData>).persons)
      ? (data as Partial<WizardData>).persons!.map((person, index) => {
          const base = makeDefaultPersonState(index)
          const safePerson = person as Partial<PersonState>

          return {
            ...base,
            ...safePerson,
            identity: {
              ...base.identity,
              ...(safePerson.identity ?? {}),
            },
            demographics: {
              ...base.demographics,
              ...(safePerson.demographics ?? {}),
            },
            ssn: {
              ...base.ssn,
              ...(safePerson.ssn ?? {}),
            },
            tax: {
              ...base.tax,
              ...(safePerson.tax ?? {}),
            },
            coverage: {
              ...base.coverage,
              ...(safePerson.coverage ?? {}),
            },
            income: {
              ...base.income,
              ...(safePerson.income ?? {}),
            },
            skippedOptional: {
              ...base.skippedOptional,
              ...(safePerson.skippedOptional ?? {}),
            },
          }
        })
      : initialData.persons,
  }

  const personCount = clampPersonCount(hydratedData.contact.p1_num_people || 1)
  hydratedData.contact.p1_num_people = String(personCount)

  if (hydratedData.persons.length > personCount) {
    hydratedData.persons = hydratedData.persons.slice(0, personCount)
  }

  if (hydratedData.persons.length < personCount) {
    for (let index = hydratedData.persons.length; index < personCount; index += 1) {
      hydratedData.persons.push(makeDefaultPersonState(index))
    }
  }

  return {
    ...fallback,
    ...value,
    data: hydratedData,
    completedSteps: Array.isArray(value.completedSteps)
      ? value.completedSteps.filter((step): step is number => Number.isInteger(step))
      : [],
    currentStep:
      typeof value.currentStep === "number" && value.currentStep >= 1 && value.currentStep <= 9
        ? value.currentStep
        : 1,
    tabByStep: {
      ...fallback.tabByStep,
      ...(value.tabByStep ?? {}),
    },
    errors: {},
    dirty: false,
    submitted: Boolean(value.submitted),
  }
}

function FormProvider({
  children,
  applicationId,
}: {
  children: ReactNode
  applicationId?: string
}) {
  const [state, dispatch] = useReducer(formReducer, undefined, createInitialState)
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
      const persistedState = {
        ...sourceState,
        errors: {},
      }

      try {
        const response = await authenticatedFetch(
          `/api/applications/${encodeURIComponent(resolvedApplicationId)}/draft`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              wizardState: persistedState,
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
    [resolvedApplicationId, state],
  )

  useEffect(() => {
    if (hydratedApplicationRef.current === resolvedApplicationId) {
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
    }

    const fromRedux = normalizeHydratedState(applicationRecord?.aca3Wizard ?? null)
    if (fromRedux) {
      applyHydratedState(fromRedux)
      return
    }

    const hydrateFromServerThenCache = async () => {
      try {
        const response = await authenticatedFetch(
          `/api/applications/${encodeURIComponent(resolvedApplicationId)}/draft`,
          {
            method: "GET",
            cache: "no-store",
          },
        )

        if (response.ok) {
          const payload = (await response.json()) as {
            draftState?: unknown
          }
          const normalizedServer = normalizeHydratedState(payload.draftState ?? null)
          if (normalizedServer) {
            applyHydratedState(normalizedServer)
            return
          }
        }
      } catch {
        // Fall through to local cache.
      }

      const cacheKey = getFormCacheKey(resolvedApplicationId)

      try {
        const raw = window.localStorage.getItem(cacheKey)
        if (!raw) {
          applyHydratedState(createInitialState())
          return
        }

        const parsed = JSON.parse(raw) as unknown
        const normalized = normalizeHydratedState(parsed)
        if (normalized) {
          applyHydratedState(normalized)
        } else {
          applyHydratedState(createInitialState())
        }
      } catch {
        // Ignore corrupt local cache and start fresh.
        applyHydratedState(createInitialState())
      }
    }

    void hydrateFromServerThenCache()

    return () => {
      cancelled = true
    }
  }, [applicationRecord?.aca3Wizard, resolvedApplicationId])

  useEffect(() => {
    if (!hydratedRef.current) {
      return
    }

    const persistedState = {
      ...state,
      errors: {},
    }
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
      void saveDraftNow(persistedState as WizardState)
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
      saveDraftNow,
    }),
    [resolvedApplicationId, saveDraftNow, state],
  )

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function AddressGroupField({
  field,
  formValues,
  getValue,
  setValue,
  errors,
  errorPrefix,
  personNumber,
  errorKey,
}: AddressGroupFieldProps) {
  const [isValidating, setIsValidating] = useState(false)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [validationTone, setValidationTone] = useState<"success" | "warning" | "error" | null>(null)
  const lastRequestedKeyRef = useRef("")
  const setValueRef = useRef(setValue)

  useEffect(() => {
    setValueRef.current = setValue
  }, [setValue])

  const addressFields = Object.values(field.fields ?? {})
  const siblingFieldIds = {
    streetId: addressFields.find((item) => /(^|_)street$/i.test(item.id))?.id,
    cityId: addressFields.find((item) => /(^|_)city$/i.test(item.id))?.id,
    stateId: addressFields.find((item) => /(^|_)state$/i.test(item.id))?.id,
    zipId: addressFields.find((item) => /(^|_)zip$/i.test(item.id))?.id,
    countyId: addressFields.find((item) => /(^|_)county$/i.test(item.id))?.id,
  }

  const streetValue = siblingFieldIds.streetId ? String(getValue(siblingFieldIds.streetId) ?? "").trim() : ""
  const cityValue = siblingFieldIds.cityId ? String(getValue(siblingFieldIds.cityId) ?? "").trim() : ""
  const stateValue = siblingFieldIds.stateId ? String(getValue(siblingFieldIds.stateId) ?? "").trim().toUpperCase() : ""
  const zipValue = siblingFieldIds.zipId ? digitsOnly(String(getValue(siblingFieldIds.zipId) ?? "")).slice(0, 5) : ""
  const addressKey = `${streetValue}|${cityValue}|${stateValue}|${zipValue}`
  const canValidate =
    Boolean(siblingFieldIds.streetId && siblingFieldIds.cityId && siblingFieldIds.stateId) &&
    streetValue.length > 0 &&
    cityValue.length > 0 &&
    stateValue.length === 2

  useEffect(() => {
    if (!canValidate) {
      setIsValidating(false)
      setValidationMessage(null)
      setValidationTone(null)
      lastRequestedKeyRef.current = ""
      return
    }

    if (lastRequestedKeyRef.current === addressKey) {
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      lastRequestedKeyRef.current = addressKey
      setIsValidating(true)
      setValidationMessage(null)
      setValidationTone(null)

      try {
        const response = await authenticatedFetch("/api/address/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            streetAddress: streetValue,
            city: cityValue,
            state: stateValue,
            zipCode: zipValue,
          }),
          signal: controller.signal,
        })

        const result = (await response.json()) as AddressValidationResponse

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Unable to validate address.")
        }

        const suggestion = result.suggestion
        if (suggestion) {
          const nextStreet = suggestion.streetAddress.trim()
          const nextCity = suggestion.city.trim()
          const nextState = suggestion.state.trim().toUpperCase()
          const nextZip = digitsOnly(suggestion.zipCode).slice(0, 5)
          const nextCounty = suggestion.county.trim()

          if (siblingFieldIds.streetId && nextStreet && nextStreet !== streetValue) {
            setValueRef.current(siblingFieldIds.streetId, nextStreet)
          }

          if (siblingFieldIds.cityId && nextCity && nextCity !== cityValue) {
            setValueRef.current(siblingFieldIds.cityId, nextCity)
          }

          if (siblingFieldIds.stateId && nextState && nextState !== stateValue) {
            setValueRef.current(siblingFieldIds.stateId, nextState)
          }

          if (siblingFieldIds.zipId && nextZip && nextZip !== zipValue) {
            setValueRef.current(siblingFieldIds.zipId, nextZip)
          }

          if (siblingFieldIds.countyId && nextCounty) {
            const currentCounty = String(getValue(siblingFieldIds.countyId) ?? "").trim()
            if (nextCounty !== currentCounty) {
              setValueRef.current(siblingFieldIds.countyId, nextCounty)
            }
          }
        }

        setValidationTone(result.valid ? "success" : "warning")
        setValidationMessage(
          result.message || (result.valid ? "Address validated successfully." : "Address validated with suggested corrections."),
        )
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return
        }

        setValidationTone("error")
        setValidationMessage("Address validation is unavailable right now.")
      } finally {
        setIsValidating(false)
      }
    }, 600)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [
    addressKey,
    canValidate,
    cityValue,
    getValue,
    siblingFieldIds.cityId,
    siblingFieldIds.countyId,
    siblingFieldIds.stateId,
    siblingFieldIds.streetId,
    siblingFieldIds.zipId,
    stateValue,
    streetValue,
    zipValue,
  ])

  return (
    <Card className="border-dashed" data-error-key={errorKey}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{field.label}</CardTitle>
        {field.hint ? <CardDescription>{field.hint}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-4 md:grid-cols-2">
          {addressFields.map((addressField) => (
            <FieldRenderer
              key={`${errorPrefix}${addressField.id}`}
              field={addressField}
              formValues={formValues}
              getValue={getValue}
              setValue={setValue}
              errors={errors}
              errorPrefix={errorPrefix}
              personNumber={personNumber}
              addressSiblingFieldIds={siblingFieldIds}
            />
          ))}
        </div>

        {isValidating ? <p className="text-xs text-muted-foreground">Validating address...</p> : null}
        {validationMessage ? (
          <p
            className={cn(
              "text-xs",
              validationTone === "success" && "text-emerald-600",
              validationTone === "warning" && "text-amber-600",
              validationTone === "error" && "text-destructive",
            )}
          >
            {validationMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function FieldRenderer({
  field,
  formValues,
  getValue,
  setValue,
  errors,
  errorPrefix,
  personNumber,
  addressSiblingFieldIds,
}: FieldRendererProps) {
  const { isVisible } = useConditional(field, formValues)
  const currentValue = getValue(field.id)
  const emailValue = typeof currentValue === "string" ? currentValue : ""
  const emailField = useField<string>({
    value: emailValue,
    validators:
      field.type === "email"
        ? [
            (value) => {
              if (!value.trim()) {
                return null
              }
              return EMAIL_PATTERN.test(value.trim()) ? null : "Enter a valid email address."
            },
          ]
        : [],
  })
  const showDetails = field.type !== "email" || emailField.isValid || !emailValue.trim()

  if (field.applicable_from_person && personNumber && personNumber < field.applicable_from_person) {
    return null
  }

  if (!isVisible) {
    return null
  }

  const errorKey = `${errorPrefix}${field.id}`
  const errorMessage = errors[errorKey]
  const visibleErrorMessage = errorMessage || (field.type === "email" ? emailField.error : null)
  const isSpouseNameDobField = field.id === "spouse_name_dob"
  const isDependentsListField = field.id === "dependents_list"
  const isHouseholdSizeField = field.id === HOUSEHOLD_SIZE_FIELD_ID

  const setTextValue = (next: string) => {
    switch (field.type) {
      case "phone":
        setValue(field.id, formatPhoneNumber(next))
        break
      case "ssn":
        setValue(field.id, formatSsn(next))
        break
      case "currency":
        setValue(field.id, formatCurrency(next))
        break
      case "date":
        setValue(field.id, normalizeDateInput(next))
        break
      case "zip":
        setValue(field.id, next.replace(/\D/g, "").slice(0, 5))
        break
      case "number":
        setValue(field.id, normalizeNumberInput(next))
        break
      default:
        setValue(field.id, next)
    }
  }

  const setSpouseNameDobValue = (name: string, dobUsDate: string) => {
    const normalizedName = name.trim()
    const normalizedDob = dobUsDate.trim()
    const combined = normalizedName && normalizedDob ? `${normalizedName} | ${normalizedDob}` : normalizedName || normalizedDob

    setValue(`${field.id}__name`, name)
    setValue(`${field.id}__dob`, normalizedDob)
    setValue(field.id, combined)
  }

  const activeSubFields = getActiveSubFields(field, currentValue)
  const isStateSelectField = field.type === "select" && /(^|_)state$/i.test(field.id)
  const isSupportedLanguageField = SUPPORTED_LANGUAGE_FIELD_IDS.has(field.id)
  const radioValue = String(currentValue ?? "")
  const normalizedOptions = (field.options ?? []).map((option) => option.trim().toLowerCase())
  const isYesNoRadio =
    field.type === "radio" &&
    normalizedOptions.length === 2 &&
    normalizedOptions.includes("yes") &&
    normalizedOptions.includes("no")
  const yesNoVisibleOptions =
    isYesNoRadio && (radioValue === "Yes" || radioValue === "No")
      ? [radioValue]
      : field.options ?? []
  const selectOptions =
    isSupportedLanguageField
      ? [...SUPPORTED_LANGUAGE_OPTIONS]
      : isHouseholdSizeField
        ? [...HOUSEHOLD_SIZE_OPTIONS]
      : field.options && field.options.length > 0
        ? field.options
        : isStateSelectField
          ? [...US_STATE_CODES]
          : []

  if (field.type === "address_group") {
    return (
      <AddressGroupField
        field={field}
        formValues={formValues}
        getValue={getValue}
        setValue={setValue}
        errors={errors}
        errorPrefix={errorPrefix}
        personNumber={personNumber}
        errorKey={errorKey}
      />
    )
  }

  if (field.type === "repeatable_group") {
    const rows = Array.isArray(currentValue) ? (currentValue as Array<Record<string, unknown>>) : []
    const maxEntries = field.max_entries ?? 2
    const groupSchema = field.group_schema ?? []

    const addRow = () => {
      if (rows.length >= maxEntries) {
        return
      }

      const next = [...rows, getRepeatableRowDefault(groupSchema)]
      setValue(field.id, next)
    }

    const removeRow = (index: number) => {
      const next = rows.filter((_, rowIndex) => rowIndex !== index)
      setValue(field.id, next)
    }

    const updateRowField = (rowIndex: number, fieldId: string, value: FieldValue) => {
      const next = [...rows]
      const row = {
        ...(next[rowIndex] ?? {}),
        [fieldId]: value,
      }
      next[rowIndex] = row
      setValue(field.id, next)
    }

    return (
      <Card data-error-key={errorKey}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{field.label}</CardTitle>
          {field.hint ? <CardDescription>{field.hint}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs added yet.</p>
          ) : null}

          {rows.map((row, rowIndex) => {
            const rowContext = {
              ...formValues,
              ...row,
            }

            return (
              <Card key={`${field.id}-row-${rowIndex}`} className="border-border/70">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">Job {rowIndex + 1}</CardTitle>
                  {rows.length > 1 ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => removeRow(rowIndex)}>
                      Remove
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  {groupSchema.map((groupField) => (
                    <FieldRenderer
                      key={`${errorPrefix}${field.id}.${rowIndex}.${groupField.id}`}
                      field={groupField}
                      formValues={rowContext}
                      getValue={(fieldId) => row[fieldId]}
                      setValue={(fieldId, value) => updateRowField(rowIndex, fieldId, value)}
                      errors={errors}
                      errorPrefix={`${errorPrefix}${field.id}.${rowIndex}.`}
                      personNumber={personNumber}
                    />
                  ))}
                </CardContent>
              </Card>
            )
          })}

          <Button type="button" variant="secondary" onClick={addRow} disabled={rows.length >= maxEntries}>
            Add Job
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (field.type === "income_checklist") {
    const checklistValue = (currentValue as Record<string, Record<string, unknown>>) ?? {}

    const setChecklistItem = (itemId: string, patch: Record<string, unknown>) => {
      const next = {
        ...checklistValue,
        [itemId]: {
          ...(checklistValue[itemId] ?? {}),
          ...patch,
        },
      }
      setValue(field.id, next)
    }

    return (
      <Card data-error-key={errorKey}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{field.label}</CardTitle>
          {field.hint ? <CardDescription>{field.hint}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {(field.items ?? []).map((item) => {
            const itemValue = (checklistValue[item.id] ?? {}) as Record<string, unknown>
            const isSelected = Boolean(itemValue.selected)

            return (
              <div key={item.id} className="rounded-md border p-3">
                <label className="flex items-start gap-3 text-sm font-medium">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      setChecklistItem(item.id, {
                        selected: Boolean(checked),
                      })
                    }}
                  />
                  <span>{item.label}</span>
                </label>

                {isSelected ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.amount`}>Amount</Label>
                      <Input
                        id={`${errorPrefix}${field.id}.${item.id}.amount`}
                        value={String(itemValue.amount ?? "")}
                        onChange={(event) => {
                          setChecklistItem(item.id, {
                            amount: formatCurrency(event.target.value),
                          })
                        }}
                      />
                      {errors[`${errorPrefix}${field.id}.${item.id}.amount`] ? (
                        <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.amount`]}</p>
                      ) : null}
                    </div>

                    <div>
                      <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.frequency`}>Frequency</Label>
                      <Select
                        value={String(itemValue.frequency ?? "")}
                        onValueChange={(value) => {
                          setChecklistItem(item.id, {
                            frequency: value,
                          })
                        }}
                      >
                        <SelectTrigger id={`${errorPrefix}${field.id}.${item.id}.frequency`}>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {([
                            "One time only",
                            "Weekly",
                            "Every two weeks",
                            "Twice a month",
                            "Monthly",
                            "Yearly",
                          ] as string[]).map((option) => (
                            <SelectItem key={`${item.id}-${option}`} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors[`${errorPrefix}${field.id}.${item.id}.frequency`] ? (
                        <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.frequency`]}</p>
                      ) : null}
                    </div>

                    {item.extra_fields?.includes("source") ? (
                      <div>
                        <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.source`}>Source</Label>
                        <Input
                          id={`${errorPrefix}${field.id}.${item.id}.source`}
                          value={String(itemValue.source ?? "")}
                          onChange={(event) => {
                            setChecklistItem(item.id, {
                              source: event.target.value,
                            })
                          }}
                        />
                        {errors[`${errorPrefix}${field.id}.${item.id}.source`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.source`]}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {item.extra_fields?.includes("type") ? (
                      <div>
                        <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.type`}>Type</Label>
                        <Input
                          id={`${errorPrefix}${field.id}.${item.id}.type`}
                          value={String(itemValue.type ?? "")}
                          onChange={(event) => {
                            setChecklistItem(item.id, {
                              type: event.target.value,
                            })
                          }}
                        />
                        {errors[`${errorPrefix}${field.id}.${item.id}.type`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.type`]}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {item.extra_fields?.includes("profit_or_loss") ? (
                      <div className="md:col-span-2">
                        <Label>Profit / Loss</Label>
                        <RadioGroup
                          value={String(itemValue.profit_or_loss ?? "")}
                          onValueChange={(value) => {
                            setChecklistItem(item.id, {
                              profit_or_loss: value,
                            })
                          }}
                          className="mt-2 flex flex-wrap gap-4"
                        >
                          {["Profit", "Loss"].map((option) => (
                            <label key={`${item.id}-${option}`} className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value={option} id={`${errorPrefix}${field.id}.${item.id}.${option}`} />
                              {option}
                            </label>
                          ))}
                        </RadioGroup>
                        {errors[`${errorPrefix}${field.id}.${item.id}.profit_or_loss`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.profit_or_loss`]}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {item.extra_fields?.includes("hours_per_week") ? (
                      <div>
                        <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.hours_per_week`}>Hours per week</Label>
                        <Input
                          id={`${errorPrefix}${field.id}.${item.id}.hours_per_week`}
                          value={String(itemValue.hours_per_week ?? "")}
                          onChange={(event) => {
                            setChecklistItem(item.id, {
                              hours_per_week: normalizeNumberInput(event.target.value),
                            })
                          }}
                        />
                        {errors[`${errorPrefix}${field.id}.${item.id}.hours_per_week`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.hours_per_week`]}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {item.extra_fields?.includes("effective_date") ? (
                      <div>
                        <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.effective_date`}>Effective date</Label>
                        <Input
                          id={`${errorPrefix}${field.id}.${item.id}.effective_date`}
                          value={String(itemValue.effective_date ?? "")}
                          onChange={(event) => {
                            setChecklistItem(item.id, {
                              effective_date: normalizeDateInput(event.target.value),
                            })
                          }}
                          placeholder="MM/DD/YYYY"
                        />
                        {errors[`${errorPrefix}${field.id}.${item.id}.effective_date`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.effective_date`]}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  if (field.type === "deduction_checklist") {
    const checklistValue = (currentValue as Record<string, Record<string, unknown>>) ?? {}

    const setChecklistItem = (itemId: string, patch: Record<string, unknown>) => {
      const next = {
        ...checklistValue,
        [itemId]: {
          ...(checklistValue[itemId] ?? {}),
          ...patch,
        },
      }
      setValue(field.id, next)
    }

    return (
      <Card data-error-key={errorKey}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{field.label}</CardTitle>
          {field.hint ? <CardDescription>{field.hint}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {(field.items ?? []).map((item) => {
            const itemValue = (checklistValue[item.id] ?? {}) as Record<string, unknown>
            const isSelected = Boolean(itemValue.selected)
            const needsAmount = item.id !== "ded_none"

            return (
              <div key={item.id} className="rounded-md border p-3">
                <label className="flex items-start gap-3 text-sm font-medium">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      setChecklistItem(item.id, {
                        selected: Boolean(checked),
                      })
                    }}
                  />
                  <span>{item.label}</span>
                </label>

                {isSelected && needsAmount ? (
                  <div className="mt-3">
                    <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.yearly_amount`}>Yearly amount</Label>
                    <Input
                      id={`${errorPrefix}${field.id}.${item.id}.yearly_amount`}
                      value={String(itemValue.yearly_amount ?? "")}
                      onChange={(event) => {
                        setChecklistItem(item.id, {
                          yearly_amount: formatCurrency(event.target.value),
                        })
                      }}
                    />
                    {errors[`${errorPrefix}${field.id}.${item.id}.yearly_amount`] ? (
                      <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.yearly_amount`]}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  if (isSpouseNameDobField) {
    const parsed = typeof currentValue === "string" ? splitSpouseNameDobValue(currentValue) : { name: "", dob: "" }
    const spouseName = String(getValue(`${field.id}__name`) ?? parsed.name)
    const spouseDobUs = String(getValue(`${field.id}__dob`) ?? parsed.dob)
    const spouseNameError = errors[`${errorPrefix}${field.id}__name`]
    const spouseDobError = errors[`${errorPrefix}${field.id}__dob`]

    return (
      <div className="space-y-3" data-error-key={`${errorPrefix}${field.id}__name`}>
        <Label htmlFor={`${errorPrefix}${field.id}__name`}>
          {field.label}
          {field.required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1" data-error-key={`${errorPrefix}${field.id}__name`}>
            <Label htmlFor={`${errorPrefix}${field.id}__name`} className="text-xs text-muted-foreground">
              Spouse name
            </Label>
            <Input
              id={`${errorPrefix}${field.id}__name`}
              value={spouseName}
              onChange={(event) => setSpouseNameDobValue(event.target.value, spouseDobUs)}
              placeholder="First name, middle name, last name"
            />
            {spouseNameError ? <p className="text-xs text-destructive">{spouseNameError}</p> : null}
          </div>

          <div className="space-y-1" data-error-key={`${errorPrefix}${field.id}__dob`}>
            <Label htmlFor={`${errorPrefix}${field.id}__dob`} className="text-xs text-muted-foreground">
              Date of birth
            </Label>
            <Input
              id={`${errorPrefix}${field.id}__dob`}
              type="text"
              inputMode="numeric"
              placeholder="MM/DD/YYYY"
              value={spouseDobUs}
              onChange={(event) => setSpouseNameDobValue(spouseName, normalizeDateInput(event.target.value))}
            />
            {spouseDobError ? <p className="text-xs text-destructive">{spouseDobError}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  if (isDependentsListField) {
    const parsedRows = typeof currentValue === "string" ? parseDependentsListValue(currentValue) : []
    const storedRows = getValue(`${field.id}__rows`)
    const rowsFromState = Array.isArray(storedRows)
      ? (storedRows as Array<Record<string, unknown>>).map((row) => ({
          name: String(row.name ?? ""),
          dob: String(row.dob ?? ""),
        }))
      : parsedRows
    const rows = rowsFromState.length > 0 ? rowsFromState : [{ name: "", dob: "" }]
    const rowsError = errors[`${errorPrefix}${field.id}__rows`]

    const setDependentsRows = (nextRows: DependentEntry[]) => {
      setValue(`${field.id}__rows`, nextRows as unknown as FieldValue)
      setValue(field.id, buildDependentsListValue(nextRows))
    }

    const updateDependent = (index: number, patch: Partial<DependentEntry>) => {
      const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
      setDependentsRows(nextRows)
    }

    const addDependent = () => {
      setDependentsRows([...rows, { name: "", dob: "" }])
    }

    const removeDependent = (index: number) => {
      if (rows.length <= 1) {
        return
      }
      setDependentsRows(rows.filter((_, rowIndex) => rowIndex !== index))
    }

    return (
      <div className="space-y-3" data-error-key={`${errorPrefix}${field.id}__rows`}>
        <Label htmlFor={`${errorPrefix}${field.id}__rows`}>
          {field.label}
          {field.required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>

        <div className="space-y-3">
          {rows.map((row, rowIndex) => (
            <Card key={`${field.id}-dependent-${rowIndex}`} className="border-border/70">
              <CardContent className="pt-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1" data-error-key={`${errorPrefix}${field.id}__rows.${rowIndex}.name`}>
                      <Label htmlFor={`${errorPrefix}${field.id}__rows.${rowIndex}.name`} className="text-xs text-muted-foreground">
                        Dependent name
                      </Label>
                      <Input
                        id={`${errorPrefix}${field.id}__rows.${rowIndex}.name`}
                        value={row.name}
                        onChange={(event) => updateDependent(rowIndex, { name: event.target.value })}
                        placeholder="First name, middle name, last name"
                      />
                      {errors[`${errorPrefix}${field.id}__rows.${rowIndex}.name`] ? (
                        <p className="text-xs text-destructive">{errors[`${errorPrefix}${field.id}__rows.${rowIndex}.name`]}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1" data-error-key={`${errorPrefix}${field.id}__rows.${rowIndex}.dob`}>
                      <Label htmlFor={`${errorPrefix}${field.id}__rows.${rowIndex}.dob`} className="text-xs text-muted-foreground">
                        Date of birth
                      </Label>
                      <Input
                        id={`${errorPrefix}${field.id}__rows.${rowIndex}.dob`}
                        type="text"
                        inputMode="numeric"
                        placeholder="MM/DD/YYYY"
                        value={row.dob}
                        onChange={(event) => updateDependent(rowIndex, { dob: normalizeDateInput(event.target.value) })}
                      />
                      {errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`] ? (
                        <p className="text-xs text-destructive">{errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`]}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => removeDependent(rowIndex)} disabled={rows.length <= 1}>
                      Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={addDependent}>
            + Add dependent
          </Button>
        </div>

        {rowsError ? <p className="text-sm text-destructive">{rowsError}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-2" data-error-key={errorKey}>
      <Label htmlFor={`${errorPrefix}${field.id}`}>
        {field.label}
        {field.required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {field.hint && showDetails ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}

      {field.type === "textarea" ? (
        <Textarea
          id={`${errorPrefix}${field.id}`}
          rows={4}
          value={String(currentValue ?? "")}
          onChange={(event) => setTextValue(event.target.value)}
        />
      ) : null}

      {field.type === "checkbox" ? (
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <Checkbox
            checked={Boolean(currentValue)}
            onCheckedChange={(checked) => {
              setValue(field.id, Boolean(checked))
            }}
          />
          <span>{field.label}</span>
        </label>
      ) : null}

      {field.type === "checkbox_group" ? (
        <div className="space-y-2 rounded-md border p-3">
          {(field.options ?? []).map((option) => {
            const selected = Array.isArray(currentValue) ? (currentValue as string[]) : []
            const checked = selected.includes(option)
            const exclusiveOptions = getExclusiveCheckboxOptions(field.options ?? [])
            const hasExclusiveSelected = selected.some((selectedOption) => exclusiveOptions.has(selectedOption))
            const hasNonExclusiveSelected = selected.some((selectedOption) => !exclusiveOptions.has(selectedOption))
            const isExclusiveOption = exclusiveOptions.has(option)
            const maxReached = Boolean(field.max_select) && selected.length >= (field.max_select ?? 0)
            const disabledByExclusivity =
              !checked &&
              ((hasExclusiveSelected && !isExclusiveOption) || (hasNonExclusiveSelected && isExclusiveOption))

            return (
              <label key={`${field.id}-${option}`} className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={(!checked && maxReached) || disabledByExclusivity}
                  onCheckedChange={(nextChecked) => {
                    if (nextChecked) {
                      if (isExclusiveOption) {
                        setValue(field.id, [option])
                        return
                      }

                      const nextSelected = selected.filter((selectedOption) => !exclusiveOptions.has(selectedOption))
                      setValue(field.id, [...nextSelected, option])
                    } else {
                      setValue(
                        field.id,
                        selected.filter((item) => item !== option),
                      )
                    }
                  }}
                />
                <span>{option}</span>
              </label>
            )
          })}
        </div>
      ) : null}

      {field.type === "radio" ? (
        isYesNoRadio ? (
          <RadioGroup value={radioValue} onValueChange={(value) => setValue(field.id, value)} className="space-y-2">
            {yesNoVisibleOptions.map((option) => (
              <label
                key={`${field.id}-${option}`}
                className="flex items-center gap-3 rounded-md border p-3 text-sm"
                onClick={(event) => {
                  if (radioValue === option) {
                    event.preventDefault()
                    setValue(field.id, "")
                  }
                }}
              >
                <RadioGroupItem value={option} id={`${errorPrefix}${field.id}-${option}`} />
                <span>{option}</span>
              </label>
            ))}
          </RadioGroup>
        ) : (
          <RadioGroup value={String(currentValue ?? "")} onValueChange={(value) => setValue(field.id, value)} className="space-y-2">
            {(field.options ?? []).map((option) => (
              <label key={`${field.id}-${option}`} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <RadioGroupItem value={option} id={`${errorPrefix}${field.id}-${option}`} />
                <span>{option}</span>
              </label>
            ))}
          </RadioGroup>
        )
      ) : null}

      {field.type === "select" || isSupportedLanguageField || isHouseholdSizeField ? (
        <Select value={String(currentValue ?? "")} onValueChange={(value) => setValue(field.id, value)}>
          <SelectTrigger id={`${errorPrefix}${field.id}`}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {selectOptions.map((option) => (
              <SelectItem key={`${field.id}-${option}`} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {field.type === "date" && !isSupportedLanguageField ? (
        <div className="flex items-center gap-2">
          <Input
            id={`${errorPrefix}${field.id}`}
            type="text"
            inputMode="numeric"
            placeholder="MM/DD/YYYY"
            value={String(currentValue ?? "")}
            onChange={(event) => setTextValue(event.target.value)}
            className="flex-1"
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label={`Open calendar for ${field.label}`}>
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                selected={typeof currentValue === "string" ? parseDate(currentValue) ?? undefined : undefined}
                onSelect={(date) => {
                  if (!date) {
                    return
                  }

                  setValue(field.id, formatUsDate(date))
                }}
                startMonth={
                  DOB_FIELD_PATTERN.test(field.id)
                    ? new Date(new Date().getFullYear() - MAX_DOB_AGE_YEARS, 0, 1)
                    : new Date(new Date().getFullYear() - 100, 0, 1)
                }
                endMonth={
                  DOB_FIELD_PATTERN.test(field.id)
                    ? new Date()
                    : new Date(new Date().getFullYear() + 50, 11, 31)
                }
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {["text", "email", "phone", "zip", "number", "currency", "ssn"].includes(field.type) &&
      !isSupportedLanguageField &&
      !isHouseholdSizeField ? (
        <Input
          id={`${errorPrefix}${field.id}`}
          type={field.type === "email" ? "email" : "text"}
          pattern={field.type === "email" ? "[^\\s@]+@[^\\s@]+\\.[^\\s@]+" : undefined}
          inputMode={field.type === "number" || field.type === "currency" ? "decimal" : "text"}
          value={String(currentValue ?? "")}
          onChange={(event) => setTextValue(event.target.value)}
          onPaste={(event) => {
            if (
              field.type !== "text" ||
              !addressSiblingFieldIds?.streetId ||
              field.id !== addressSiblingFieldIds.streetId
            ) {
              return
            }

            const pastedText = event.clipboardData.getData("text")
            const parsed = parsePastedUsAddress(pastedText)

            if (!parsed) {
              return
            }

            event.preventDefault()
            setValue(field.id, parsed.streetAddress)

            if (addressSiblingFieldIds.cityId) {
              setValue(addressSiblingFieldIds.cityId, parsed.city)
            }

            if (addressSiblingFieldIds.stateId) {
              setValue(addressSiblingFieldIds.stateId, parsed.state)
            }

            if (addressSiblingFieldIds.zipId) {
              setValue(addressSiblingFieldIds.zipId, parsed.zipCode)
            }
          }}
          maxLength={field.type === "zip" ? 5 : undefined}
        />
      ) : null}

      {visibleErrorMessage ? <p className="text-sm text-destructive">{visibleErrorMessage}</p> : null}

      {activeSubFields.length > 0 ? (
        <div className="mt-3 space-y-3 rounded-md border border-dashed p-3 transition-all animate-in fade-in-50">
          {activeSubFields.map((subField) => (
            <FieldRenderer
              key={`${errorPrefix}${subField.id}`}
              field={subField}
              formValues={formValues}
              getValue={getValue}
              setValue={setValue}
              errors={errors}
              errorPrefix={errorPrefix}
              personNumber={personNumber}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function validateFieldValue(field: SchemaField, value: unknown, isRequired: boolean): string | null {
  if (isRequired && !isFilled(value)) {
    return "This field is required."
  }

  if (!isFilled(value)) {
    return null
  }

  if (requiresFullNameFormat(field)) {
    return hasFirstAndLastName(String(value)) ? null : "Enter first and last name."
  }

  if (field.type === "email") {
    return EMAIL_PATTERN.test(String(value).trim()) ? null : "Enter a valid email address."
  }

  if (field.type === "phone") {
    const digits = String(value).replace(/\D/g, "")
    return digits.length === 10 ? null : "Enter a 10-digit US phone number."
  }

  if (field.type === "ssn") {
    return SSN_PATTERN.test(String(value)) ? null : "Enter SSN as ###-##-####."
  }

  if (field.type === "zip") {
    return /^\d{5}$/.test(String(value)) ? null : "ZIP must be exactly 5 digits."
  }

  if (field.type === "date") {
    const date = parseDate(String(value))
    if (!date) {
      return "Enter date as MM/DD/YYYY."
    }

    if (DOB_FIELD_PATTERN.test(field.id) && date.getTime() > Date.now()) {
      return "Date of birth cannot be in the future."
    }

    if (DOB_FIELD_PATTERN.test(field.id)) {
      return validateDobBounds(date)
    }
  }

  if (field.type === "number") {
    const numeric = Number.parseFloat(String(value))
    if (!Number.isFinite(numeric)) {
      return "Enter a valid number."
    }

    if (numeric < 0) {
      return "Value cannot be negative."
    }

    if (field.validation?.min !== undefined && numeric < field.validation.min) {
      return `Value must be at least ${field.validation.min}.`
    }

    if (field.validation?.max !== undefined && numeric > field.validation.max) {
      return `Value must be at most ${field.validation.max}.`
    }
  }

  if (field.type === "currency") {
    const numeric = parseCurrency(String(value))
    if (!Number.isFinite(numeric) || numeric < 0) {
      return "Enter a valid non-negative amount."
    }
  }

  return null
}

function validateFieldsRecursive({
  fields,
  values,
  getValue,
  errors,
  errorPrefix,
  personNumber,
}: ValidationParams) {
  for (const field of fields) {
    if (field.applicable_from_person && personNumber && personNumber < field.applicable_from_person) {
      continue
    }

    const visible = evaluateConditionalRule(field.show_if, values)
    if (!visible) {
      continue
    }

    let requiredByRule = false
    if (typeof field.required_if === "boolean") {
      requiredByRule = field.required_if
    } else if (field.required_if) {
      requiredByRule = evaluateConditionalRule(field.required_if, values)
    }

    const isRequired = Boolean(field.required) || requiredByRule
    const fieldValue = getValue(field.id)

    if (field.type === "address_group") {
      const subFields = Object.values(field.fields ?? {})
      for (const subField of subFields) {
        const subValue = getValue(subField.id)
        const subRequired = Boolean(subField.required) || (isRequired && isAddressCoreField(subField))
        const subError = validateFieldValue(subField, subValue, subRequired)

        if (subError) {
          errors[`${errorPrefix}${subField.id}`] = subError
        }
      }
      continue
    }

    if (field.type === "repeatable_group") {
      const rows = Array.isArray(fieldValue) ? (fieldValue as Array<Record<string, unknown>>) : []
      const groupSchema = field.group_schema ?? []

      rows.forEach((row, rowIndex) => {
        const rowValues = {
          ...values,
          ...row,
        }

        validateFieldsRecursive({
          fields: groupSchema,
          values: rowValues,
          getValue: (fieldId) => row[fieldId],
          errors,
          errorPrefix: `${errorPrefix}${field.id}.${rowIndex}.`,
          personNumber,
        })
      })
      continue
    }

    if (field.type === "income_checklist") {
      const checklistValue = (fieldValue as Record<string, Record<string, unknown>>) ?? {}

      for (const item of field.items ?? []) {
        const itemValue = (checklistValue[item.id] ?? {}) as Record<string, unknown>
        if (!itemValue.selected) {
          continue
        }

        const amount = itemValue.amount
        const frequency = itemValue.frequency

        if (!isFilled(amount)) {
          errors[`${errorPrefix}${field.id}.${item.id}.amount`] = "Amount is required."
        } else if (parseCurrency(String(amount)) < 0) {
          errors[`${errorPrefix}${field.id}.${item.id}.amount`] = "Amount cannot be negative."
        }

        if (!isFilled(frequency)) {
          errors[`${errorPrefix}${field.id}.${item.id}.frequency`] = "Frequency is required."
        }

        for (const extra of item.extra_fields ?? []) {
          const extraValue = itemValue[extra]
          if (!isFilled(extraValue)) {
            errors[`${errorPrefix}${field.id}.${item.id}.${extra}`] = "This field is required."
          }
        }
      }
      continue
    }

    if (field.type === "deduction_checklist") {
      const checklistValue = (fieldValue as Record<string, Record<string, unknown>>) ?? {}

      for (const item of field.items ?? []) {
        const itemValue = (checklistValue[item.id] ?? {}) as Record<string, unknown>
        if (!itemValue.selected || item.id === "ded_none") {
          continue
        }

        const yearlyAmount = itemValue.yearly_amount
        if (!isFilled(yearlyAmount)) {
          errors[`${errorPrefix}${field.id}.${item.id}.yearly_amount`] = "Yearly amount is required."
        } else if (parseCurrency(String(yearlyAmount)) < 0) {
          errors[`${errorPrefix}${field.id}.${item.id}.yearly_amount`] = "Amount cannot be negative."
        }
      }
      continue
    }

    if (field.id === "spouse_name_dob") {
      const spouseName = String(getValue(`${field.id}__name`) ?? "").trim()
      const spouseDobUs = String(getValue(`${field.id}__dob`) ?? "").trim()

      if (isRequired && spouseName.length === 0) {
        errors[`${errorPrefix}${field.id}__name`] = "Spouse name is required."
      } else if (spouseName.length > 0 && !hasFirstAndLastName(spouseName)) {
        errors[`${errorPrefix}${field.id}__name`] = "Enter first and last name."
      }

      if (isRequired && spouseDobUs.length === 0) {
        errors[`${errorPrefix}${field.id}__dob`] = "Spouse date of birth is required."
      } else if (spouseDobUs.length > 0) {
        const spouseDobDate = parseDate(spouseDobUs)
        if (!spouseDobDate) {
          errors[`${errorPrefix}${field.id}__dob`] = "Enter date as MM/DD/YYYY."
        } else {
          const dobBoundsError = validateDobBounds(spouseDobDate)
          if (dobBoundsError) {
            errors[`${errorPrefix}${field.id}__dob`] = dobBoundsError
          }
        }
      }

      continue
    }

    if (field.id === "dependents_list") {
      const rawRows = getValue(`${field.id}__rows`)
      const parsedRows =
        typeof fieldValue === "string" ? parseDependentsListValue(fieldValue) : []
      const rows = Array.isArray(rawRows)
        ? (rawRows as Array<Record<string, unknown>>).map((row) => ({
            name: String(row.name ?? "").trim(),
            dob: String(row.dob ?? "").trim(),
          }))
        : parsedRows.map((row) => ({
            name: row.name.trim(),
            dob: row.dob.trim(),
          }))

      const enteredRows = rows.filter((row) => row.name.length > 0 || row.dob.length > 0)

      if (isRequired && enteredRows.length === 0) {
        errors[`${errorPrefix}${field.id}__rows`] = "Add at least one dependent with name and date of birth."
      }

      enteredRows.forEach((row, rowIndex) => {
        if (!row.name) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.name`] = "Dependent name is required."
        } else if (!hasFirstAndLastName(row.name)) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.name`] = "Enter first and last name."
        }

        if (!row.dob) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`] = "Dependent date of birth is required."
          return
        }

        const dobDate = parseDate(row.dob)
        if (!dobDate) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`] = "Enter date as MM/DD/YYYY."
          return
        }

        const dobBoundsError = validateDobBounds(dobDate)
        if (dobBoundsError) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`] = dobBoundsError
        }
      })

      continue
    }

    const fieldError = validateFieldValue(field, fieldValue, isRequired)
    if (fieldError) {
      errors[`${errorPrefix}${field.id}`] = fieldError
    }

    const activeSubFields = getActiveSubFields(field, fieldValue)

    if (activeSubFields.length > 0) {
      validateFieldsRecursive({
        fields: activeSubFields,
        values,
        getValue,
        errors,
        errorPrefix,
        personNumber,
      })
    }
  }
}

function sectionHasAnyAnswer(fields: SchemaField[], getValue: (fieldId: string) => unknown): boolean {
  for (const field of fields) {
    const value = getValue(field.id)
    if (isFilled(value)) {
      return true
    }

    if (field.type === "address_group" && field.fields) {
      if (Object.values(field.fields).some((subField) => isFilled(getValue(subField.id)))) {
        return true
      }
    }

    if (field.sub_fields) {
      const subGroups = Object.values(field.sub_fields)
      if (subGroups.some((subFields) => sectionHasAnyAnswer(subFields, getValue))) {
        return true
      }
    }
  }

  return false
}

function PersonTabStatus({ complete }: { complete: boolean }) {
  return complete ? (
    <CircleCheck className="h-4 w-4 text-emerald-500" />
  ) : (
    <AlertTriangle className="h-4 w-4 text-amber-500" />
  )
}

export function validateStepWithWizardRules(step: number, data: WizardData): Record<string, string> {
  const errors: Record<string, string> = {}
  const personCount = clampPersonCount(data.contact.p1_num_people || data.persons.length || 1)

  if (step === 1) {
    return errors
  }

  if (step === 2) {
    const contactValues = {
      ...data.preApp,
      ...data.contact,
    }

    validateFieldsRecursive({
      fields: ACA3_SCHEMA.step1_contact.fields,
      values: contactValues,
      getValue: (fieldId) => data.contact[fieldId],
      errors,
      errorPrefix: "step2.contact.",
    })

    if (data.assisterEnabled) {
      validateFieldsRecursive({
        fields: ACA3_SCHEMA.enrollment_assister.fields,
        values: {
          ...contactValues,
          ...data.assister,
        },
        getValue: (fieldId) => data.assister[fieldId],
        errors,
        errorPrefix: "step2.assister.",
      })
    }

    return errors
  }

  if (step === 3) {
    const identitySection = ACA3_PERSON_SECTIONS_BY_ID.get("ss_identity")
    if (!identitySection) {
      return errors
    }

    for (let personIndex = 1; personIndex < personCount; personIndex += 1) {
      const person = data.persons[personIndex]
      if (!person) {
        continue
      }

      validateFieldsRecursive({
        fields: identitySection.fields,
        values: {
          ...data.contact,
          ...person.identity,
        },
        getValue: (fieldId) => person.identity[fieldId],
        errors,
        errorPrefix: `step3.person${personIndex + 1}.identity.`,
        personNumber: personIndex + 1,
      })
    }

    return errors
  }

  const sectionIds = PERSON_STEP_SECTION_IDS[step]
  if (!sectionIds) {
    return errors
  }

  for (let personIndex = 0; personIndex < personCount; personIndex += 1) {
    const person = data.persons[personIndex]
    if (!person) {
      continue
    }

    for (const sectionId of sectionIds) {
      const section = ACA3_PERSON_SECTIONS_BY_ID.get(sectionId)
      const sectionKey = PERSON_SECTION_MAP[sectionId]
      if (!section || !sectionKey) {
        continue
      }
      const skippedOptionalSection =
        step === 4 && section.optional && Boolean(person.skippedOptional[sectionId])

      if (skippedOptionalSection) {
        continue
      }

      const sectionValues = person[sectionKey]
      const contextValues = {
        ...data.preApp,
        ...data.contact,
        ...person.identity,
        ...person.demographics,
        ...person.ssn,
        ...person.tax,
        ...person.coverage,
        ...person.income,
      }

      validateFieldsRecursive({
        fields: section.fields,
        values: contextValues,
        getValue: (fieldId) => sectionValues[fieldId],
        errors,
        errorPrefix: `step${step}.person${personIndex + 1}.${sectionId}.`,
        personNumber: personIndex + 1,
      })

      if (step === 4 && section.optional) {
        const skipped = Boolean(person.skippedOptional[sectionId])
        const hasAnyAnswer = sectionHasAnyAnswer(section.fields, (fieldId) => sectionValues[fieldId])

        if (!skipped && !hasAnyAnswer) {
          errors[`step4.person${personIndex + 1}.${sectionId}.skip`] =
            "Complete this optional section or explicitly skip it for this person."
        }
      }
    }
  }

  return errors
}

function useStepValidation() {
  const { state } = useFormContext()

  return useCallback(
    (step: number): Record<string, string> => validateStepWithWizardRules(step, state.data),
    [state.data],
  )
}

function StepContainer({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

function Step1ProgramSelection() {
  const { state, dispatch } = useFormContext()
  const values = state.data.preApp

  return (
    <StepContainer title={ACA3_SCHEMA.pre_application.title} description={ACA3_SCHEMA.pre_application.description}>
      {ACA3_SCHEMA.pre_application.fields.map((field) => (
        <FieldRenderer
          key={`step1.${field.id}`}
          field={field}
          formValues={values}
          getValue={(fieldId) => values[fieldId]}
          setValue={(fieldId, value) => {
            dispatch({
              type: "set_root_field",
              payload: {
                scope: "preApp",
                fieldId,
                value,
              },
            })
          }}
          errors={state.errors}
          errorPrefix="step1.preapp."
        />
      ))}
    </StepContainer>
  )
}

function Step2PrimaryApplicant() {
  const { state, dispatch } = useFormContext()
  const values = {
    ...state.data.preApp,
    ...state.data.contact,
  }
  const applicantIdentityFieldIds = ["p1_dob", "p1_email"] as const
  const phoneFieldIds = ["p1_phone", "p1_other_phone"] as const
  const languageFieldIds = ["p1_language_spoken", "p1_language_written"] as const
  const step2FieldMap = new Map(ACA3_SCHEMA.step1_contact.fields.map((field) => [field.id, field]))

  const renderContactField = (field: SchemaField, key: string) => (
    <FieldRenderer
      key={key}
      field={field}
      formValues={values}
      getValue={(fieldId) => state.data.contact[fieldId]}
      setValue={(fieldId, value) => {
        if (fieldId === "p1_num_people") {
          const nextCount = clampPersonCount(value)
          dispatch({
            type: "set_person_count",
            payload: nextCount,
          })
          return
        }

        dispatch({
          type: "set_root_field",
          payload: {
            scope: "contact",
            fieldId,
            value,
          },
        })
      }}
      errors={state.errors}
      errorPrefix="step2.contact."
    />
  )

  return (
    <StepContainer title="Primary Applicant & Household Setup" description="Person 1 identity comes from this step.">
      <div className="space-y-4">
        {ACA3_SCHEMA.step1_contact.fields.map((field) => (
          field.id === applicantIdentityFieldIds[0] ? (
            <div key="step2.group.applicant-identity" className="grid gap-4 md:grid-cols-2">
              {applicantIdentityFieldIds.map((fieldId) => {
                const identityField = step2FieldMap.get(fieldId)
                if (!identityField) {
                  return null
                }
                return renderContactField(identityField, `step2.${fieldId}`)
              })}
            </div>
          ) : field.id === applicantIdentityFieldIds[1] ? null : field.id === phoneFieldIds[0] ? (
            <div key="step2.group.phone" className="grid gap-4 md:grid-cols-2">
              {phoneFieldIds.map((fieldId) => {
                const phoneField = step2FieldMap.get(fieldId)
                if (!phoneField) {
                  return null
                }
                return renderContactField(phoneField, `step2.${fieldId}`)
              })}
            </div>
          ) : field.id === phoneFieldIds[1] ? null : field.id === languageFieldIds[0] ? (
            <div key="step2.group.language" className="grid gap-4 md:grid-cols-2">
              {languageFieldIds.map((fieldId) => {
                const languageField = step2FieldMap.get(fieldId)
                if (!languageField) {
                  return null
                }
                return renderContactField(languageField, `step2.${fieldId}`)
              })}
            </div>
          ) : field.id === languageFieldIds[1] ? null : (
            renderContactField(field, `step2.${field.id}`)
          )
        ))}
      </div>

      <Collapsible open={state.data.assisterEnabled} onOpenChange={(open) => dispatch({ type: "set_assister_enabled", payload: open })}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between">
            I am an enrollment assister completing this on someone&apos;s behalf
            <ChevronDown className={cn("h-4 w-4 transition-transform", state.data.assisterEnabled ? "rotate-180" : "")}/>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          {ACA3_SCHEMA.enrollment_assister.fields.map((field) => (
            <FieldRenderer
              key={`step2.assister.${field.id}`}
              field={field}
              formValues={{
                ...values,
                ...state.data.assister,
              }}
              getValue={(fieldId) => state.data.assister[fieldId]}
              setValue={(fieldId, value) => {
                dispatch({
                  type: "set_root_field",
                  payload: {
                    scope: "assister",
                    fieldId,
                    value,
                  },
                })
              }}
              errors={state.errors}
              errorPrefix="step2.assister."
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </StepContainer>
  )
}

function PersonIdentitySummaryCard() {
  const { state } = useFormContext()

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">You (Person 1)</CardTitle>
        <CardDescription>Read-only summary from Step 2 contact fields.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Name:</span> {String(state.data.contact.p1_name || "—")}
        </div>
        <div>
          <span className="text-muted-foreground">DOB:</span> {String(state.data.contact.p1_dob || "—")}
        </div>
        <div>
          <span className="text-muted-foreground">Email:</span> {String(state.data.contact.p1_email || "—")}
        </div>
        <div>
          <span className="text-muted-foreground">Phone:</span> {String(state.data.contact.p1_phone || "—")}
        </div>
      </CardContent>
    </Card>
  )
}

function Step3HouseholdMembers() {
  const { state, dispatch } = useFormContext()
  const personCount = clampPersonCount(state.data.contact.p1_num_people || state.data.persons.length || 1)
  const identitySection = ACA3_PERSON_SECTIONS_BY_ID.get("ss_identity")

  if (!identitySection) {
    return null
  }

  return (
    <StepContainer title="Household Members" description="Persons 2 through N are editable here using ss_identity.">
      <PersonIdentitySummaryCard />

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">How many people are on this application?</CardTitle>
          <CardDescription>Person 1 is you. Add Person to enter Person 2, 3, 4, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-28">
              <Label htmlFor="step3-household-count">Household size</Label>
              <Select
                value={String(personCount)}
                onValueChange={(value) => {
                  dispatch({
                    type: "set_person_count",
                    payload: Number.parseInt(value, 10),
                  })
                }}
              >
                <SelectTrigger id="step3-household-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUSEHOLD_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={`step3-household-count-${option}`} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                dispatch({
                  type: "set_person_count",
                  payload: personCount + 1,
                })
              }}
              disabled={personCount >= MAX_PERSON_COUNT}
            >
              Add Person
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum supported household size is {MAX_PERSON_COUNT} people.
          </p>
        </CardContent>
      </Card>

      {Array.from({ length: Math.max(0, personCount - 1) }, (_, offset) => {
        const personIndex = offset + 1
        const person = state.data.persons[personIndex]

        if (!person) {
          return null
        }

        const contextValues = {
          ...state.data.contact,
          ...person.identity,
        }

        return (
          <Card key={`step3-person-${personIndex + 1}`}>
            <CardHeader>
              <CardTitle className="text-base">Person {personIndex + 1}</CardTitle>
              <CardDescription>Identity fields from `person_schema.ss_identity`.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {identitySection.fields.map((field) => (
                <FieldRenderer
                  key={`step3.person${personIndex + 1}.${field.id}`}
                  field={field}
                  formValues={contextValues}
                  getValue={(fieldId) => person.identity[fieldId]}
                  setValue={(fieldId, value) => {
                    dispatch({
                      type: "set_person_field",
                      payload: {
                        personIndex,
                        section: "identity",
                        fieldId,
                        value,
                      },
                    })
                  }}
                  errors={state.errors}
                  errorPrefix={`step3.person${personIndex + 1}.identity.`}
                  personNumber={personIndex + 1}
                />
              ))}
            </CardContent>
          </Card>
        )
      })}

      {personCount === 1 ? (
        <p className="text-sm text-muted-foreground">
          No additional people yet. Increase household size above 1 to enter Person 2 and beyond.
        </p>
      ) : null}
    </StepContainer>
  )
}

function PersonStepTabs({ step }: { step: 4 | 5 | 6 | 7 }) {
  const { state, dispatch } = useFormContext()
  const personCount = clampPersonCount(state.data.contact.p1_num_people || state.data.persons.length || 1)
  const sectionIds = PERSON_STEP_SECTION_IDS[step] ?? []
  const activeTab = state.tabByStep[step] ?? 0
  const singlePerson = personCount === 1

  const getTabCompletion = (personIndex: number): boolean => {
    const person = state.data.persons[personIndex]
    if (!person) {
      return false
    }

    const tabErrors: Record<string, string> = {}

    for (const sectionId of sectionIds) {
      const section = ACA3_PERSON_SECTIONS_BY_ID.get(sectionId)
      const sectionKey = PERSON_SECTION_MAP[sectionId]
      if (!section || !sectionKey) {
        continue
      }
      const skippedOptionalSection =
        step === 4 && section.optional && Boolean(person.skippedOptional[sectionId])

      if (skippedOptionalSection) {
        continue
      }

      const sectionValues = person[sectionKey]
      const contextValues = {
        ...state.data.preApp,
        ...state.data.contact,
        ...person.identity,
        ...person.demographics,
        ...person.ssn,
        ...person.tax,
        ...person.coverage,
        ...person.income,
      }

      validateFieldsRecursive({
        fields: section.fields,
        values: contextValues,
        getValue: (fieldId) => sectionValues[fieldId],
        errors: tabErrors,
        errorPrefix: `step${step}.person${personIndex + 1}.${sectionId}.`,
        personNumber: personIndex + 1,
      })

      if (step === 4 && section.optional) {
        const skipped = Boolean(person.skippedOptional[sectionId])
        const hasAnyAnswer = sectionHasAnyAnswer(section.fields, (fieldId) => sectionValues[fieldId])
        if (!skipped && !hasAnyAnswer) {
          tabErrors[`step4.person${personIndex + 1}.${sectionId}.skip`] =
            "Complete this optional section or skip it."
        }
      }
    }

    return Object.keys(tabErrors).length === 0
  }

  const renderPersonSections = (personIndex: number) => {
    const person = state.data.persons[personIndex]
    if (!person) {
      return null
    }

    return (
      <div className="space-y-6">
        {sectionIds.map((sectionId) => {
          const section = ACA3_PERSON_SECTIONS_BY_ID.get(sectionId)
          const sectionKey = PERSON_SECTION_MAP[sectionId]
          if (!section || !sectionKey) {
            return null
          }

          const sectionValues = person[sectionKey]
          const isOptionalSkipped = section.optional && Boolean(person.skippedOptional[sectionId])
          const contextValues = {
            ...state.data.preApp,
            ...state.data.contact,
            ...person.identity,
            ...person.demographics,
            ...person.ssn,
            ...person.tax,
            ...person.coverage,
            ...person.income,
          }

          return (
            <Card key={`step${step}-person${personIndex + 1}-${sectionId}`}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
                {section.description ? <CardDescription>{section.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {section.optional ? (
                  <div className="rounded-md border border-dashed bg-muted/20 p-3">
                    <p className="text-sm text-muted-foreground">Optional section</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={person.skippedOptional[sectionId] ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          dispatch({
                            type: "set_person_optional_skip",
                            payload: {
                              personIndex,
                              sectionId,
                              value: !Boolean(person.skippedOptional[sectionId]),
                            },
                          })
                        }}
                      >
                        {person.skippedOptional[sectionId] ? "Skipped" : "Skip this optional section"}
                      </Button>
                    </div>
                    {state.errors[`step${step}.person${personIndex + 1}.${sectionId}.skip`] ? (
                      <p className="mt-2 text-sm text-destructive">{state.errors[`step${step}.person${personIndex + 1}.${sectionId}.skip`]}</p>
                    ) : null}
                  </div>
                ) : null}

                {isOptionalSkipped ? (
                  <p className="text-sm text-muted-foreground">
                    This optional section is skipped for this person. Toggle off &quot;Skipped&quot; to edit these fields.
                  </p>
                ) : (
                  section.fields.map((field) => (
                    <FieldRenderer
                      key={`step${step}.person${personIndex + 1}.${sectionId}.${field.id}`}
                      field={field}
                      formValues={contextValues}
                      getValue={(fieldId) => sectionValues[fieldId]}
                      setValue={(fieldId, value) => {
                        dispatch({
                          type: "set_person_field",
                          payload: {
                            personIndex,
                            section: sectionKey,
                            fieldId,
                            value,
                          },
                        })
                      }}
                      errors={state.errors}
                      errorPrefix={`step${step}.person${personIndex + 1}.${sectionId}.`}
                      personNumber={personIndex + 1}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  if (singlePerson) {
    return (
      <StepContainer title={STEP_METADATA[step - 1].title}>
        {renderPersonSections(0)}
      </StepContainer>
    )
  }

  return (
    <StepContainer title={STEP_METADATA[step - 1].title}>
      <Tabs value={String(activeTab)} onValueChange={(value) => dispatch({ type: "set_tab", payload: { step, tab: Number.parseInt(value, 10) || 0 } })}>
        <TabsList className="h-auto w-full flex-wrap items-stretch justify-start gap-2 bg-transparent p-0">
          {Array.from({ length: personCount }, (_, personIndex) => {
            const complete = getTabCompletion(personIndex)
            const label = personIndex === 0 ? "You (Person 1)" : `Person ${personIndex + 1}`

            return (
              <TabsTrigger
                key={`step${step}-tab-${personIndex}`}
                value={String(personIndex)}
                className="h-auto min-w-44 justify-between rounded-md border bg-card px-3 py-2"
              >
                <span className="text-sm">{label}</span>
                <PersonTabStatus complete={complete} />
              </TabsTrigger>
            )
          })}
        </TabsList>

        {Array.from({ length: personCount }, (_, personIndex) => (
          <TabsContent key={`step${step}-tab-content-${personIndex}`} value={String(personIndex)} className="mt-5">
            {renderPersonSections(personIndex)}
          </TabsContent>
        ))}
      </Tabs>
    </StepContainer>
  )
}

function ReviewPdfStep({
  reviewMode,
  onSetReviewMode,
  pdfUrl,
  pdfError,
  isGeneratingPdf,
  pdfStale,
  onGeneratePdf,
  onGoToStep,
  onValidate,
}: ReviewPdfStepProps) {
  const { state } = useFormContext()

  const sections = [
    {
      title: "Program Selection",
      step: 1,
      payload: state.data.preApp,
    },
    {
      title: "Primary Applicant & Household Setup",
      step: 2,
      payload: {
        contact: state.data.contact,
        assisterEnabled: state.data.assisterEnabled,
        assister: state.data.assister,
      },
    },
    {
      title: "Household Members",
      step: 3,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        identity: index === 0 ? "Person 1 identity comes from Step 2" : person.identity,
      })),
    },
    {
      title: "Demographics & SSN",
      step: 4,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        demographics: person.demographics,
        ssn: person.ssn,
      })),
    },
    {
      title: "Tax Filing",
      step: 5,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        tax: person.tax,
      })),
    },
    {
      title: "Coverage & Eligibility",
      step: 6,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        coverage: person.coverage,
      })),
    },
    {
      title: "Income & Deductions",
      step: 7,
      payload: state.data.persons.map((person, index) => ({
        person: index + 1,
        income: person.income,
      })),
    },
  ]

  if (reviewMode === "edit") {
    return (
      <StepContainer title="Review PDF (Edit Mode)" description="Choose a section to edit, then save to regenerate the PDF preview.">
        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={`review-edit-${section.step}`}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription>Step {section.step}</CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onGoToStep(section.step)}>
                  Edit
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="max-h-44 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(section.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={async () => {
              const success = await onGeneratePdf()
              if (success) {
                onSetReviewMode("pdf")
              }
            }}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                Saving...
              </span>
            ) : (
              "Save & Regenerate PDF"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => onSetReviewMode("pdf")}>
            Cancel
          </Button>
        </div>
      </StepContainer>
    )
  }

  return (
    <StepContainer
      title="Review PDF"
      description="Preview the filled ACA-03 PDF. Click Edit to change data, then Save to regenerate this preview."
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onSetReviewMode("edit")}>
          Edit
        </Button>
        <Button type="button" variant="outline" onClick={onGeneratePdf} disabled={isGeneratingPdf}>
          {isGeneratingPdf ? "Regenerating..." : "Regenerate PDF"}
        </Button>
        {pdfUrl ? (
          <Button type="button" variant="outline" asChild>
            <a href={pdfUrl} download="aca-3-0325-filled.pdf">
              Download PDF
            </a>
          </Button>
        ) : null}
        <Button type="button" onClick={onValidate} disabled={isGeneratingPdf || !pdfUrl || pdfStale}>
          Validate
        </Button>
      </div>

      {pdfStale ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">
          Form data changed. Regenerate the PDF before validation.
        </div>
      ) : null}

      {pdfError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {pdfError}
        </div>
      ) : null}

      {!pdfUrl && !isGeneratingPdf ? (
        <Button type="button" onClick={onGeneratePdf}>
          Generate PDF Preview
        </Button>
      ) : null}

      {isGeneratingPdf ? <p className="text-sm text-muted-foreground">Generating PDF preview...</p> : null}

      {pdfUrl ? (
        <div className="overflow-hidden rounded-md border">
          <iframe
            title="ACA-03 PDF preview"
            src={`${pdfUrl}#navpanes=0&view=FitH&zoom=page-fit`}
            className="h-[calc(100vh-220px)] min-h-[720px] w-full"
          />
        </div>
      ) : null}
    </StepContainer>
  )
}

function getEngineRuleFixTarget(ruleId: string): { step: number; label: string } | null {
  const map: Record<string, { step: number; label: string }> = {
    RULE_01_RESIDENCY: { step: 6, label: "Coverage & Eligibility" },
    RULE_02_IDENTITY: { step: 4, label: "Demographics & SSN" },
    RULE_03_CITIZENSHIP: { step: 6, label: "Coverage & Eligibility" },
    RULE_07_TAX_FILING: { step: 5, label: "Tax Filing" },
    RULE_08_PREGNANCY: { step: 6, label: "Coverage & Eligibility" },
    RULE_09_AGE: { step: 2, label: "Primary Applicant" },
    RULE_10_PROGRAM: { step: 7, label: "Income & Deductions" },
    RULE_11_OTHER_INSURANCE: { step: 6, label: "Coverage & Eligibility" },
    RULE_12_DISABILITY: { step: 6, label: "Coverage & Eligibility" },
    RULE_13_VERIFICATION: { step: 4, label: "Demographics & SSN" },
    RULE_14_FINAL_DECISION: { step: 8, label: "Review PDF" },
  }

  return map[ruleId] ?? null
}

function ValidateAndSubmitStep({ onBackToReview, onGoToStep }: ValidateAndSubmitStepProps) {
  const { state, dispatch, applicationId, saveDraftNow } = useFormContext()
  const reduxDispatch = useAppDispatch()
  const validateStep = useStepValidation()
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
        const eligibilityInput = mapWizardToEligibilityInput(state.data)
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
  const canSubmit = hasRunValidation && !hasBlockingErrors && !statusBlocksSubmission && state.data.attestation
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

      <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
        <Checkbox
          checked={state.data.attestation}
          onCheckedChange={(checked) =>
            dispatch({ type: "set_attestation", payload: Boolean(checked) })
          }
        />
        <span>I attest that the information provided is true and complete to the best of my knowledge.</span>
      </label>

      <Button
        type="button"
        className="w-full"
        disabled={!canSubmit || state.submitted}
        onClick={() => {
          setSubmitAcknowledged(false)
          setSubmitDialogOpen(true)
        }}
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
  const { state, dispatch, saveDraftNow } = useFormContext()
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
  const [isSavingExit, setIsSavingExit] = useState(false)
  const [saveExitError, setSaveExitError] = useState<string | null>(null)
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
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [state.currentStep, currentStepActiveTab])

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])

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

  const handleSaveAndExit = useCallback(async () => {
    setIsSavingExit(true)
    setSaveExitError(null)

    const snapshot: WizardState = {
      ...state,
      errors: {},
      dirty: false,
    }
    const saved = await saveDraftNow(snapshot)
    if (!saved) {
      setSaveExitError("Unable to save to database. Please try again.")
      setIsSavingExit(false)
      return
    }

    dispatch({ type: "set_dirty", payload: false })
    router.push("/customer/dashboard")
  }, [dispatch, router, saveDraftNow, state])

  return (
    <WizardLayout
      steps={steps}
      currentStep={state.currentStep}
      title={STEP_METADATA[state.currentStep - 1]?.title ?? "ACA-03 Wizard"}
      contentClassName="max-w-5xl"
    >
      <div className="space-y-6">
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
            <Button type="button" variant="outline" onClick={() => void handleSaveAndExit()} disabled={isSavingExit}>
              {isSavingExit ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4" />
                  Saving...
                </span>
              ) : (
                "Save & Exit"
              )}
            </Button>

            {showGlobalNext && !isLastStep ? (
              <Button type="button" onClick={handleNext} disabled={!canProceedCurrentStep}>
                Next
              </Button>
            ) : null}
          </div>
        </div>

        {saveExitError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {saveExitError}
          </div>
        ) : null}
      </div>
    </WizardLayout>
  )
}

export function FormWizard({ applicationId }: { applicationId?: string }) {
  return (
    <FormProvider applicationId={applicationId}>
      <FormWizardBody />
    </FormProvider>
  )
}
