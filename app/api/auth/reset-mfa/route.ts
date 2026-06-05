/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

// POST /api/auth/reset-mfa
// Sends a magic-link OTP email. When clicked, the link lands at
// /auth/reset-mfa/confirm which exchanges the code and unenrolls TOTP.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string }
  const email = (body.email ?? "").trim().toLowerCase()

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Valid email required." }, { status: 400 })
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""
  const redirectTo = `${origin}/auth/reset-mfa/confirm`

  const supabase = getSupabaseServerClient()
  // Always respond with success to avoid revealing whether the email exists.
  await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } })

  return NextResponse.json({ ok: true })
}
