/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * POST /api/identity/mobile-verify/[token]
 *
 * Called by the mobile scan page (no auth token required — uses session token).
 * Receives the raw PDF417 barcode text, verifies it against the applicant
 * profile, persists the result, and marks the session as completed so the
 * waiting desktop can pick it up via polling.
 */

import { NextResponse } from "next/server"
import { parseAamvaBarcode } from "@/lib/identity/aamva-parser"
import { verifyLicenseAgainstProfile } from "@/lib/identity/verify-license"
import { getSessionByToken, completeSession } from "@/lib/db/mobile-verify-session"
import {
  getApplicantProfileForVerification,
  saveVerificationAttempt,
} from "@/lib/db/identity-verification"
import { logServerError } from "@/lib/server/logger"

interface RouteParams {
  params: Promise<{ token: string }>
}

/**
 * GET /api/identity/mobile-verify/[token]
 *
 * Public (no auth) — used by the mobile page on load to check whether the
 * token is still valid before starting the camera.
 * Returns { ok, status } where status is the session lifecycle state.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params
  if (!token?.trim()) {
    return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 400 })
  }

  try {
    const session = await getSessionByToken(token)
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, status: session.status })
  } catch (err) {
    logServerError("Failed to check mobile verify session", err, { module: "mobile-verify" })
    return NextResponse.json({ ok: false, error: "Failed to check session." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params

  if (!token || token.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Invalid session token." }, { status: 400 })
  }

  // ── 1. Validate session token ──────────────────────────────────────────────
  let session
  try {
    session = await getSessionByToken(token)
  } catch (err) {
    logServerError("Failed to look up mobile verify session", err, { module: "mobile-verify" })
    return NextResponse.json({ ok: false, error: "Session lookup failed." }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
  }

  if (session.status === "expired") {
    return NextResponse.json(
      { ok: false, error: "This verification link has expired. Please request a new QR code." },
      { status: 410 },
    )
  }

  if (session.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "This session has already been used." },
      { status: 409 },
    )
  }

  // ── 2. Parse request body ──────────────────────────────────────────────────
  let rawBarcode: string
  try {
    const body = (await request.json()) as { rawBarcode?: string }
    rawBarcode = typeof body?.rawBarcode === "string" ? body.rawBarcode.trim() : ""
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 })
  }

  if (!rawBarcode) {
    return NextResponse.json({ ok: false, error: "rawBarcode is required." }, { status: 400 })
  }

  try {
    // ── 3. Parse AAMVA barcode ───────────────────────────────────────────────
    const parseResult = parseAamvaBarcode(rawBarcode)
    if (!parseResult.ok) {
      return NextResponse.json(
        { ok: false, error: `Could not read license barcode: ${parseResult.error}` },
        { status: 422 },
      )
    }
    const licenseData = parseResult.data

    // ── 4. Load applicant profile ────────────────────────────────────────────
    const profile = await getApplicantProfileForVerification(session.userId)
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Applicant profile not found." },
        { status: 404 },
      )
    }

    // ── 5. Run verification ──────────────────────────────────────────────────
    const verificationResult = verifyLicenseAgainstProfile(licenseData, {
      firstName: profile.first_name,
      lastName: profile.last_name,
      dateOfBirth: profile.dob,
      addressStreet: profile.address_line1,
      addressCity: profile.city,
      addressState: profile.state,
      addressZip: profile.zip,
    })

    // ── 6. Persist attempt ───────────────────────────────────────────────────
    const ipAddress =
      request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined
    const userAgent = request.headers.get("user-agent") ?? undefined

    await saveVerificationAttempt({
      applicantId: session.applicantId,
      userId: session.userId,
      status: verificationResult.status,
      score: verificationResult.score,
      breakdown: verificationResult.breakdown,
      licenseNumber: licenseData.licenseNumber,
      dlExpirationDate: licenseData.expirationDate,
      dlIssuingState: licenseData.issuingState,
      isExpired: verificationResult.isExpired,
      ipAddress,
      userAgent,
    })

    // ── 7. Mark session as completed (include extracted demographic fields) ──
    await completeSession(
      token,
      verificationResult.status,
      verificationResult.score,
      verificationResult.breakdown as unknown as Record<string, boolean>,
      {
        firstName: licenseData.firstName,
        lastName: licenseData.lastName,
        addressLine1: licenseData.addressStreet,
        city: licenseData.addressCity,
        state: licenseData.addressState,
        zip: licenseData.addressZip,
      },
    )

    return NextResponse.json({
      ok: true,
      status: verificationResult.status,
      score: verificationResult.score,
      extractedName: verificationResult.extractedName,
      message:
        verificationResult.status === "verified"
          ? "Identity verified! You can return to the desktop."
          : verificationResult.status === "needs_review"
            ? "Submitted for review. You can return to the desktop."
            : "Verification failed. Please try again from the desktop.",
    })
  } catch (err) {
    logServerError("Mobile identity verification error", err, { module: "mobile-verify" })
    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "development" && err instanceof Error
            ? err.message
            : "Verification failed. Please try again.",
      },
      { status: 500 },
    )
  }
}
