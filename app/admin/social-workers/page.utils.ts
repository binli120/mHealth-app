/**
 * Utility functions for the Admin Social Workers page.
 * @author Bin Lee
 */

import type { SocialWorker } from "./page.types"
import { VALID_STATUS_FILTERS } from "./page.constants"

export function initialStatusFromSearchParams(searchParams: URLSearchParams): string {
  const s = searchParams.get("status") ?? ""
  return VALID_STATUS_FILTERS.has(s) ? s : ""
}

export function fullName(w: SocialWorker): string {
  return [w.first_name, w.last_name].filter(Boolean).join(" ") || "—"
}
