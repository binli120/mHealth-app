/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Utilities for the MassHealth Appeals page.
 * @author: Bin Lee
 */

import { getSafeSupabaseSession } from "@/lib/supabase/client"
import { TRUST_TIER_CLASSES } from "./page.constants"
import type { TrustTier } from "./page.types"
import type { AppealCategoryEntry } from "@/lib/masshealth/appeal-categories"

// ── Categories API payload parsing ───────────────────────────────────────────

export interface CategoriesPayload {
  categories?: AppealCategoryEntry[]
  degraded?: boolean
  warning?: string
}

export function readCategoriesPayload(payload: unknown): CategoriesPayload {
  if (Array.isArray(payload)) {
    return { categories: payload as AppealCategoryEntry[], degraded: false }
  }
  if (payload && typeof payload === "object") {
    const body = payload as CategoriesPayload
    return {
      categories: Array.isArray(body.categories) ? body.categories : [],
      degraded: body.degraded === true,
      warning: typeof body.warning === "string" ? body.warning : undefined,
    }
  }
  return { categories: [] }
}

/** Thrown when there is no valid session for an authenticated appeal request. */
export class AuthNeededError extends Error {
  constructor() {
    super("auth-needed")
  }
}

export async function masshealthFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { session, error } = await getSafeSupabaseSession()
  if (error || !session) throw new AuthNeededError()

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${session.access_token}`)
  headers.set("user-id", session.user.id)
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return fetch(url, { ...init, headers })
}

export function getTrustTierBadgeClass(tier: string): string {
  return TRUST_TIER_CLASSES[tier as TrustTier] ?? "bg-gray-100 text-gray-700"
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function formatAppealDraftFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
