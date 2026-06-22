/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { afterEach, describe, expect, it } from "vitest"

import {
  getAnalyticsIpHash,
  getAnalyticsUserHash,
  sanitizeActiveDurationMs,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsSessionId,
} from "@/lib/server/customer-analytics"

describe("customer analytics helpers", () => {
  afterEach(() => {
    delete process.env.CUSTOMER_ANALYTICS_HASH_SECRET
  })

  it("creates stable pseudonymous user hashes", () => {
    process.env.CUSTOMER_ANALYTICS_HASH_SECRET = "test-secret"

    expect(getAnalyticsUserHash("user-1")).toBe(getAnalyticsUserHash("user-1"))
    expect(getAnalyticsUserHash("user-1")).not.toBe(getAnalyticsUserHash("user-2"))
  })

  it("creates stable pseudonymous IP hashes from forwarded headers", () => {
    process.env.CUSTOMER_ANALYTICS_HASH_SECRET = "test-secret"
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    })

    expect(getAnalyticsIpHash(request)).toBe(getAnalyticsIpHash(request))
    expect(getAnalyticsIpHash(request)).not.toContain("203.0.113.10")
  })

  it("removes query strings and replaces token-like path segments", () => {
    expect(sanitizeAnalyticsPath("/verify/mobile/abcdefghijklmnopqrstuvwxyz123456?token=secret")).toBe(
      "/verify/mobile/:token",
    )
  })

  it("replaces UUID path segments", () => {
    expect(sanitizeAnalyticsPath("/customer/status/123e4567-e89b-12d3-a456-426614174000")).toBe(
      "/customer/status/:id",
    )
  })

  it("sanitizes session identifiers", () => {
    expect(sanitizeAnalyticsSessionId("abc-123_.$%^")).toBe("abc-123_")
    expect(sanitizeAnalyticsSessionId("")).toBeNull()
  })

  it("bounds active duration", () => {
    expect(sanitizeActiveDurationMs(12.8)).toBe(13)
    expect(sanitizeActiveDurationMs(-1)).toBe(0)
    expect(sanitizeActiveDurationMs(10 * 60 * 1000)).toBe(5 * 60 * 1000)
  })
})
