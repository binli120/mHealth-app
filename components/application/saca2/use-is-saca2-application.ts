/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useEffect, useState } from "react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  getApplicationTypeBaseForm,
  isMassHealthApplicationType,
} from "@/lib/masshealth/application-types"

/** "error" = the draft could not be checked; callers must NOT fall through to the ACA-3 flow. */
export type Saca2Lookup = "saca2" | "other" | "unknown" | "error"

function classify(type: string | null | undefined): Saca2Lookup {
  if (!type) return "other"
  if (!isMassHealthApplicationType(type)) return "other"
  return getApplicationTypeBaseForm(type) === "saca2" ? "saca2" : "other"
}

/**
 * Is this application a SACA-2? Redux is not persisted, so after a reload the type
 * is unknown client-side; fall back to the server draft once.
 */
export function useIsSaca2Application(
  applicationId: string | undefined,
  reduxApplicationType: string,
  actingForPatientId?: string,
): Saca2Lookup {
  const [fetched, setFetched] = useState<{ id: string; result: Saca2Lookup } | null>(null)
  const needsLookup = Boolean(applicationId) && !reduxApplicationType

  useEffect(() => {
    if (!needsLookup || !applicationId) return
    let cancelled = false
    const headers: Record<string, string> = {}
    if (actingForPatientId) headers["X-Acting-For-Patient"] = actingForPatientId

    // Promise.resolve().then(...) also turns a synchronous throw from the fetch helper
    // into a rejection, so the page falls back to "other" instead of crashing.
    Promise.resolve()
      .then(() =>
        authenticatedFetch(`/api/applications/${applicationId}/draft`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(6_000),
        }),
      )
      .then(async (res): Promise<Saca2Lookup> => {
        // No draft yet (404) is a genuinely new application. Anything else that is not a
        // confirmed answer (timeout, 5xx, 401, bad body) must not default to the ACA-3 flow.
        if (res.status === 404) return "other"
        if (!res.ok) return "error"
        const data = (await res.json()) as { ok: boolean; record?: { applicationType: string | null } }
        if (!data.ok) return "error"
        return classify(data.record?.applicationType)
      })
      .then((result) => {
        if (!cancelled) setFetched({ id: applicationId, result })
      })
      .catch(() => {
        if (!cancelled) setFetched({ id: applicationId, result: "error" })
      })

    return () => {
      cancelled = true
    }
  }, [needsLookup, applicationId, actingForPatientId])

  if (!applicationId) return "other"
  if (reduxApplicationType) return classify(reduxApplicationType)
  return fetched?.id === applicationId ? fetched.result : "unknown"
}
