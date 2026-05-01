/**
 * Admin passkey session cookies.
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

export const ADMIN_PASSKEY_SESSION_COOKIE = "hc-admin-passkey-session"

const SESSION_TTL_SECONDS = 60 * 60 * 8
const TOKEN_VERSION = 1
const LOCAL_DEV_PASSKEY_SESSION_SECRET = "local-admin-passkey-session-secret-with-at-least-32-characters"

interface PasskeySessionPayload {
  version: number
  type: "admin_passkey"
  sub: string
  iat: number
  exp: number
  nonce: string
}

function getSecret() {
  const secret =
    process.env.ADMIN_PASSKEY_SESSION_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET

  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV !== "production") {
      return LOCAL_DEV_PASSKEY_SESSION_SECRET
    }

    throw new Error("Missing ADMIN_PASSKEY_SESSION_SECRET with at least 32 characters.")
  }

  return secret
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url")
}

function signPayload(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url")
}

function parseCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null

  const pair = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${cookieName}=`))

  if (!pair) return null
  return decodeURIComponent(pair.slice(cookieName.length + 1))
}

export function createAdminPasskeySessionToken(userId: string) {
  const now = Math.floor(Date.now() / 1000)
  const payload: PasskeySessionPayload = {
    version: TOKEN_VERSION,
    type: "admin_passkey",
    sub: userId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: randomBytes(16).toString("base64url"),
  }
  const body = encodeBase64Url(JSON.stringify(payload))
  return `${body}.${signPayload(body)}`
}

export function verifyAdminPasskeySessionToken(token: string): string | null {
  const [body, signature] = token.split(".")
  if (!body || !signature) return null

  const expected = signPayload(body)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<PasskeySessionPayload>
    if (payload.version !== TOKEN_VERSION || payload.type !== "admin_passkey") return null
    if (!payload.sub || typeof payload.sub !== "string") return null
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null
    return payload.sub
  } catch {
    return null
  }
}

export function getAdminPasskeySessionUserId(request: Request): string | null {
  const token = parseCookieValue(request.headers.get("cookie"), ADMIN_PASSKEY_SESSION_COOKIE)
  return token ? verifyAdminPasskeySessionToken(token) : null
}

export function setAdminPasskeySessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(ADMIN_PASSKEY_SESSION_COOKIE, createAdminPasskeySessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearAdminPasskeySessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_PASSKEY_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
