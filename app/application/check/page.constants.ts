/**
 * Constants for the Check Application page.
 * @author Bin Lee
 */

import type { CheckSeverity } from "@/lib/masshealth/application-checks"

export const CHECK_CATEGORY_LABELS: Record<string, string> = {
  income_consistency: "Income Consistency",
  ssn_coverage: "Social Security Numbers",
  immigration_status: "Immigration Status",
  form_supplements: "Required Supplements",
  age_thresholds: "Age & Program Thresholds",
}

export const SEVERITY_STYLES: Record<CheckSeverity, { row: string; badge: string; label: string }> = {
  error: {
    row: "border-destructive/40 bg-destructive/5",
    badge: "bg-destructive/15 text-destructive",
    label: "Error",
  },
  warning: {
    row: "border-warning/40 bg-warning/5",
    badge: "bg-warning/15 text-warning",
    label: "Warning",
  },
  info: {
    row: "border-blue-500/30 bg-blue-500/5",
    badge: "bg-blue-500/15 text-blue-600",
    label: "Info",
  },
}
