/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let supabaseServerClient: SupabaseClient | null = null

export function getSupabaseServerClient() {
  if (supabaseServerClient) {
    return supabaseServerClient
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

  // Prefer the service-role key for server-side auth verification — it is always
  // a proper HS256 JWT and works reliably with auth.getUser() on local Supabase.
  // The anon/publishable key (sb_publishable_*) is a non-JWT opaque key that
  // Supabase v2 uses for browser clients; it may not work server-side.
  const supabaseKey =
    (process.env.NODE_ENV !== "production" &&
      process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    supabaseAnonKey

  supabaseServerClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return supabaseServerClient
}
