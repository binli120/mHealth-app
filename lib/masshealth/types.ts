/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

/**
 * Shared type definitions for the MassHealth chat and eligibility modules.
 */

import type { SupportedLanguage } from "@/lib/i18n/languages"

// ── Chat ──────────────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system"

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

// ── ACA-3-AP eligibility ──────────────────────────────────────────────────────

/**
 * Input for evaluating whether an additional person qualifies to be added
 * to an existing ACA-3 household case.
 */
export interface Aca3ApEligibilityApplicantInput {
  applicantId: string
  /** Age of the additional person being added. */
  age: number
  /** Whether the additional person is a Massachusetts resident. */
  maResident: boolean
  citizenshipStatus: CitizenshipStatus
  /** Whether the additional person is being added to an existing case (should always be true). */
  addingToExistingCase: boolean
  /** Size of the existing household BEFORE adding this person. */
  existingHouseholdSize: number
  pregnant: boolean
  unbornChildren: number
  disabled: boolean
  medicalVerification: boolean
  hasOtherInsurance: boolean
  income: EligibilityIncomeInput
  identityVerified: boolean
  verification: {
    ssnVerified: boolean
    incomeVerified: boolean
    immigrationVerified: boolean
  }
}

export interface Aca3ApEligibilityResult {
  applicant_id: string
  /** Household size after adding this person. */
  new_household_size: number
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
    | "REDIRECT_SACA2"
  required_documents: string[]
  findings: EligibilityFinding[]
  rule_results: EligibilityRuleResult[]
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

// ── Income Verification ───────────────────────────────────────────────────────

/**
 * Income source categories, aligned with MassHealth acceptable verifications list.
 */
export type IncomeSourceType =
  | "employment"
  | "self_employment"
  | "tax_return"
  | "w2"
  | "form_1099"
  | "unemployment"
  | "social_security"
  | "pension_annuity"
  | "rental"
  | "interest_dividend"
  | "zero_income"

/**
 * Accepted document types for income verification.
 * Maps to MassHealth forms and acceptable verifications list.
 */
export type IncomeDocType =
  | "pay_stub"
  | "employer_statement"
  | "tax_return"
  | "w2"
  | "form_1099"
  | "profit_loss_statement"
  | "self_employment_form"
  | "unemployment_letter"
  | "social_security_letter"
  | "pension_statement"
  | "rental_agreement"
  | "interest_statement"
  | "zero_income_affidavit"
  | "attestation_form"

/** Per-source verification status after deterministic rule evaluation. */
export type IncomeVerificationStatus =
  | "verified"
  | "needs_clarification"
  | "needs_additional_document"
  | "manual_review"
  | "attested_pending_review"
  | "pending"

/** Aggregate case-level status. */
export type IncomeVerificationCaseStatus =
  | "pending_documents"
  | "in_review"
  | "verified"
  | "rfi_sent"
  | "manual_review"

/**
 * Per-member, per-source document requirement.
 * Built by buildEvidenceRequirements() from household income data.
 */
export interface IncomeEvidenceRequirement {
  id: string
  memberId: string
  memberName: string
  incomeSourceType: IncomeSourceType
  acceptedDocTypes: IncomeDocType[]
  isRequired: boolean
  verificationStatus: IncomeVerificationStatus
}

/** Document record associated with an income source. */
export interface IncomeDocumentRecord {
  id: string
  applicationId: string
  memberId: string
  docTypeClaimed: IncomeDocType
  storageKey: string
  mimeType: string
  uploadedAt: string
  jobId: string
  extractionStatus: "pending" | "processing" | "complete" | "failed"
}

/**
 * Structured fields extracted from an income document by the LLM/OCR layer.
 * The model must not set incomeVerified; only the deterministic engine does.
 */
export interface IncomeDocumentExtraction {
  documentId: string
  docType: IncomeDocType | null
  issuer: string | null
  personName: string | null
  employerName: string | null
  dateRangeStart: string | null
  dateRangeEnd: string | null
  grossAmount: number | null
  netAmount: number | null
  /** Normalized pay period as reported in the document. */
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "annual" | null
  incomeSourceType: IncomeSourceType | null
  /** 0–1 extraction confidence from the model. */
  confidence: number
  needsManualReview: boolean
  reasons: string[]
  modelVersion: string
}

/** Reviewer or engine decision on a single income source for one member. */
export interface IncomeVerificationDecision {
  id: string
  memberId: string
  sourceType: IncomeSourceType
  status: IncomeVerificationStatus
  matchedAmount: number | null
  matchedFrequency: string | null
  reviewerId: string | null
  reasonCode: string
  decidedAt: string
}

/** Aggregate verification case for an application. */
export interface IncomeVerificationCase {
  applicationId: string
  status: IncomeVerificationCaseStatus
  requiredSourceCount: number
  verifiedSourceCount: number
  decisionReason: string | null
  requirements: IncomeEvidenceRequirement[]
  decisions: IncomeVerificationDecision[]
  /** True only when ALL required income sources are verified by evidence rules. */
  incomeVerified: boolean
}

/** RFI event requesting missing income proof from the applicant. */
export interface IncomeRfiEvent {
  id: string
  applicationId: string
  reasonCode: string
  requestedDocs: IncomeDocType[]
  sentAt: string
  resolvedAt: string | null
}

// ── Income Verification API contracts ────────────────────────────────────────

export interface IncomeChecklistMember {
  memberId: string
  memberName: string
  /** Income source types reported by the household member during intake. */
  incomeSources: IncomeSourceType[]
  hasIncome: boolean
}

export interface IncomeChecklistRequest {
  applicationId: string
  householdMembers: IncomeChecklistMember[]
}

export interface IncomeChecklistResponse {
  applicationId: string
  requirements: IncomeEvidenceRequirement[]
  caseStatus: IncomeVerificationCaseStatus
}

export interface IncomeDocumentUploadResponse {
  jobId: string
  documentId: string
  status: "queued" | "processing"
}

/**
 * Strict JSON schema the LLM extractor must emit.
 * The engine, not the model, decides legal sufficiency.
 */
export interface IncomeExtractionResult {
  docType: IncomeDocType | null
  issuer: string | null
  personName: string | null
  employerName: string | null
  dateRangeStart: string | null
  dateRangeEnd: string | null
  grossAmount: number | null
  netAmount: number | null
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "annual" | null
  incomeSourceType: IncomeSourceType | null
  confidence: number
  needsManualReview: boolean
  reasons: string[]
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
