/**
 * /api/user-profile/ssn
 *
 * POST — Accept the applicant's Social Security Number, validate its format,
 *        encrypt it with AES-256-GCM, and persist it in applicants.ssn_encrypted.
 *
 * GET  — Return whether the authenticated user already has an SSN on file
 *        ({ hasSsn: boolean }).  The plaintext value is NEVER returned over the
 *        wire; it is only used server-side (e.g. PDF generation).
 *
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import { getClientIp } from "@/lib/server/rate-limit"
import {
  hasApplicantSsn,
  upsertApplicantSsn,
} from "@/lib/db/user-profile"

export const runtime = "nodejs"

// Accept "###-##-####" or 9 consecutive digits.
const ssnSchema = z
  .string()
  .trim()
  .regex(
    /^(\d{3}-\d{2}-\d{4}|\d{9})$/,
    "SSN must be in ###-##-#### format or 9 consecutive digits.",
  )

const postBodySchema = z.object({
  ssn: ssnSchema,
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  try {
    const hasSsn = await hasApplicantSsn(authResult.userId)
    return NextResponse.json({ ok: true, hasSsn })
  } catch (error) {
    logServerError("user-profile/ssn.GET", error, { userId: authResult.userId })
    return NextResponse.json(
      { ok: false, error: "Unable to check SSN status." },
      { status: 500 },
    )
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  let body: z.infer<typeof postBodySchema>
  try {
    body = postBodySchema.parse(await request.json())
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors[0]?.message ?? "Invalid SSN format."
        : "Invalid request body."
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }

  try {
    // upsertApplicantSsn owns normalisation (plain → dashed) and encryption.
    await upsertApplicantSsn(authResult.userId, body.ssn, {
      ipAddress: getClientIp(request),
      purpose: "user-submitted",
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError("user-profile/ssn.POST", error, { userId: authResult.userId })
    // Do NOT surface internal error details — they could hint at the stored value.
    return NextResponse.json(
      { ok: false, error: "Unable to save SSN. Please try again." },
      { status: 500 },
    )
  }
}
