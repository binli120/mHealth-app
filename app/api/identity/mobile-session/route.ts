/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * POST /api/identity/mobile-session
 *   Creates a new cross-device verify session.
 *   Returns { token, expiresAt, mobileUrl }
 *
 * GET /api/identity/mobile-session?token=xxx
 *   Desktop polls this to learn when the mobile device completes the scan.
 *   Returns { status, verifyStatus, verifyScore, verifyBreakdown }
 */

import { networkInterfaces } from "node:os"
import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  createMobileVerifySession,
  getSessionForUser,
} from "@/lib/db/mobile-verify-session"
import { getApplicantIdForUser } from "@/lib/db/identity-verification"
import { logServerError } from "@/lib/server/logger"

/**
 * Return the base URL to embed in the QR code.
 *
 * In production use NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_VERCEL_URL as-is.
 * In local development, `localhost` is unreachable from a phone on the same
 * Wi-Fi, so we replace it with the machine's first non-loopback LAN IPv4.
 */
function getMobileBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : null) ||
    "http://localhost:3000"

  // In production (or when the URL is already an IP / custom domain) use as-is.
  if (process.env.NODE_ENV !== "development") return configured

  // In dev, swap out localhost for the machine's LAN IP so phones can reach it.
  if (!configured.includes("localhost") && !configured.includes("127.0.0.1")) {
    return configured
  }

  const port = (() => {
    try { return new URL(configured).port || "3000" } catch { return "3000" }
  })()

  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return `http://${iface.address}:${port}`
      }
    }
  }

  return configured   // fallback if no LAN IP found
}

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
    const mobileUrl = `${getMobileBaseUrl()}/verify/mobile/${session.token}`

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
      /** Demographic fields extracted from the license — used for profile auto-fill */
      extractedData: session.extractedData ?? null,
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
