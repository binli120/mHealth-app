/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

export const APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "ai_extracted",
  "needs_review",
  "rfi_requested",
  "approved",
  "denied",
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_STATUS_SET = new Set<string>(APPLICATION_STATUSES)
