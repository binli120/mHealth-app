import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/growth", () => ({
  upsertMailingListSignup: vi.fn(),
}))

vi.mock("@/lib/growth/request", () => ({
  getClientIpHash: vi.fn(() => "ip-hash"),
  getUserAgent: vi.fn(() => "test-agent"),
  readReferralCookie: vi.fn(() => "cookie-ref"),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
  logServerInfo: vi.fn(),
}))

import { POST } from "@/app/api/growth/mailing-list/route"
import { upsertMailingListSignup } from "@/lib/db/growth"

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/growth/mailing-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/growth/mailing-list", () => {
  it("stores a normalized signup with referral attribution", async () => {
    vi.mocked(upsertMailingListSignup).mockResolvedValue(undefined)

    const response = await POST(makeRequest({
      email: "  Person@Example.com ",
      source: "landing-footer",
      campaign: { utm_source: "partner" },
    }))

    expect(response.status).toBe(200)
    expect(upsertMailingListSignup).toHaveBeenCalledWith({
      email: "person@example.com",
      source: "landing-footer",
      referralCode: "cookie-ref",
      campaign: { utm_source: "partner" },
      userAgent: "test-agent",
      ipHash: "ip-hash",
    })
  })

  it("returns 400 for invalid email", async () => {
    const response = await POST(makeRequest({ email: "not-email" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(upsertMailingListSignup).not.toHaveBeenCalled()
  })
})
