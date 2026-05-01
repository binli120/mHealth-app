/**
 * Unit tests for app/api/auth/passkey/login/verify/route.ts
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/admin-passkeys", () => ({
  getAdminPasskeyByCredentialId: vi.fn(),
  isAdminUser: vi.fn(),
  toWebAuthnCredential: vi.fn(),
  updateAdminPasskeyCounter: vi.fn(),
}))

vi.mock("@/lib/auth/passkey-session", () => ({
  setAdminPasskeySessionCookie: vi.fn(),
}))

vi.mock("@/lib/auth/passkey-webauthn", () => ({
  ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE: "hc-admin-passkey-login",
  getWebAuthnRp: vi.fn(),
  getPasskeyChallengeState: vi.fn(),
  clearPasskeyChallengeCookie: vi.fn(),
}))

vi.mock("@/lib/db/admin-access", () => ({
  logLoginEvent: vi.fn(),
}))

vi.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse: vi.fn(),
}))

import { POST } from "@/app/api/auth/passkey/login/verify/route"
import {
  getAdminPasskeyByCredentialId,
  isAdminUser,
  toWebAuthnCredential,
  updateAdminPasskeyCounter,
} from "@/lib/auth/admin-passkeys"
import { setAdminPasskeySessionCookie } from "@/lib/auth/passkey-session"
import { getWebAuthnRp, getPasskeyChallengeState, clearPasskeyChallengeCookie } from "@/lib/auth/passkey-webauthn"
import { verifyAuthenticationResponse } from "@simplewebauthn/server"

const mockGetChallengeState = vi.mocked(getPasskeyChallengeState)
const mockGetPasskey = vi.mocked(getAdminPasskeyByCredentialId)
const mockIsAdmin = vi.mocked(isAdminUser)
const mockToCredential = vi.mocked(toWebAuthnCredential)
const mockUpdateCounter = vi.mocked(updateAdminPasskeyCounter)
const mockSetSessionCookie = vi.mocked(setAdminPasskeySessionCookie)
const mockClearChallengeCookie = vi.mocked(clearPasskeyChallengeCookie)
const mockGetRp = vi.mocked(getWebAuthnRp)
const mockVerify = vi.mocked(verifyAuthenticationResponse)

const USER_ID = "cccccccc-cccc-4ccc-cccc-cccccccccccc"
const ADMIN_EMAIL = "admin@test.com"
const CREDENTIAL_ID = "cred-id-login"

const MOCK_PASSKEY_ROW = {
  id: "row-1",
  user_id: USER_ID,
  credential_id: CREDENTIAL_ID,
  public_key: "publickey==",
  counter: "5",
  transports: ["internal"],
  device_type: "singleDevice",
  backed_up: false,
  name: null,
}

const MOCK_AUTH_RESPONSE = {
  id: CREDENTIAL_ID,
  rawId: CREDENTIAL_ID,
  response: {
    clientDataJSON: "eyJ0ZXN0IjoidGVzdCJ9",
    authenticatorData: "test",
    signature: "test",
  },
  clientExtensionResults: {},
  type: "public-key" as const,
}

function makeRequest(body: unknown = { response: MOCK_AUTH_RESPONSE }) {
  return new Request("http://localhost/api/auth/passkey/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()

  mockGetChallengeState.mockReturnValue({
    challenge: "auth-challenge",
    userId: USER_ID,
    email: ADMIN_EMAIL,
    nonce: "nonce-abc",
  })
  mockGetPasskey.mockResolvedValue(MOCK_PASSKEY_ROW)
  mockIsAdmin.mockResolvedValue(true)
  mockToCredential.mockReturnValue({
    id: CREDENTIAL_ID,
    publicKey: new Uint8Array([1, 2, 3]),
    counter: 5,
    transports: ["internal"],
  })
  mockGetRp.mockReturnValue({ rpName: "Test", rpID: "localhost", origin: "http://localhost" })
  mockVerify.mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 6 },
  } as never)
  mockUpdateCounter.mockResolvedValue(undefined)
  mockSetSessionCookie.mockImplementation(() => undefined)
  mockClearChallengeCookie.mockImplementation(() => undefined)
})

// ── Challenge state guard ─────────────────────────────────────────────────────

describe("POST /api/auth/passkey/login/verify — challenge guard", () => {
  it("returns 400 when state is null", async () => {
    mockGetChallengeState.mockReturnValue(null)

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/challenge expired/i)
  })

  it("returns 400 when state has no userId", async () => {
    mockGetChallengeState.mockReturnValue({
      challenge: "auth-challenge",
      email: ADMIN_EMAIL,
      nonce: "nonce",
    } as never)

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/challenge expired/i)
  })

  it("returns 400 when state has no email", async () => {
    mockGetChallengeState.mockReturnValue({
      challenge: "auth-challenge",
      userId: USER_ID,
      nonce: "nonce",
    } as never)

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/challenge expired/i)
  })
})

// ── Payload guard ─────────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/login/verify — payload guard", () => {
  it("returns 400 when response.id is missing", async () => {
    const response = await POST(makeRequest({ response: { rawId: "test" } }))
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/missing/i)
  })

  it("returns 400 when response is absent entirely", async () => {
    const response = await POST(makeRequest({}))
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/missing/i)
  })
})

// ── Passkey authorization guards ──────────────────────────────────────────────

describe("POST /api/auth/passkey/login/verify — passkey authorization guards", () => {
  it("returns 403 when passkey is not found", async () => {
    mockGetPasskey.mockResolvedValue(null)

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(403)
    expect(body.error).toMatch(/not authorized/i)
  })

  it("returns 403 when passkey user_id does not match state userId", async () => {
    mockGetPasskey.mockResolvedValue({ ...MOCK_PASSKEY_ROW, user_id: "wrong-user-id" })

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(403)
    expect(body.error).toMatch(/not authorized/i)
  })

  it("returns 403 when isAdminUser returns false", async () => {
    mockIsAdmin.mockResolvedValue(false)

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(403)
    expect(body.error).toMatch(/not authorized/i)
  })
})

// ── Verification guard ────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/login/verify — verification guard", () => {
  it("returns 401 when verifyAuthenticationResponse returns verified:false", async () => {
    mockVerify.mockResolvedValue({ verified: false } as never)

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(401)
    expect(body.error).toMatch(/unable to verify/i)
  })
})

// ── Success ───────────────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/login/verify — success", () => {
  it("returns 200 with ok:true and redirectTo /admin", async () => {
    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; redirectTo: string }
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.redirectTo).toBe("/admin")
  })

  it("calls updateAdminPasskeyCounter with new counter", async () => {
    await POST(makeRequest())
    expect(mockUpdateCounter).toHaveBeenCalledOnce()
    expect(mockUpdateCounter).toHaveBeenCalledWith(CREDENTIAL_ID, 6)
  })

  it("calls setAdminPasskeySessionCookie with the passkey user_id", async () => {
    await POST(makeRequest())
    expect(mockSetSessionCookie).toHaveBeenCalledOnce()
    const [, userId] = mockSetSessionCookie.mock.calls[0] as [unknown, string]
    expect(userId).toBe(USER_ID)
  })

  it("calls clearPasskeyChallengeCookie", async () => {
    await POST(makeRequest())
    expect(mockClearChallengeCookie).toHaveBeenCalledOnce()
  })
})
