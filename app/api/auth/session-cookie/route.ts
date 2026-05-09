/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

const DEFAULT_ACCESS_TOKEN_MAX_AGE = 60 * 60

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

  const response = NextResponse.json({ ok: true })
  response.cookies.set("sb-access-token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getJwtMaxAge(accessToken),
  })

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set("sb-access-token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  return response
}
