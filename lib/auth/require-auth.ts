import "server-only"

import { NextResponse } from "next/server"

import { isLocalAuthHelperEnabled } from "@/lib/auth/local-auth"
import { logServerError } from "@/lib/server/logger"
import { getSupabaseServerClient } from "@/lib/supabase/server"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".")
  if (parts.length < 2) {
    return null
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4)
    const decoded = Buffer.from(padded, "base64").toString("utf8")
    const parsed = JSON.parse(decoded) as unknown
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function extractLocalFallbackUserId(token: string): string | null {
  if (!isLocalAuthHelperEnabled()) {
    return null
  }

  const payload = parseJwtPayload(token)
  if (!payload) {
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

  const localFallbackUserId = extractLocalFallbackUserId(token)

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
