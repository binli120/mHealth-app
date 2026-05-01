/**
 * WebAuthn request helpers for admin passkeys.
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { randomBytes } from "crypto"
import { NextResponse } from "next/server"

export const ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE = "hc-admin-passkey-register"
export const ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE = "hc-admin-passkey-login"

const CHALLENGE_TTL_SECONDS = 60 * 5

export interface PasskeyChallengeState {
  challenge: string
  userId?: string
  email?: string
  nonce: string
}

const IP_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/

export function getWebAuthnRp(request: Request) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  const origin = configuredOrigin ? new URL(configuredOrigin).origin : new URL(request.url).origin
  const hostname = new URL(origin).hostname
  // WebAuthn RP ID must be a domain, not an IP address. Normalize to localhost for local dev.
  const rpID = process.env.WEBAUTHN_RP_ID || (IP_REGEX.test(hostname) ? "localhost" : hostname)
  const effectiveOrigin = IP_REGEX.test(hostname) ? origin.replace(hostname, "localhost") : origin

  return {
    rpName: process.env.WEBAUTHN_RP_NAME || "HealthCompass MA",
    rpID,
    origin: effectiveOrigin,
  }
}

function encodeState(state: Omit<PasskeyChallengeState, "nonce">) {
  return Buffer.from(
    JSON.stringify({
      ...state,
      nonce: randomBytes(16).toString("base64url"),
    } satisfies PasskeyChallengeState),
  ).toString("base64url")
}

function decodeState(value: string): PasskeyChallengeState | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<PasskeyChallengeState>
    if (!parsed.challenge || typeof parsed.challenge !== "string") return null
    if (!parsed.nonce || typeof parsed.nonce !== "string") return null
    return {
      challenge: parsed.challenge,
      userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
      nonce: parsed.nonce,
    }
  } catch {
    return null
  }
}

function parseCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null
  const pair = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${cookieName}=`))
  return pair ? decodeURIComponent(pair.slice(cookieName.length + 1)) : null
}

export function setPasskeyChallengeCookie(
  response: NextResponse,
  cookieName: string,
  state: Omit<PasskeyChallengeState, "nonce">,
) {
  response.cookies.set(cookieName, encodeState(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  })
}

export function getPasskeyChallengeState(request: Request, cookieName: string): PasskeyChallengeState | null {
  const value = parseCookieValue(request.headers.get("cookie"), cookieName)
  return value ? decodeState(value) : null
}

export function clearPasskeyChallengeCookie(response: NextResponse, cookieName: string) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
