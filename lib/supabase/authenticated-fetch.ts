/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { getSafeSupabaseSession } from "@/lib/supabase/client"

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const { session, error } = await getSafeSupabaseSession()
  if (error) {
    throw new Error(error)
  }

  const accessToken = session?.access_token
  if (!accessToken) {
    throw new Error("You must be signed in to continue.")
  }

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${accessToken}`)

  // Set JSON content type automatically when body is a plain string
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return fetch(input, {
    ...init,
    headers,
  })
}
