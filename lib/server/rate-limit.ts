/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db/server"

interface RateLimitEntry {
  count: number
  windowStart: number
}

interface RateLimitConfig {
  /** Maximum number of requests allowed per window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
  /** When true (default), allow requests through if the DB is unavailable.
   *  Set to false for sensitive limiters (e.g. SSN, identity) where a DB
   *  outage should block rather than silently pass brute-force attempts. */
  failOpen?: boolean
}

// Each limiter instance keeps its own in-memory store.
// Safe for a single-process deployment (Docker/standalone Next.js).
// For multi-instance deployments, replace with an Upstash Redis-backed limiter.
export class RateLimiter {
  private readonly store = new Map<string, RateLimitEntry>()
  private readonly limit: number
  private readonly windowMs: number

  constructor({ limit, windowMs }: RateLimitConfig) {
    this.limit = limit
    this.windowMs = windowMs
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now - entry.windowStart >= this.windowMs) {
      // New window
      this.store.set(key, { count: 1, windowStart: now })
      return { allowed: true, remaining: this.limit - 1, resetAt: now + this.windowMs }
    }

    if (entry.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: entry.windowStart + this.windowMs }
    }

    entry.count++
    return { allowed: true, remaining: this.limit - entry.count, resetAt: entry.windowStart + this.windowMs }
  }

  // Prune expired entries to prevent unbounded memory growth.
  // Call periodically or piggyback on check().
  prune() {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now - entry.windowStart >= this.windowMs) {
        this.store.delete(key)
      }
    }
  }
}

// ── DbRateLimiter — Postgres-backed, multi-instance-safe ─────────────────────

/**
 * Rate limiter backed by a Postgres counter table (rate_limit_counters).
 *
 * Uses an atomic INSERT … ON CONFLICT DO UPDATE to increment a per-(key,
 * window) counter. Safe across multiple Next.js instances.
 *
 * Fail-open: if the DB is unavailable, requests are allowed through rather
 * than blocking all traffic during an outage.
 */
export class DbRateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private readonly failOpen: boolean

  constructor({ limit, windowMs, failOpen }: RateLimitConfig) {
    this.limit = limit
    this.windowMs = windowMs
    this.failOpen = failOpen ?? true
  }

  async checkAsync(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const windowSeconds = Math.ceil(this.windowMs / 1000)

    try {
      const pool = getDbPool()
      const { rows } = await pool.query<{ count: number; window_start: Date }>(
        `INSERT INTO public.rate_limit_counters (key, window_start, count)
         VALUES (
           $1,
           to_timestamp(floor(extract(epoch from now()) / $2) * $2),
           1
         )
         ON CONFLICT (key, window_start) DO UPDATE
           SET count = rate_limit_counters.count + 1
         RETURNING count, window_start`,
        [key, windowSeconds],
      )

      const row = rows[0]
      if (!row) {
        return { allowed: true, remaining: this.limit - 1, resetAt: Date.now() + this.windowMs }
      }

      const count = typeof row.count === "string" ? parseInt(row.count, 10) : row.count
      const windowStart = row.window_start instanceof Date
        ? row.window_start.getTime()
        : new Date(row.window_start).getTime()
      const resetAt = windowStart + this.windowMs

      if (count > this.limit) {
        return { allowed: false, remaining: 0, resetAt }
      }

      return { allowed: true, remaining: Math.max(0, this.limit - count), resetAt }
    } catch {
      // Fail-open by default; fail-closed for sensitive limiters (e.g. SSN, identity).
      if (!this.failOpen) {
        return { allowed: false, remaining: 0, resetAt: Date.now() + this.windowMs }
      }
      return { allowed: true, remaining: this.limit - 1, resetAt: Date.now() + this.windowMs }
    }
  }
}

/**
 * Run a DbRateLimiter check and return a 429 NextResponse if the limit is
 * exceeded, or null if the request should proceed.
 */
export async function checkRateLimitAsync(
  limiter: DbRateLimiter,
  key: string,
): Promise<NextResponse | null> {
  const { allowed, remaining, resetAt } = await limiter.checkAsync(key)

  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
      },
    )
  }

  return null
}

// ── Shared limiter instances ──────────────────────────────────────────────────

/** Public invite-token lookup — 20 req / min per IP */
export const inviteTokenReadLimiter = new RateLimiter({ limit: 20, windowMs: 60_000 })

/** Invite acceptance (account creation) — 5 req / min per IP */
export const inviteTokenAcceptLimiter = new RateLimiter({ limit: 5, windowMs: 60_000 })

// Prune stale entries every 5 minutes to keep memory bounded
setInterval(() => {
  inviteTokenReadLimiter.prune()
  inviteTokenAcceptLimiter.prune()
}, 5 * 60_000)

// ── DB-backed limiter instances (multi-instance safe) ─────────────────────────

/** SSN submission — 3 attempts per 15 min per user */
export const ssnSubmitLimiter = new DbRateLimiter({ limit: 3, windowMs: 15 * 60_000, failOpen: false })

/** Identity (driver-license) verification — 5 attempts per 30 min per user */
export const identityVerifyLimiter = new DbRateLimiter({ limit: 5, windowMs: 30 * 60_000, failOpen: false })

/** AI chat — 30 messages per 5 min per user (streaming) */
export const aiChatLimiter = new DbRateLimiter({ limit: 30, windowMs: 5 * 60_000 })

/** Document upload — 20 uploads per 10 min per user */
export const documentUploadLimiter = new DbRateLimiter({ limit: 20, windowMs: 10 * 60_000 })

/** Mobile upload — 5 attempts per token per 15 min */
export const mobileUploadLimiter = new DbRateLimiter({ limit: 5, windowMs: 15 * 60_000 })

// ── Helper ────────────────────────────────────────────────────────────────────

/** Extract the best available client IP from a Next.js Request. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}

/**
 * Run a rate limiter check and return a 429 Response if the limit is exceeded,
 * or null if the request should proceed.
 */
export function checkRateLimit(
  limiter: RateLimiter,
  key: string,
): NextResponse | null {
  const { allowed, remaining, resetAt } = limiter.check(key)

  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
      },
    )
  }

  void remaining // available for response headers if needed
  return null
}
