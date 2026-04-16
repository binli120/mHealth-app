/**
 * TypeScript types for the MassHealth Appeals page.
 * @author Bin Lee
 */

export interface CategoryEntry {
  code: string
  label: string
  description: string
  notice_keywords: string[]
  evidence_needed: string[]
  argument_themes: string[]
  missing_info_questions: string[]
}

export interface MatchedCategory {
  code: string
  label: string
  score: number
  rationale: string
}

export type TrustTier = "official" | "legal_aid" | "community"

export interface TopSource {
  source_id: string
  title: string
  url: string
  source_type: string
  trust_tier: TrustTier
  score: number
  summary: string
  key_points: string[]
}

export interface ResearchResult {
  status: string
  matched_categories: MatchedCategory[]
  evidence_checklist: string[]
  argument_themes: string[]
  missing_information_questions: string[]
  top_sources: TopSource[]
  grounding_warnings: string[]
}

export interface DraftCitation {
  source_id: string
  title: string
  trust_tier: string
  excerpt: string
}

export interface DraftResult {
  status: string
  letter_text: string
  citations: DraftCitation[]
  model_used: string
  error: string
}

export type PageState =
  | "form"
  | "researching"
  | "research_results"
  | "drafting"
  | "draft_result"
  | "error"

export interface PrefilledAppealFields {
  applicantName: string
  contactInformation: string
  householdSummary: string
}
