/**
 * Constants for the Admin Analytics page.
 * @author Bin Lee
 */

export const DRILL_DOWN_PAGE_SIZE = 20

export const PERIOD_OPTIONS = [
  { label: "3 months", value: 3 },
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
]

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  ai_extracted: "AI Extracted",
  needs_review: "Needs Review",
  rfi_requested: "RFI Requested",
  approved: "Approved",
  denied: "Denied",
}
