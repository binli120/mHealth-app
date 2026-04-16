/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { isLocalAuthHelperEnabled } from "@/lib/auth/local-auth"
import { logServerError } from "@/lib/server/logger"
import { getSupabaseServerClient } from "@/lib/supabase/server"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "0.0.0.0", "::1"])
const LOCAL_DEV_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"

function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null
  }

  const [scheme, token] = headerValue.trim().split(/\s+/, 2)
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null
  }

  return token
}

function parseCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) {
    return null
  }

  const pair = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${cookieName}=`))

  if (!pair) {
    return null
  }

  const value = pair.slice(cookieName.length + 1)
  return value ? decodeURIComponent(value) : null
}

function extractAccessToken(request: Request): string | null {
  const bearerToken = parseBearerToken(request.headers.get("authorization"))
  if (bearerToken) {
    return bearerToken
  }

  return parseCookieValue(request.headers.get("cookie"), "sb-access-token")
}

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4)
    return Buffer.from(padded, "base64").toString("utf8")
  } catch {
    return null
  }
}

function parseJwtParts(token: string): {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signingInput: string
  signature: string
} | null {
  const parts = token.split(".")
  if (parts.length !== 3) {
    return null
  }

  try {
    const headerJson = decodeBase64Url(parts[0])
    const payloadJson = decodeBase64Url(parts[1])

    if (!headerJson || !payloadJson) {
      return null
    }

    const header = JSON.parse(headerJson) as unknown
    const payload = JSON.parse(payloadJson) as unknown
    if (
      typeof header !== "object" ||
      header === null ||
      typeof payload !== "object" ||
      payload === null
    ) {
      return null
    }

    return {
      header: header as Record<string, unknown>,
      payload: payload as Record<string, unknown>,
      signingInput: `${parts[0]}.${parts[1]}`,
      signature: parts[2],
    }
  } catch {
    return null
  }
}

/** Match private LAN IPv4 ranges (for dev access from a phone on the same Wi-Fi). */
const PRIVATE_IP_RE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

function isPrivateLanIp(hostname: string): boolean {
  return process.env.NODE_ENV === "development" && PRIVATE_IP_RE.test(hostname)
}

function isLocalRequest(request: Request): boolean {
  try {
    const url = new URL(request.url)
    if (LOCAL_HOSTS.has(url.hostname) || isPrivateLanIp(url.hostname)) return true
    // Also check the Host header — Next.js may rewrite request.url internally
    const headerHost = (request.headers.get("host") ?? "").split(":")[0]
    return LOCAL_HOSTS.has(headerHost) || isPrivateLanIp(headerHost)
  } catch {
    return false
  }
}

function verifyHs256JwtSignature(signingInput: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(signingInput).digest("base64url")
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

function extractLocalFallbackUserId(request: Request, token: string): string | null {
  if (!isLocalAuthHelperEnabled() || !isLocalRequest(request)) {
    return null
  }

  const parsedToken = parseJwtParts(token)
  if (!parsedToken) {
    return null
  }

  const { header, payload, signingInput, signature } = parsedToken
  if (header.alg !== "HS256") {
    return null
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET || LOCAL_DEV_JWT_SECRET
  if (!verifyHs256JwtSignature(signingInput, signature, jwtSecret)) {
    return null
  }

  const subject = typeof payload.sub === "string" ? payload.sub : null
  if (!subject || !UUID_PATTERN.test(subject)) {
    return null
  }

  const exp = payload.exp
  if (typeof exp === "number" && Number.isFinite(exp) && exp * 1000 <= Date.now()) {
    return null
  }

  const audience = typeof payload.aud === "string" ? payload.aud : null
  if (audience !== "authenticated") {
    return null
  }

  const issuer = typeof payload.iss === "string" ? payload.iss : null
  const allowedIssuers = new Set(
    [process.env.SUPABASE_JWT_ISSUER, process.env.JWT_ISSUER, "supabase-demo"].filter(
      (value): value is string => Boolean(value),
    ),
  )
  if (!issuer || !allowedIssuers.has(issuer)) {
    return null
  }

  return subject
}

export async function requireAuthenticatedUser(
  request: Request,
): Promise<
  | {
      ok: true
      userId: string
    }
  | {
      ok: false
      response: NextResponse
    }
> {
  const token = extractAccessToken(request)
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Authentication required.",
        },
        { status: 401 },
      ),
    }
  }

  const localFallbackUserId = extractLocalFallbackUserId(request, token)

  try {
    const { data, error } = await getSupabaseServerClient().auth.getUser(token)

    if (!error && data.user?.id) {
      return {
        ok: true,
        userId: data.user.id,
      }
    }

    if (localFallbackUserId) {
      return {
        ok: true,
        userId: localFallbackUserId,
      }
    }

    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Invalid or expired session.",
        },
        { status: 401 },
      ),
    }
  } catch (error) {
    if (localFallbackUserId) {
      return {
        ok: true,
        userId: localFallbackUserId,
      }
    }

    logServerError("Failed to verify authentication token", error, {
      module: "require-auth",
    })
    const message = error instanceof Error ? error.message : ""
    const isMissingConfig = message.includes("Missing Supabase env vars")

    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: isMissingConfig
            ? "Unable to verify authentication."
            : "Invalid or expired session.",
        },
        { status: isMissingConfig ? 500 : 401 },
      ),
    }
  }
}
