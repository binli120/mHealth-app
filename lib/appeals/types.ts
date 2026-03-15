export type DenialReasonId =
  | "missing_disability_proof"
  | "income_exceeds_limit"
  | "residency_not_verified"
  | "citizenship_immigration"
  | "age_not_eligible"
  | "already_enrolled"
  | "missing_documentation"
  | "ssn_not_verified"
  | "other"

export interface DenialReasonOption {
  id: DenialReasonId
  label: string
  description: string
}

export interface AppealRequest {
  denialReasonId: DenialReasonId
  denialDetails: string
  /** Text extracted from an uploaded denial letter (image OCR or PDF fields) */
  documentText?: string
}

export interface AppealAnalysis {
  explanation: string
  appealLetter: string
  evidenceChecklist: string[]
}
