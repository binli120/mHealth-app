/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Unit tests for DbRateLimiter. The Postgres pool is mocked so no real DB
 * is required — we verify the SQL arguments and that allowed/remaining/resetAt
 * are derived correctly from the returned count.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock pg pool ────────────────────────────────────────────────────────────
const mockQuery = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query: mockQuery }),
}))

import { DbRateLimiter } from "@/lib/server/rate-limit"

describe("DbRateLimiter", () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it("allows the request when count equals 1 (first hit in window)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1, window_start: new Date() }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("allows the request when count equals the limit (last slot, boundary)", async () => {
    // The DB increments BEFORE the check, so count=5 with limit=5 means this
    // is the 5th of 5 allowed requests — it should be permitted with 0 remaining.
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 5, window_start: new Date() }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it("blocks the request when count exceeds the limit", async () => {
    // count=6 with limit=5 means the 6th request — blocked.
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 6, window_start: new Date() }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("returns resetAt as window_start + windowMs", async () => {
    const windowStart = new Date(Date.now() - 30_000) // 30s ago
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1, window_start: windowStart }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.resetAt).toBe(windowStart.getTime() + 60_000)
  })

  it("falls back to allowed=true when the DB query throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"))
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.allowed).toBe(true) // fail-open to avoid blocking all traffic on DB outage
  })

  it("passes the rate-limit key and correct windowSeconds as SQL parameters", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1, window_start: new Date() }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    await limiter.checkAsync("ssn:user-123")
    expect(mockQuery).toHaveBeenCalledOnce()
    const [_sql, params] = mockQuery.mock.calls[0]!
    expect(params[0]).toBe("ssn:user-123")  // key
    expect(params[1]).toBe(60)              // windowSeconds = ceil(60_000 / 1000)
  })

  it("blocks the request when failOpen=false and DB throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"))
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000, failOpen: false })
    const result = await limiter.checkAsync("ssn:user-123")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
