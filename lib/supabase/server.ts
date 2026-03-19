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

  supabaseServerClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return supabaseServerClient
}
