/**
 * Utility functions for the Admin Social Workers page.
 * @author Bin Lee
 */

import { VALID_STATUS_FILTERS } from "./page.constants"

// fullName logic is shared across all person-like entities — lives in lib.
export { fullName } from "@/lib/utils/person-name"

export function initialStatusFromSearchParams(searchParams: URLSearchParams): string {
  const s = searchParams.get("status") ?? ""
  return VALID_STATUS_FILTERS.has(s) ? s : ""
}
