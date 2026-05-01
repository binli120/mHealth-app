/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js"

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    )
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

  // ── Eager stale-session recovery ──────────────────────────────────────────
  // The Supabase SDK schedules a background auto-refresh as soon as the client
  // is created.  If localStorage holds an expired / invalid refresh token (e.g.
  // after a DB reset or a long time between logins), that background refresh
  // fires, gets a 400 from the server, and the SDK logs an AuthApiError to the
  // console BEFORE any of our safe-wrapper code runs.
  //
  // Calling getSession() eagerly here races ahead of the background timer,
  // detects the bad token first, and wipes it via signOut({ scope: "local" })
  // so the SDK never attempts the doomed background refresh.
  void supabaseClient.auth.getSession().then(({ error }) => {
    if (error && isInvalidRefreshTokenError(error.message)) {
      void supabaseClient?.auth.signOut({ scope: "local" })
    }
  })

  return supabaseClient
}

function isInvalidRefreshTokenError(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return (
    normalized.includes("invalid refresh token") ||
    normalized.includes("refresh token not found") ||
    normalized.includes("refresh_token_not_found")
  )
}

function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return

  const clearStorage = (storage: Storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)
      if (!key) continue
      if (key === "supabase.auth.token" || /^sb-.+-auth-token$/.test(key)) {
        storage.removeItem(key)
      }
    }
  }

  try {
    clearStorage(window.localStorage)
    clearStorage(window.sessionStorage)
  } catch {
    // Best-effort cache cleanup; storage may be unavailable in private contexts.
  }
}

export async function signOutAndClearLocalAuth(): Promise<void> {
  const supabase = getSupabaseClient()

  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined)
    }
  } catch {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined)
  } finally {
    clearSupabaseAuthStorage()
  }
}

async function clearLocalSessionOnRefreshTokenError(errorMessage: string): Promise<boolean> {
  if (!isInvalidRefreshTokenError(errorMessage)) {
    return false
  }

  try {
    await signOutAndClearLocalAuth()
  } catch {
    // Best-effort local cleanup; ignore follow-up errors.
  }

  return true
}

export async function getSafeSupabaseSession(): Promise<{ session: Session | null; error: string | null }> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    const recovered = await clearLocalSessionOnRefreshTokenError(error.message)
    if (recovered) {
      return { session: null, error: null }
    }

    return { session: null, error: error.message }
  }

  return { session: data.session ?? null, error: null }
}

export async function getSafeSupabaseUser(): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    const recovered = await clearLocalSessionOnRefreshTokenError(error.message)
    if (recovered) {
      return { user: null, error: null }
    }

    return { user: null, error: error.message }
  }

  return { user: data.user ?? null, error: null }
}
