/**
 * Unit tests for lib/server/rate-limit.ts
 *
 * RateLimiter, getClientIp, and checkRateLimit are tested with fresh
 * instances per test so shared module-level state never bleeds between cases.
 * Fake timers are used to advance the clock without actually waiting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RateLimiter, getClientIp, checkRateLimit } from "@/lib/server/rate-limit"

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/test", { headers })
}

// ── getClientIp ───────────────────────────────────────────────────────────────

describe("getClientIp", () => {
  it("returns the first IP from x-forwarded-for when multiple are present", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" })
    expect(getClientIp(req)).toBe("1.2.3.4")
  })

  it("returns x-forwarded-for when it is a single IP", () => {
    const req = makeRequest({ "x-forwarded-for": "203.0.113.5" })
    expect(getClientIp(req)).toBe("203.0.113.5")
  })

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = makeRequest({ "x-real-ip": "198.51.100.7" })
    expect(getClientIp(req)).toBe("198.51.100.7")
  })

  it("returns 'unknown' when no IP header is present", () => {
    const req = makeRequest()
    expect(getClientIp(req)).toBe("unknown")
  })

  it("prefers x-forwarded-for over x-real-ip", () => {
    const req = makeRequest({
      "x-forwarded-for": "10.0.0.1",
      "x-real-ip": "10.0.0.2",
    })
    expect(getClientIp(req)).toBe("10.0.0.1")
  })
})

// ── RateLimiter ───────────────────────────────────────────────────────────────

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows requests under the limit", () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000 })

    expect(limiter.check("ip-a").allowed).toBe(true)
    expect(limiter.check("ip-a").allowed).toBe(true)
    expect(limiter.check("ip-a").allowed).toBe(true)
  })

  it("blocks the request that exceeds the limit", () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 })

    limiter.check("ip-a")
    limiter.check("ip-a")
    expect(limiter.check("ip-a").allowed).toBe(false)
  })

  it("returns correct remaining count", () => {
    const limiter = new RateLimiter({ limit: 5, windowMs: 60_000 })

    expect(limiter.check("ip-a").remaining).toBe(4)
    expect(limiter.check("ip-a").remaining).toBe(3)
    expect(limiter.check("ip-a").remaining).toBe(2)
  })

  it("remaining hits 0 when limit is reached", () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 })

    limiter.check("ip-a")
    expect(limiter.check("ip-a").remaining).toBe(0)
  })

  it("resets after the window expires", () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 })

    limiter.check("ip-a")
    limiter.check("ip-a")
    expect(limiter.check("ip-a").allowed).toBe(false)

    vi.advanceTimersByTime(60_001)

    expect(limiter.check("ip-a").allowed).toBe(true)
  })

  it("tracks different keys independently", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 })

    expect(limiter.check("ip-a").allowed).toBe(true)
    expect(limiter.check("ip-a").allowed).toBe(false)

    // ip-b has its own fresh counter
    expect(limiter.check("ip-b").allowed).toBe(true)
  })

  it("returns a resetAt timestamp within the window", () => {
    const now = Date.now()
    const limiter = new RateLimiter({ limit: 5, windowMs: 60_000 })
    const { resetAt } = limiter.check("ip-a")

    expect(resetAt).toBeGreaterThanOrEqual(now)
    expect(resetAt).toBeLessThanOrEqual(now + 60_000)
  })

  it("prune removes expired entries and allows fresh tracking", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 })

    limiter.check("ip-a")
    expect(limiter.check("ip-a").allowed).toBe(false)

    vi.advanceTimersByTime(60_001)
    limiter.prune()

    // After prune the entry is gone; next check starts a fresh window
    expect(limiter.check("ip-a").allowed).toBe(true)
  })
})

// ── checkRateLimit ────────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns null when the request is within the limit", () => {
    const limiter = new RateLimiter({ limit: 5, windowMs: 60_000 })
    expect(checkRateLimit(limiter, "ip-a")).toBeNull()
  })

  it("returns a 429 Response when the limit is exceeded", async () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 })

    checkRateLimit(limiter, "ip-a") // consume the one allowed request
    const response = checkRateLimit(limiter, "ip-a")

    expect(response).not.toBeNull()
    expect(response!.status).toBe(429)
  })

  it("429 response body contains ok:false and an error message", async () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 })

    checkRateLimit(limiter, "ip-a")
    const response = checkRateLimit(limiter, "ip-a")!
    const body = await response.json()

    expect(body.ok).toBe(false)
    expect(typeof body.error).toBe("string")
    expect(body.error.length).toBeGreaterThan(0)
  })

  it("429 response includes Retry-After header", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 })

    checkRateLimit(limiter, "ip-a")
    const response = checkRateLimit(limiter, "ip-a")!

    const retryAfter = response.headers.get("Retry-After")
    expect(retryAfter).not.toBeNull()
    expect(Number(retryAfter)).toBeGreaterThan(0)
  })

  it("429 response includes X-RateLimit-Remaining: 0", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 })

    checkRateLimit(limiter, "ip-a")
    const response = checkRateLimit(limiter, "ip-a")!

    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0")
  })

  it("429 response includes X-RateLimit-Reset as a Unix timestamp", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 })

    checkRateLimit(limiter, "ip-a")
    const response = checkRateLimit(limiter, "ip-a")!

    const reset = Number(response.headers.get("X-RateLimit-Reset"))
    expect(reset).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })
})
