/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { createHash, createHmac } from "crypto"

const MAX_PATH_LENGTH = 160
const MAX_SESSION_ID_LENGTH = 80
const MAX_DURATION_MS = 5 * 60 * 1000

const UUID_SEGMENT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKEN_LIKE_SEGMENT_RE = /^[A-Za-z0-9_-]{24,}$/

export function getAnalyticsUserHash(userId: string): string {
  const secret =
    process.env.CUSTOMER_ANALYTICS_HASH_SECRET ??
    process.env.PROFILE_ENCRYPTION_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (secret) {
    return createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32)
  }

  return createHash("sha256").update(userId).digest("hex").slice(0, 32)
}

export function getAnalyticsIpHash(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const rawIp = forwardedFor?.split(",")[0]?.trim() || realIp?.trim()
  if (!rawIp) return null

  const secret =
    process.env.CUSTOMER_ANALYTICS_HASH_SECRET ??
    process.env.PROFILE_ENCRYPTION_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (secret) {
    return createHmac("sha256", secret).update(rawIp).digest("hex").slice(0, 32)
  }

  return createHash("sha256").update(rawIp).digest("hex").slice(0, 32)
}

export function sanitizeAnalyticsPath(path: unknown): string {
  if (typeof path !== "string" || !path.trim()) return "/"

  let pathname = path.trim()
  try {
    pathname = new URL(pathname, "https://healthcompass.local").pathname
  } catch {
    pathname = pathname.split("?")[0]?.split("#")[0] ?? "/"
  }

  if (!pathname.startsWith("/")) pathname = `/${pathname}`

  const normalized = pathname
    .split("/")
    .map((segment) => {
      if (!segment) return segment
      if (UUID_SEGMENT_RE.test(segment)) return ":id"
      if (TOKEN_LIKE_SEGMENT_RE.test(segment)) return ":token"
      return segment.slice(0, 48)
    })
    .join("/")

  return normalized.slice(0, MAX_PATH_LENGTH)
}

export function sanitizeAnalyticsSessionId(sessionId: unknown): string | null {
  if (typeof sessionId !== "string") return null
  const trimmed = sessionId.trim()
  if (!trimmed) return null
  return trimmed.replace(/[^A-Za-z0-9_-]/g, "").slice(0, MAX_SESSION_ID_LENGTH) || null
}

export function sanitizeActiveDurationMs(durationMs: unknown): number {
  const parsed = typeof durationMs === "number" ? durationMs : Number(durationMs)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(Math.round(parsed), MAX_DURATION_MS)
}
