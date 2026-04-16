import "server-only"

import { NextResponse } from "next/server"

interface RateLimitEntry {
  count: number
  windowStart: number
}

interface RateLimitConfig {
  /** Maximum number of requests allowed per window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
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
