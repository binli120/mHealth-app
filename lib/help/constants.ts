/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

export const HELP_CATEGORIES = [
  'eligibility',
  'benefits_coverage',
  'applications_appeals',
  'platform_help',
  'other',
] as const

export type HelpCategory = (typeof HELP_CATEGORIES)[number]

export const HELP_CATEGORY_LABELS: Record<HelpCategory, string> = {
  eligibility: 'Eligibility',
  benefits_coverage: 'Benefits & Coverage',
  applications_appeals: 'Applications & Appeals',
  platform_help: 'Platform Help',
  other: 'Other',
}

export const HELP_STORAGE_PREFIX = 'help'
export const HELP_QUESTION_RATE_LIMIT = { limit: 5,  windowMs: 60 * 60 * 1000 } // 5/hr
export const HELP_ANSWER_RATE_LIMIT   = { limit: 20, windowMs: 60 * 60 * 1000 } // 20/hr

export const WHISPER_TRANSCRIPT_PREFIX = '\n\n[Voice transcript]: '
export const SIMILARITY_THRESHOLD = 0.75
export const SIMILAR_QUESTIONS_LIMIT = 3
