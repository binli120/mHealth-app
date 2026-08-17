/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { emailSchema, parseJsonBody } from "@/lib/api/validation"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const postBodySchema = z.object({ email: emailSchema })

// POST /api/auth/reset-mfa
// Sends a magic-link OTP email. When clicked, the link lands at
// /auth/reset-mfa/confirm which exchanges the code and unenrolls TOTP.
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, postBodySchema)
  if (!parsed.ok) return parsed.response
  const { email } = parsed.data

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""
  const redirectTo = `${origin}/auth/reset-mfa/confirm`

  const supabase = getSupabaseServerClient()
  // Always respond with success to avoid revealing whether the email exists.
  await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } })

  return NextResponse.json({ ok: true })
}
