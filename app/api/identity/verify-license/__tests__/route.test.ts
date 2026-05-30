/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Unit tests for POST /api/identity/verify-license.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

// ── Mock declarations ─────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimitAsync: vi.fn(),
  identityVerifyLimiter: {},
}))

vi.mock("@/lib/identity/aamva-parser", () => ({
  parseAamvaBarcode: vi.fn(),
}))

vi.mock("@/lib/identity/verify-license", () => ({
  verifyLicenseAgainstProfile: vi.fn(),
}))

vi.mock("@/lib/db/identity-verification", () => ({
  getApplicantProfileForVerification: vi.fn(),
  getApplicantIdentityStatus: vi.fn(),
  saveVerificationAttempt: vi.fn(),
  getApplicantIdForUser: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { POST, GET } from "@/app/api/identity/verify-license/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { checkRateLimitAsync } from "@/lib/server/rate-limit"
import { parseAamvaBarcode } from "@/lib/identity/aamva-parser"
import { verifyLicenseAgainstProfile } from "@/lib/identity/verify-license"
import {
  getApplicantProfileForVerification,
  getApplicantIdentityStatus,
  saveVerificationAttempt,
  getApplicantIdForUser,
} from "@/lib/db/identity-verification"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const APPLICANT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const BARCODE = "@\n\rANSI 123456789 DL00010101DLDAAJOHN\nDACDOE\n"

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/identity/verify-license", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  vi.mocked(checkRateLimitAsync).mockResolvedValue(null)
  vi.mocked(parseAamvaBarcode).mockReturnValue({
    ok: true,
    data: {
      firstName: "JOHN",
      lastName: "DOE",
      dateOfBirth: "19900101",
      expirationDate: "20300101",
      licenseNumber: "S12345678",
      issuingState: "MA",
      addressStreet: "123 MAIN ST",
      addressCity: "BOSTON",
      addressState: "MA",
      addressZip: "02101",
    },
  } as never)
  vi.mocked(getApplicantProfileForVerification).mockResolvedValue({
    first_name: "JOHN",
    last_name: "DOE",
    dob: "1990-01-01",
    address_line1: "123 Main St",
    city: "Boston",
    state: "MA",
    zip: "02101",
  } as never)
  vi.mocked(verifyLicenseAgainstProfile).mockReturnValue({
    status: "verified",
    score: 100,
    breakdown: {},
    isExpired: false,
    extractedName: "JOHN DOE",
  } as never)
  vi.mocked(getApplicantIdForUser).mockResolvedValue(APPLICANT_ID)
  vi.mocked(saveVerificationAttempt).mockResolvedValue(undefined)
})

// ── Rate limiting (POST only) ─────────────────────────────────────────────────

describe("POST /api/identity/verify-license — rate limiting", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(checkRateLimitAsync).mockResolvedValueOnce(
      NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 }),
    )

    const response = await POST(makeRequest({ rawBarcode: BARCODE }))
    expect(response.status).toBe(429)
    const json = await response.json()
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/too many requests/i)
  })

  it("does not call parseAamvaBarcode when rate limited", async () => {
    vi.mocked(checkRateLimitAsync).mockResolvedValueOnce(
      NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 }),
    )

    await POST(makeRequest({ rawBarcode: BARCODE }))
    expect(parseAamvaBarcode).not.toHaveBeenCalled()
  })
})

// ── GET does NOT have rate limiting ──────────────────────────────────────────

describe("GET /api/identity/verify-license — no rate limiting", () => {
  it("does not invoke checkRateLimitAsync", async () => {
    vi.mocked(getApplicantIdentityStatus).mockResolvedValue(null)
    const response = await GET(
      new Request("http://localhost/api/identity/verify-license"),
    )
    expect(response.status).toBe(200)
    expect(checkRateLimitAsync).not.toHaveBeenCalled()
  })
})

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("POST /api/identity/verify-license — auth", () => {
  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)

    const response = await POST(makeRequest({ rawBarcode: BARCODE }))
    expect(response.status).toBe(401)
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/identity/verify-license — happy path", () => {
  it("returns 200 with verified status on success", async () => {
    const response = await POST(makeRequest({ rawBarcode: BARCODE }))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(json.status).toBe("verified")
  })
})
