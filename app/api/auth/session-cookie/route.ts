/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"

import { logLoginEvent } from "@/lib/db/admin-access"
import { getAnalyticsIpHash, getAnalyticsUserHash } from "@/lib/server/customer-analytics"
import { logServerInfo } from "@/lib/server/logger"
import { getSupabaseServerClient } from "@/lib/supabase/server"

const DEFAULT_ACCESS_TOKEN_MAX_AGE = 60 * 60
// Long-lived hint cookie checked by the proxy to allow the Supabase refresh-token
// flow to run even when the 1-hour JWT cookie has expired.  Carries no auth data.
const SESSION_HINT_COOKIE = "hc-session-hint"
const SESSION_HINT_MAX_AGE = 7 * 24 * 60 * 60 // 7 days — matches Supabase refresh-token lifetime

function getJwtMaxAge(token: string): number {
  try {
    const [, payload] = token.split(".")
    if (!payload) return DEFAULT_ACCESS_TOKEN_MAX_AGE
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown
    }
    if (typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp)) {
      return DEFAULT_ACCESS_TOKEN_MAX_AGE
    }

    const seconds = Math.floor(decoded.exp - Date.now() / 1000)
    return Math.max(0, Math.min(seconds, DEFAULT_ACCESS_TOKEN_MAX_AGE))
  } catch {
    return DEFAULT_ACCESS_TOKEN_MAX_AGE
  }
}

export async function POST(request: Request) {
  let body: { accessToken?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : ""
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "accessToken is required." },
      { status: 400 },
    )
  }

  const { data, error } = await getSupabaseServerClient().auth.getUser(accessToken)
  if (error || !data.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired session." },
      { status: 401 },
    )
  }

  const ipAddress = request.headers.get("x-forwarded-for")
  const userAgent = request.headers.get("user-agent")
  const ipHash = getAnalyticsIpHash(request)
  void logLoginEvent(data.user.id, "login", ipAddress, userAgent)
  logServerInfo("customer.login", {
    ...(ipHash ? { ip_hash: ipHash } : {}),
    method: "password",
    route: "/api/auth/session-cookie",
    user_hash: getAnalyticsUserHash(data.user.id),
  })

  const isSecure = process.env.NODE_ENV === "production"
  const response = NextResponse.json({ ok: true })
  response.cookies.set("sb-access-token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: getJwtMaxAge(accessToken),
  })
  response.cookies.set(SESSION_HINT_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: SESSION_HINT_MAX_AGE,
  })

  return response
}

export async function DELETE() {
  const isSecure = process.env.NODE_ENV === "production"
  const response = NextResponse.json({ ok: true })
  response.cookies.set("sb-access-token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 0,
  })
  response.cookies.set(SESSION_HINT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 0,
  })
  return response
}
