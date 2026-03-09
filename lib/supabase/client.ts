import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js"

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  const preferLocalDevConfig = process.env.NODE_ENV !== "production"
  const supabaseUrl = preferLocalDevConfig
    ? process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL || process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = preferLocalDevConfig
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_LOCAL ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL_LOCAL) and NEXT_PUBLIC_SUPABASE_ANON_KEY (or publishable key variants).",
    )
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
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

async function clearLocalSessionOnRefreshTokenError(errorMessage: string): Promise<boolean> {
  if (!isInvalidRefreshTokenError(errorMessage)) {
    return false
  }

  try {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut({ scope: "local" })
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
