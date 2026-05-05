/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/growth", () => ({
  createReferralEvent: vi.fn(),
}))

vi.mock("@/lib/growth/request", () => ({
  getClientIpHash: vi.fn(() => "ip-hash"),
  getUserAgent: vi.fn(() => "test-agent"),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

import { POST } from "@/app/api/growth/referrals/route"
import { createReferralEvent } from "@/lib/db/growth"

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/growth/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/growth/referrals", () => {
  it("records a referral event", async () => {
    vi.mocked(createReferralEvent).mockResolvedValue(undefined)

    const response = await POST(makeRequest({
      referralCode: "partner-123",
      landingPath: "/?ref=partner-123",
      referrer: "https://example.org",
      campaign: { utm_campaign: "spring" },
    }))

    expect(response.status).toBe(202)
    expect(createReferralEvent).toHaveBeenCalledWith({
      referralCode: "partner-123",
      landingPath: "/?ref=partner-123",
      referrer: "https://example.org",
      campaign: { utm_campaign: "spring" },
      userAgent: "test-agent",
      ipHash: "ip-hash",
    })
  })

  it("returns 400 for invalid referral payloads", async () => {
    const response = await POST(makeRequest({ referralCode: "" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(createReferralEvent).not.toHaveBeenCalled()
  })
})
