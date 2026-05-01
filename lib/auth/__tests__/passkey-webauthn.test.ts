/**
 * Unit tests for lib/auth/passkey-webauthn.ts
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

import {
  ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE,
  ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE,
  getWebAuthnRp,
  setPasskeyChallengeCookie,
  getPasskeyChallengeState,
  clearPasskeyChallengeCookie,
} from "@/lib/auth/passkey-webauthn"

beforeEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.APP_URL
  delete process.env.WEBAUTHN_RP_ID
  delete process.env.WEBAUTHN_RP_NAME
})

// ── getWebAuthnRp ─────────────────────────────────────────────────────────────

describe("getWebAuthnRp", () => {
  it("uses NEXT_PUBLIC_APP_URL when set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com"
    const request = new Request("http://localhost:3000/api/test")
    const rp = getWebAuthnRp(request)
    expect(rp.rpID).toBe("app.example.com")
    expect(rp.origin).toBe("https://app.example.com")
  })

  it("falls back to request.url hostname when env is not set", () => {
    const request = new Request("http://myapp.local:3000/api/test")
    const rp = getWebAuthnRp(request)
    expect(rp.rpID).toBe("myapp.local")
    expect(rp.origin).toBe("http://myapp.local:3000")
  })

  it("normalizes IP address to localhost for rpID and origin", () => {
    const request = new Request("http://0.0.0.0:3000/api/test")
    const rp = getWebAuthnRp(request)
    expect(rp.rpID).toBe("localhost")
    expect(rp.origin).toBe("http://localhost:3000")
  })

  it("normalizes any IPv4 hostname in the URL to localhost", () => {
    const request = new Request("http://192.168.1.100:3000/api/test")
    const rp = getWebAuthnRp(request)
    expect(rp.rpID).toBe("localhost")
    expect(rp.origin).toContain("localhost")
  })

  it("uses WEBAUTHN_RP_ID env var when set", () => {
    process.env.WEBAUTHN_RP_ID = "custom.rp.example.com"
    const request = new Request("http://somehost.local/api/test")
    const rp = getWebAuthnRp(request)
    expect(rp.rpID).toBe("custom.rp.example.com")
  })

  it("uses WEBAUTHN_RP_NAME env var when set", () => {
    process.env.WEBAUTHN_RP_NAME = "My Custom RP"
    const request = new Request("http://localhost:3000/api/test")
    const rp = getWebAuthnRp(request)
    expect(rp.rpName).toBe("My Custom RP")
  })

  it("defaults rpName to HealthCompass MA when not set", () => {
    const request = new Request("http://localhost:3000/api/test")
    const rp = getWebAuthnRp(request)
    expect(rp.rpName).toBe("HealthCompass MA")
  })
})

// ── setPasskeyChallengeCookie / getPasskeyChallengeState round-trip ───────────

describe("setPasskeyChallengeCookie + getPasskeyChallengeState", () => {
  it("round-trip: state written to response cookie can be read from request cookie header", () => {
    const response = new NextResponse()
    const state = { challenge: "my-challenge-abc", userId: "user-123", email: "admin@test.com" }
    setPasskeyChallengeCookie(response, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE, state)

    const cookieHeader = response.headers.get("set-cookie")
    expect(cookieHeader).toBeTruthy()

    // Extract just the value from set-cookie header
    const match = cookieHeader!.match(new RegExp(`${ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE}=([^;]+)`))
    expect(match).toBeTruthy()
    const cookieValue = match![1]

    const request = new Request("http://localhost/api/test", {
      headers: { cookie: `${ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE}=${cookieValue}` },
    })
    const decoded = getPasskeyChallengeState(request, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE)
    expect(decoded).not.toBeNull()
    expect(decoded!.challenge).toBe("my-challenge-abc")
    expect(decoded!.userId).toBe("user-123")
    expect(decoded!.email).toBe("admin@test.com")
    expect(typeof decoded!.nonce).toBe("string")
  })

  it("round-trip works with login challenge cookie name", () => {
    const response = new NextResponse()
    const state = { challenge: "login-challenge-xyz", email: "admin@test.com", userId: "uid-99" }
    setPasskeyChallengeCookie(response, ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE, state)

    const cookieHeader = response.headers.get("set-cookie")
    const match = cookieHeader!.match(new RegExp(`${ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE}=([^;]+)`))
    const cookieValue = match![1]

    const request = new Request("http://localhost/api/test", {
      headers: { cookie: `${ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE}=${cookieValue}` },
    })
    const decoded = getPasskeyChallengeState(request, ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE)
    expect(decoded!.challenge).toBe("login-challenge-xyz")
    expect(decoded!.userId).toBe("uid-99")
  })
})

// ── getPasskeyChallengeState — error cases ────────────────────────────────────

describe("getPasskeyChallengeState — invalid/tampered input", () => {
  it("returns null when the cookie is absent", () => {
    const request = new Request("http://localhost/api/test")
    expect(getPasskeyChallengeState(request, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE)).toBeNull()
  })

  it("returns null for a non-base64url garbage cookie value", () => {
    const request = new Request("http://localhost/api/test", {
      headers: { cookie: `${ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE}=!!!notvalid!!!` },
    })
    expect(getPasskeyChallengeState(request, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE)).toBeNull()
  })

  it("returns null when cookie is valid base64url but missing required fields", () => {
    const invalid = Buffer.from(JSON.stringify({ randomField: "value" })).toString("base64url")
    const request = new Request("http://localhost/api/test", {
      headers: { cookie: `${ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE}=${invalid}` },
    })
    expect(getPasskeyChallengeState(request, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE)).toBeNull()
  })

  it("returns null when challenge field is missing", () => {
    const invalid = Buffer.from(JSON.stringify({ nonce: "abc" })).toString("base64url")
    const request = new Request("http://localhost/api/test", {
      headers: { cookie: `${ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE}=${invalid}` },
    })
    expect(getPasskeyChallengeState(request, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE)).toBeNull()
  })
})

// ── clearPasskeyChallengeCookie ────────────────────────────────────────────────

describe("clearPasskeyChallengeCookie", () => {
  it("sets the cookie with maxAge 0", () => {
    const response = new NextResponse()
    clearPasskeyChallengeCookie(response, ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE)
    const setCookie = response.headers.get("set-cookie")
    expect(setCookie).toContain(ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE)
    expect(setCookie).toMatch(/max-age=0/i)
  })
})
