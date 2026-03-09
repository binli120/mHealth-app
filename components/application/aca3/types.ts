import type { Dispatch } from "react"
import type { ConditionalRule } from "@/hooks/use-conditional"
import type { EligibilityFinding, EligibilityRuleResult } from "@/lib/masshealth/aca3-eligibility-engine"

export type Scalar = string | number | boolean | null

export type FieldValue = Scalar | string[] | Record<string, unknown> | Array<Record<string, unknown>>

export type FormRecord = Record<string, FieldValue>

export interface SchemaField {
  id: string
  label: string
  hint?: string
  type:
    | "text"
    | "textarea"
    | "date"
    | "email"
    | "phone"
    | "zip"
    | "number"
    | "currency"
    | "ssn"
    | "radio"
    | "checkbox"
    | "checkbox_group"
    | "select"
    | "address_group"
    | "repeatable_group"
    | "income_checklist"
    | "deduction_checklist"
  required?: boolean
  optional?: boolean
  value?: unknown
  options?: string[]
  max_select?: number
  show_if?: ConditionalRule
  required_if?: ConditionalRule | boolean
  applicable_from_person?: number
  validation?: {
    min?: number
    max?: number
  }
  fields?: Record<string, SchemaField>
  sub_fields?: Record<string, SchemaField[]>
  group_schema?: SchemaField[]
  max_entries?: number
  items?: Array<{
    id: string
    label: string
    extra_fields?: string[]
    extra_hint?: string
  }>
  item_schema?: Record<string, unknown>
}

export interface SchemaSection {
  section_id?: string
  sub_section_id?: string
  title: string
  description?: string
  optional?: boolean
  fields: SchemaField[]
}

export interface AcaSchema {
  pre_application: SchemaSection
  step1_contact: SchemaSection
  enrollment_assister: SchemaSection
  person_schema: {
    sub_sections: SchemaSection[]
  }
}

export type PersonSectionKey = "identity" | "demographics" | "ssn" | "tax" | "coverage" | "income"

export interface PersonState {
  identity: FormRecord
  demographics: FormRecord
  ssn: FormRecord
  tax: FormRecord
  coverage: FormRecord
  income: FormRecord
  skippedOptional: Record<string, boolean>
}

export interface WizardData {
  preApp: FormRecord
  contact: FormRecord
  assister: FormRecord
  assisterEnabled: boolean
  persons: PersonState[]
  attestation: boolean
}

export interface WizardState {
  data: WizardData
  currentStep: number
  completedSteps: number[]
  tabByStep: Record<number, number>
  errors: Record<string, string>
  dirty: boolean
  submitted: boolean
}

export type WizardAction =
  | { type: "hydrate"; payload: WizardState }
  | { type: "set_step"; payload: number }
  | { type: "mark_step_complete"; payload: number }
  | { type: "set_root_field"; payload: { scope: "preApp" | "contact" | "assister"; fieldId: string; value: FieldValue } }
  | { type: "set_assister_enabled"; payload: boolean }
  | { type: "set_person_count"; payload: number }
  | {
      type: "set_person_field"
      payload: {
        personIndex: number
        section: PersonSectionKey
        fieldId: string
        value: FieldValue
      }
    }
  | {
      type: "set_person_optional_skip"
      payload: {
        personIndex: number
        sectionId: string
        value: boolean
      }
    }
  | { type: "set_tab"; payload: { step: number; tab: number } }
  | { type: "set_errors"; payload: Record<string, string> }
  | { type: "clear_errors" }
  | { type: "set_attestation"; payload: boolean }
  | { type: "set_submitted"; payload: boolean }
  | { type: "set_dirty"; payload: boolean }

export interface FormContextValue {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  applicationId: string
  saveDraftNow: (overrideState?: WizardState) => Promise<boolean>
}

export interface DependentEntry {
  name: string
  dob: string
}

export interface FieldRendererProps {
  field: SchemaField
  formValues: Record<string, unknown>
  getValue: (fieldId: string) => unknown
  setValue: (fieldId: string, value: FieldValue) => void
  errors: Record<string, string>
  errorPrefix: string
  personNumber?: number
  onSkipOptionalSection?: () => void
  addressSiblingFieldIds?: {
    streetId?: string
    cityId?: string
    stateId?: string
    zipId?: string
  }
}

export interface AddressValidationSuggestion {
  streetAddress: string
  city: string
  state: string
  zipCode: string
  county: string
  displayName: string
  latitude: string
  longitude: string
}

export interface AddressValidationResponse {
  ok: boolean
  valid: boolean
  message?: string
  error?: string
  suggestion?: AddressValidationSuggestion
}

export interface AddressGroupFieldProps {
  field: SchemaField
  formValues: Record<string, unknown>
  getValue: (fieldId: string) => unknown
  setValue: (fieldId: string, value: FieldValue) => void
  errors: Record<string, string>
  errorPrefix: string
  personNumber?: number
  errorKey: string
}

export interface ValidationParams {
  fields: SchemaField[]
  values: Record<string, unknown>
  getValue: (fieldId: string) => unknown
  errors: Record<string, string>
  errorPrefix: string
  personNumber?: number
}

export interface ReviewPdfStepProps {
  reviewMode: "pdf" | "edit"
  onSetReviewMode: (mode: "pdf" | "edit") => void
  pdfUrl: string | null
  pdfError: string | null
  isGeneratingPdf: boolean
  pdfStale: boolean
  onGeneratePdf: () => Promise<boolean>
  onGoToStep: (step: number) => void
  onValidate: () => void
}

export interface ValidateAndSubmitStepProps {
  onBackToReview: () => void
  onGoToStep: (step: number) => void
}

export type ValidationPanelFinding = EligibilityFinding & {
  source: "precheck" | "engine"
}

export type RuleRunDisplayStatus = "pending" | "running" | "pass" | "fail" | "warning"

export interface AnimatedRuleResult extends EligibilityRuleResult {
  source: "precheck" | "engine"
  runtimeStatus: RuleRunDisplayStatus
  fixStep?: number
  fixLabel?: string
}

export interface StepContentProps {
  step: number
  reviewMode: "pdf" | "edit"
  onSetReviewMode: (mode: "pdf" | "edit") => void
  pdfUrl: string | null
  pdfError: string | null
  isGeneratingPdf: boolean
  pdfStale: boolean
  onGeneratePdf: () => Promise<boolean>
  onGoToStep: (step: number) => void
  onValidateStep: () => void
}
