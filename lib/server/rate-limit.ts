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

      if (count >= this.limit) {
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

// ── UpstashRateLimiter — Redis-backed, low-latency, multi-instance-safe ────────

/**
 * Rate limiter backed by Upstash Redis via their REST API (no SDK required).
 *
 * Uses a fixed-window INCR + EXPIRE pipeline for O(1) atomic counting.
 * When UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set the
 * limiter falls back transparently to the Postgres-backed DbRateLimiter.
 *
 * Set failOpen: false for sensitive endpoints (SSN, identity) so that a
 * Redis outage causes a deny rather than silently passing brute-force attempts.
 */
export class UpstashRateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private readonly failOpen: boolean
  /** Postgres fallback used when Upstash env vars are absent or on error. */
  private readonly pgFallback: DbRateLimiter

  constructor({ limit, windowMs, failOpen = true }: RateLimitConfig) {
    this.limit = limit
    this.windowMs = windowMs
    this.failOpen = failOpen
    this.pgFallback = new DbRateLimiter({ limit, windowMs, failOpen })
  }

  async checkAsync(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

    // Fall back to Postgres when Upstash is not configured.
    if (!url || !token) {
      return this.pgFallback.checkAsync(key)
    }

    const windowSeconds = Math.ceil(this.windowMs / 1000)
    // Bucket key is scoped to the current fixed window so entries auto-expire.
    const bucket = Math.floor(Date.now() / 1000 / windowSeconds)
    const windowKey = `rl:${key}:${bucket}`
    const resetAt = (bucket + 1) * windowSeconds * 1000

    try {
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Pipeline: atomically increment counter, then set expiry only on
        // the first write so the key dies when the window closes.
        body: JSON.stringify([
          ["INCR", windowKey],
          ["EXPIRE", windowKey, String(windowSeconds + 5), "NX"],
        ]),
        cache: "no-store",
      })

      if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`)

      const results = (await res.json()) as Array<{ result: unknown }>
      const count = typeof results[0]?.result === "number" ? results[0].result : 1

      if (count > this.limit) {
        return { allowed: false, remaining: 0, resetAt }
      }

      return { allowed: true, remaining: Math.max(0, this.limit - count), resetAt }
    } catch {
      // Redis error — apply the configured fail-open / fail-closed policy.
      if (!this.failOpen) {
        return { allowed: false, remaining: 0, resetAt: Date.now() + this.windowMs }
      }
      return { allowed: true, remaining: this.limit - 1, resetAt: Date.now() + this.windowMs }
    }
  }
}

/**
 * Run a DbRateLimiter or UpstashRateLimiter check and return a 429 NextResponse
 * if the limit is exceeded, or null if the request should proceed.
 */
export async function checkRateLimitAsync(
  limiter: DbRateLimiter | UpstashRateLimiter,
  key: string,
): Promise<NextResponse | null> {
  const { allowed, resetAt } = await limiter.checkAsync(key)

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
// Invite token limiters use DbRateLimiter (Postgres) so they are multi-instance
// safe on Fluid Compute / Vercel deployments (no shared in-process memory).

/** Public invite-token lookup — 20 req / min per IP */
export const inviteTokenReadLimiter = new DbRateLimiter({ limit: 20, windowMs: 60_000 })

/** Invite acceptance (account creation) — 5 req / min per IP */
export const inviteTokenAcceptLimiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })

// ── Upstash-backed limiter instances (Redis-first, Postgres fallback) ─────────
// These endpoints are sensitive or high-volume.  When UPSTASH_REDIS_REST_URL
// and UPSTASH_REDIS_REST_TOKEN are set the limiters use Redis for lower latency;
// otherwise they fall back to the Postgres-backed DbRateLimiter.

/** SSN submission — 3 attempts per 15 min per user (fail-closed) */
export const ssnSubmitLimiter = new UpstashRateLimiter({ limit: 3, windowMs: 15 * 60_000, failOpen: false })

/** Identity (driver-license) verification — 5 attempts per 30 min per user (fail-closed) */
export const identityVerifyLimiter = new UpstashRateLimiter({ limit: 5, windowMs: 30 * 60_000, failOpen: false })

/** AI chat — 30 messages per 5 min per user (streaming) */
export const aiChatLimiter = new UpstashRateLimiter({ limit: 30, windowMs: 5 * 60_000 })

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
  const { allowed, resetAt } = limiter.check(key)

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
