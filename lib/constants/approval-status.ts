/**
 * Shared constants for the three-state approval workflow:
 * pending → approved | rejected.
 *
 * Used by admin/social-workers, admin/companies, and any future
 * entity that follows the same approval lifecycle.
 *
 * @author Bin Lee
 */

import type { SelectOption } from "../types/common"

/** Filter options for approval-status dropdowns (includes "All" catch-all). */
export const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

/** Tailwind badge colours keyed by approval status value. */
export const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
}

/** Valid filter values (excludes the empty "All" sentinel). */
export const VALID_STATUS_FILTERS = new Set(["pending", "approved", "rejected"])
