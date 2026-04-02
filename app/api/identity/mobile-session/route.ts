/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * POST /api/identity/mobile-session
 *   Creates a new cross-device verify session.
 *   Returns { token, expiresAt, mobileUrl }
 *
 * GET /api/identity/mobile-session?token=xxx
 *   Desktop polls this to learn when the mobile device completes the scan.
 *   Returns { status, verifyStatus, verifyScore, verifyBreakdown }
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  createMobileVerifySession,
  getSessionForUser,
} from "@/lib/db/mobile-verify-session"
import { getApplicantIdForUser } from "@/lib/db/identity-verification"
import { logServerError } from "@/lib/server/logger"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_VERCEL_URL ||
  "http://localhost:3000"

// ─── POST — create session ────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const applicantId = await getApplicantIdForUser(auth.userId)
    if (!applicantId) {
      return NextResponse.json(
        { ok: false, error: "No applicant profile found. Please complete your profile first." },
        { status: 404 },
      )
    }

    const session = await createMobileVerifySession(auth.userId, applicantId)
    const mobileUrl = `${APP_URL}/verify/mobile/${session.token}`

    return NextResponse.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      mobileUrl,
    })
  } catch (err) {
    logServerError("Failed to create mobile verify session", err, { module: "mobile-session" })
    return NextResponse.json(
      { ok: false, error: "Failed to create verification session." },
      { status: 500 },
    )
  }
}

// ─── GET — poll session status ────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")?.trim()

  if (!token) {
    return NextResponse.json({ ok: false, error: "token is required." }, { status: 400 })
  }

  try {
    const session = await getSessionForUser(auth.userId, token)

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      status: session.status,
      verifyStatus: session.verifyStatus,
      verifyScore: session.verifyScore,
      verifyBreakdown: session.verifyBreakdown,
      expiresAt: session.expiresAt,
      completedAt: session.completedAt,
    })
  } catch (err) {
    logServerError("Failed to poll mobile verify session", err, { module: "mobile-session" })
    return NextResponse.json(
      { ok: false, error: "Failed to check session status." },
      { status: 500 },
    )
  }
}
