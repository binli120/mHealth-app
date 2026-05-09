/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
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

  // Pre-clear any session whose access token has already expired.
  // Even with autoRefreshToken: false, the Supabase SDK will still attempt a
  // refresh when getSession() is called and the stored expires_at is in the
  // past.  If the refresh token is also invalid (e.g. after a DB reset), the
  // SDK logs an AuthApiError to the console internally before our error handler
  // can intercept it.  Wiping the storage here prevents the SDK from ever
  // seeing the stale token, so no network call is attempted and no console
  // error appears.
  clearExpiredSupabaseSessionFromStorage()

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
    },
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

function isSupabaseAuthKey(key: string): boolean {
  return key === "supabase.auth.token" || /^sb-.+-auth-token$/.test(key)
}

function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return

  const sweep = (storage: Storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)
      if (key && isSupabaseAuthKey(key)) storage.removeItem(key)
    }
  }

  try {
    sweep(window.localStorage)
    sweep(window.sessionStorage)
  } catch {
    // Best-effort cache cleanup; storage may be unavailable in private contexts.
  }
}

// Removes stored Supabase sessions whose access token has already expired.
// Called before the client is created so the SDK never sees a stale token
// and never attempts a doomed refresh-token network request.
function clearExpiredSupabaseSessionFromStorage() {
  if (typeof window === "undefined") return

  const nowSeconds = Math.floor(Date.now() / 1000)

  const sweep = (storage: Storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)
      if (!key || !isSupabaseAuthKey(key)) continue
      try {
        const raw = storage.getItem(key)
        if (!raw) { storage.removeItem(key); continue }
        const parsed = JSON.parse(raw) as {
          expires_at?: unknown
          currentSession?: { expires_at?: unknown }
        }
        const expiresAt =
          parsed.expires_at ??
          parsed.currentSession?.expires_at
        if (typeof expiresAt === "number" && expiresAt < nowSeconds) {
          storage.removeItem(key)
        }
      } catch {
        storage.removeItem(key)
      }
    }
  }

  try {
    sweep(window.localStorage)
    sweep(window.sessionStorage)
  } catch {
    // Best-effort; storage may be unavailable in private contexts.
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
