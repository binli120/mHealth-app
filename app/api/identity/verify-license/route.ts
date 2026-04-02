/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * POST /api/identity/verify-license
 *
 * Accepts the raw PDF417 barcode text decoded client-side, parses the
 * AAMVA data, compares it against the authenticated user's applicant
 * profile, persists the attempt, and returns the verification result.
 *
 * GET /api/identity/verify-license
 *
 * Returns the current identity status for the authenticated user.
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { parseAamvaBarcode } from "@/lib/identity/aamva-parser"
import { verifyLicenseAgainstProfile } from "@/lib/identity/verify-license"
import {
  getApplicantProfileForVerification,
  getApplicantIdentityStatus,
  saveVerificationAttempt,
  getApplicantIdForUser,
} from "@/lib/db/identity-verification"
import { logServerError } from "@/lib/server/logger"

// ─── GET — fetch current identity status ─────────────────────────────────────

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const row = await getApplicantIdentityStatus(auth.userId)

    if (!row) {
      return NextResponse.json({
        ok: true,
        status: "unverified",
        score: null,
        verifiedAt: null,
      })
    }

    return NextResponse.json({
      ok: true,
      status: row.identity_status,
      score: row.identity_score,
      verifiedAt: row.identity_verified_at,
    })
  } catch (err) {
    logServerError("Failed to fetch identity status", err, { module: "verify-license" })
    return NextResponse.json({ ok: false, error: "Failed to fetch identity status." }, { status: 500 })
  }
}

// ─── POST — run verification ──────────────────────────────────────────────────

interface VerifyRequestBody {
  /** Raw PDF417 barcode text decoded by the ZXing client-side scanner */
  rawBarcode: string
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  // ── Parse request body ───────────────────────────────────────────────────
  let body: VerifyRequestBody
  try {
    body = (await request.json()) as VerifyRequestBody
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 })
  }

  const rawBarcode = typeof body?.rawBarcode === "string" ? body.rawBarcode.trim() : ""
  if (!rawBarcode) {
    return NextResponse.json({ ok: false, error: "rawBarcode is required." }, { status: 400 })
  }

  try {
    // ── 1. Parse AAMVA barcode ─────────────────────────────────────────────
    const parseResult = parseAamvaBarcode(rawBarcode)
    if (!parseResult.ok) {
      return NextResponse.json(
        { ok: false, error: `Could not read license barcode: ${parseResult.error}` },
        { status: 422 },
      )
    }
    const licenseData = parseResult.data

    // ── 2. Load applicant profile ──────────────────────────────────────────
    const profile = await getApplicantProfileForVerification(auth.userId)
    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error: "No applicant profile found. Please complete your profile before verifying.",
        },
        { status: 404 },
      )
    }

    // ── 3. Run verification ────────────────────────────────────────────────
    const verificationResult = verifyLicenseAgainstProfile(licenseData, {
      firstName: profile.first_name,
      lastName: profile.last_name,
      dateOfBirth: profile.dob,
      addressStreet: profile.address_line1,
      addressCity: profile.city,
      addressState: profile.state,
      addressZip: profile.zip,
    })

    // ── 4. Persist the attempt ─────────────────────────────────────────────
    const applicantId = await getApplicantIdForUser(auth.userId)
    if (!applicantId) {
      return NextResponse.json({ ok: false, error: "Applicant record not found." }, { status: 404 })
    }

    const ipAddress = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined
    const userAgent = request.headers.get("user-agent") ?? undefined

    await saveVerificationAttempt({
      applicantId,
      userId: auth.userId,
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

    // ── 5. Respond ─────────────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      status: verificationResult.status,
      score: verificationResult.score,
      breakdown: verificationResult.breakdown,
      isExpired: verificationResult.isExpired,
      extractedName: verificationResult.extractedName,
      verifiedAt: verificationResult.status === "verified" ? new Date().toISOString() : null,
      message:
        verificationResult.status === "verified"
          ? "Identity verified successfully."
          : verificationResult.status === "needs_review"
            ? "Your identity is under review. A staff member will confirm shortly."
            : "Identity could not be confirmed. Please ensure your profile matches your license.",
    })
  } catch (err) {
    logServerError("Identity verification error", err, { module: "verify-license" })
    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "development" && err instanceof Error
            ? err.message
            : "Identity verification failed. Please try again.",
      },
      { status: 500 },
    )
  }
}
