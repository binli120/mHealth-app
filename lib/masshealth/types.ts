/**
 * Shared type definitions for the MassHealth chat and eligibility modules.
 */

import type { SupportedLanguage } from "@/lib/i18n/languages"

// ── Chat ──────────────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  role: ChatRole
  content: string
}

// ── Knowledge / FAQ ───────────────────────────────────────────────────────────

export interface MassHealthLink {
  label: string
  url: string
}

export interface MassHealthFaqItem {
  id: string
  question: string
  quickAnswer: string
  links: MassHealthLink[]
}

// ── ACA-3 form — answer type map ──────────────────────────────────────────────

/**
 * Maps raw answer_type strings from the ACA-3 JSON to the typed input kinds
 * used by the UI.  Defined as a const object (not an enum) so the values are
 * plain strings at runtime and can be compared with === without any import issues.
 */
export const AnswerType = {
  Text:          "text",
  TextOrUnknown: "text_or_unknown",
  YesNo:         "yes_no",
  Date:          "date",
  SingleChoice:  "single_choice",
  MultiChoice:   "multi_choice",
} as const

export type AnswerTypeValue = (typeof AnswerType)[keyof typeof AnswerType]

// ── Ollama internal ───────────────────────────────────────────────────────────

/** Raw response shape from Ollama /api/chat endpoint (used internally by fact-extraction). */
export interface OllamaResponse {
  message?: { content?: string }
}

// ── ACA-3 eligibility ─────────────────────────────────────────────────────────

/**
 * ACA-3 citizenship/immigration status values (uppercase).
 * Note: distinct from `CitizenshipStatus` in `@/lib/eligibility-engine`,
 * which uses lowercase values like "citizen" | "qualified_immigrant".
 */
export type CitizenshipStatus =
  | "US_CITIZEN"
  | "NATIONAL"
  | "QUALIFIED_NONCITIZEN"
  | "LEGAL_PERMANENT_RESIDENT"
  | "REFUGEE"
  | "ASYLEE"
  | "TPS"
  | "UNDOCUMENTED"

export interface EligibilityIncomeInput {
  wages?: number
  selfEmployment?: number
  unemployment?: number
  socialSecurityTaxable?: number
  rentalIncome?: number
  interest?: number
  pension?: number
  childSupport?: number
  veteransBenefits?: number
  supplementalSecurityIncome?: number
}

export interface Aca3EligibilityApplicantInput {
  applicantId: string
  age: number
  stateResident: string
  identityVerified: boolean
  citizenshipStatus: CitizenshipStatus
  married: boolean
  taxDependents: number
  taxFiler: boolean
  pregnant: boolean
  unbornChildren: number
  disabled: boolean
  medicalVerification: boolean
  hasOtherInsurance: boolean
  income: EligibilityIncomeInput
  verification: {
    ssnVerified: boolean
    incomeVerified: boolean
    immigrationVerified: boolean
  }
}

export type EligibilityFindingLevel = "error" | "warning" | "info" | "success"

export interface EligibilityFinding {
  code: string
  level: EligibilityFindingLevel
  message: string
}

export type EligibilityRuleStatus = "pass" | "fail" | "warning"

export interface EligibilityRuleResult {
  id: string
  label: string
  status: EligibilityRuleStatus
  message: string
}

export interface Aca3EligibilityResult {
  applicant_id: string
  household_size: number
  income: number
  fpl_percent: number
  eligible_program: string
  status:
    | "APPROVED"
    | "DENIED"
    | "LIMITED_COVERAGE"
    | "PENDING_VERIFICATION"
    | "PENDING_DOCUMENTS"
    | "TPL_REQUIRED"
    | "REDIRECT_ACA2"
  required_documents: string[]
  findings: EligibilityFinding[]
  rule_results: EligibilityRuleResult[]
}

// ── ACA-3 form — question types ───────────────────────────────────────────────

export type Aca3QuestionInputType =
  | "text"
  | "date"
  | "yes_no"
  | "single_choice"
  | "multi_choice"

export type Aca3WorkflowStep = 1 | 2 | 3 | 4 | 5

export type Aca3QuestionResponseValue = string | string[]
export type Aca3QuestionResponses = Record<string, Aca3QuestionResponseValue>

export interface Aca3RequiredQuestion {
  key: string
  page: number
  section: string
  questionId: string
  questionText: string
  inputType: Aca3QuestionInputType
  options: string[]
  workflowStep: Aca3WorkflowStep
}

export interface Aca3RequiredQuestionSection {
  id: string
  title: string
  questions: Aca3RequiredQuestion[]
}

// ── Application types ─────────────────────────────────────────────────────────

export type MassHealthApplicationType = "aca3" | "aca3ap" | "saca2" | "msp"

export interface MassHealthApplicationTypeOption {
  id: MassHealthApplicationType
  title: string
  shortLabel: string
  description: string
  formCode: string
  referenceUrl: string
}

// ── Extract workflow ──────────────────────────────────────────────────────────

export interface ExtractWorkflowPayload {
  userId: string
  file: File
}

// ── Extract auto ──────────────────────────────────────────────────────────────

export type ExtractAutoPdfType = "electronic_filled" | "electronic_blank" | "scanned" | "mixed"
export type ExtractAutoMethod = "workflow" | "structured"

export interface ExtractAutoScan {
  pdf_type: ExtractAutoPdfType
  [key: string]: unknown
}

export interface ExtractAutoResultWorkflow {
  workflow_data: Record<string, unknown>
  [key: string]: unknown
}

export interface ExtractAutoResultStructured {
  sections: unknown[]
  pages: unknown[]
  [key: string]: unknown
}

export type ExtractAutoResult = ExtractAutoResultWorkflow | ExtractAutoResultStructured

export interface ExtractAutoResponse {
  scan: ExtractAutoScan
  extraction_method: ExtractAutoMethod
  result: ExtractAutoResult
  ocr_page_count?: number
  [key: string]: unknown
}

export interface ExtractAutoPayload {
  userId: string
  file: File
  documentType?: string
}

export interface ExtractWorkflowResponse {
  status: string
  user_id: string
  source_pdf: string
  application?: string
  detected_form_variant?: string
  workflow_json_path?: string
  workflow_data: Record<string, unknown>
  extraction?: {
    engine?: string
    extraction_method?: string
    page_count_processed?: number
    warnings?: string[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

// ── Household relationships ───────────────────────────────────────────────────

export interface HouseholdRelationshipHint {
  relationship: string
  memberName?: string
}

// ── Knowledge center ──────────────────────────────────────────────────────────

export interface KnowledgeVideo {
  id: string
  title: string
  description: string
  youtubeId: string
  youtubeUrl: string
  sourceUrl: string
  availableLanguages: SupportedLanguage[]
}

export interface KnowledgeArticle {
  id: string
  title: string
  description: string
  url: string
}

export interface KnowledgeDocument {
  id: string
  title: string
  description: string
  url: string
}
