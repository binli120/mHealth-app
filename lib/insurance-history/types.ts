// lib/insurance-history/types.ts

export type CoverageSource = 'platform' | 'self_reported' | 'document_extracted'
export type ExplanationGeneratedBy = 'rules' | 'llm'

export interface CoverageRecord {
  id: string
  userId: string
  coverageYear: number
  planName: string
  programCode: string | null
  premiumMonthly: number | null
  householdSize: number | null
  annualIncome: number | null
  fplPercent: number | null
  source: CoverageSource
  applicationId: string | null
  documentId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface InsuranceExplanation {
  id: string
  coverageRecordId: string
  priorRecordId: string | null
  changeFactors: ChangeFactor
  explanationText: string
  generatedBy: ExplanationGeneratedBy
  generatedAt: string
}

export interface ChangeFactor {
  incomeDelta: number | null
  householdDelta: number | null
  fplDelta: number | null
  programChange: { from: string | null; to: string | null } | null
  gainedEmployer: boolean
  lostEmployer: boolean
  pregnancy: boolean
  medicare: boolean
}

export interface CoverageRecordWithExplanation {
  record: CoverageRecord
  explanation: InsuranceExplanation | null
}
