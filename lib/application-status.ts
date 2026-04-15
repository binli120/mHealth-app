/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
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

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  ai_extracted: "AI Extracted",
  needs_review: "Needs Review",
  rfi_requested: "RFI Requested",
  approved: "Approved",
  denied: "Denied",
}

export const APPLICATION_STATUS_BADGE_STYLES: Record<ApplicationStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  ai_extracted: "bg-purple-100 text-purple-700",
  needs_review: "bg-amber-100 text-amber-700",
  rfi_requested: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
}

export const APPLICATION_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...APPLICATION_STATUSES.map((status) => ({
    value: status,
    label: APPLICATION_STATUS_LABELS[status],
  })),
] as const

export const APPLICATION_STATUS_SET = new Set<string>(APPLICATION_STATUSES)
