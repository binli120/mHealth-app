/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Unit tests for POST /api/user-profile/ssn.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

// ── Mock declarations ─────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimitAsync: vi.fn(),
  ssnSubmitLimiter: {},
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/db/user-profile", () => ({
  hasApplicantSsn: vi.fn(),
  upsertApplicantSsn: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { POST } from "@/app/api/user-profile/ssn/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { checkRateLimitAsync } from "@/lib/server/rate-limit"
import { upsertApplicantSsn } from "@/lib/db/user-profile"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/user-profile/ssn", {
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
  vi.mocked(upsertApplicantSsn).mockResolvedValue(undefined)
})

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe("POST /api/user-profile/ssn — rate limiting", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(checkRateLimitAsync).mockResolvedValueOnce(
      NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 }),
    )

    const response = await POST(makeRequest({ ssn: "123-45-6789" }))
    expect(response.status).toBe(429)
    const json = await response.json()
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/too many requests/i)
  })

  it("does not call upsertApplicantSsn when rate limited", async () => {
    vi.mocked(checkRateLimitAsync).mockResolvedValueOnce(
      NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 }),
    )

    await POST(makeRequest({ ssn: "123-45-6789" }))
    expect(upsertApplicantSsn).not.toHaveBeenCalled()
  })
})

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("POST /api/user-profile/ssn — auth", () => {
  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)

    const response = await POST(makeRequest({ ssn: "123-45-6789" }))
    expect(response.status).toBe(401)
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe("POST /api/user-profile/ssn — validation", () => {
  it("returns 400 for an invalid SSN format", async () => {
    const response = await POST(makeRequest({ ssn: "not-an-ssn" }))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.ok).toBe(false)
  })

  it("accepts a dashed SSN format", async () => {
    const response = await POST(makeRequest({ ssn: "123-45-6789" }))
    expect(response.status).toBe(200)
  })

  it("accepts a 9-digit SSN format", async () => {
    const response = await POST(makeRequest({ ssn: "123456789" }))
    expect(response.status).toBe(200)
  })
})
