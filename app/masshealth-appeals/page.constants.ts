/**
 * Constants for the MassHealth Appeals page.
 * @author Bin Lee
 */

import type { TrustTier } from "./page.types"

export const LOGIN_PATH = "/auth/login"
export const THIS_PATH = "/masshealth-appeals"
export const PDF_MIME_TYPE = "application/pdf"

export const TRUST_TIER_CLASSES: Record<TrustTier, string> = {
  official: "bg-blue-100 text-blue-800",
  legal_aid: "bg-emerald-100 text-emerald-800",
  community: "bg-amber-100 text-amber-800",
}
