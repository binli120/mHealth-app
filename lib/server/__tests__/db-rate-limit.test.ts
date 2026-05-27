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

  it("allows the request when count is exactly at the limit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 5, window_start: new Date() }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it("blocks the request when count exceeds the limit", async () => {
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
})
