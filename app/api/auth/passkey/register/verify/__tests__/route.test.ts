/**
 * Unit tests for app/api/auth/passkey/register/verify/route.ts
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/auth/admin-passkeys", () => ({
  saveAdminPasskey: vi.fn(),
}))

vi.mock("@/lib/auth/passkey-webauthn", () => ({
  ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE: "hc-admin-passkey-register",
  getWebAuthnRp: vi.fn(),
  getPasskeyChallengeState: vi.fn(),
  clearPasskeyChallengeCookie: vi.fn(),
}))

vi.mock("@simplewebauthn/server", () => ({
  verifyRegistrationResponse: vi.fn(),
}))

import { POST } from "@/app/api/auth/passkey/register/verify/route"
import { requireAdmin } from "@/lib/auth/require-admin"
import { saveAdminPasskey } from "@/lib/auth/admin-passkeys"
import { getWebAuthnRp, getPasskeyChallengeState, clearPasskeyChallengeCookie } from "@/lib/auth/passkey-webauthn"
import { verifyRegistrationResponse } from "@simplewebauthn/server"

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockSavePasskey = vi.mocked(saveAdminPasskey)
const mockGetRp = vi.mocked(getWebAuthnRp)
const mockGetChallengeState = vi.mocked(getPasskeyChallengeState)
const mockClearCookie = vi.mocked(clearPasskeyChallengeCookie)
const mockVerify = vi.mocked(verifyRegistrationResponse)

const USER_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"

const MOCK_REGISTRATION_RESPONSE = {
  id: "cred-id",
  rawId: "cred-id",
  response: {
    clientDataJSON: "eyJ0ZXN0IjoidGVzdCJ9",
    attestationObject: "test",
  },
  clientExtensionResults: {},
  type: "public-key" as const,
}

function makeRequest(body: unknown = { response: MOCK_REGISTRATION_RESPONSE }) {
  return new Request("http://localhost/api/auth/passkey/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()

  mockRequireAdmin.mockResolvedValue({ ok: true, userId: USER_ID })
  mockGetChallengeState.mockReturnValue({ challenge: "test-challenge", userId: USER_ID, nonce: "nonce123" })
  mockGetRp.mockReturnValue({ rpName: "Test", rpID: "localhost", origin: "http://localhost" })
  mockVerify.mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: {
        id: "cred-id",
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        transports: ["internal"],
      },
      credentialDeviceType: "singleDevice",
      credentialBackedUp: false,
    },
  } as never)
  mockSavePasskey.mockResolvedValue(undefined)
  mockClearCookie.mockImplementation(() => undefined)
})

// ── requireAdmin guard ────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/register/verify — auth guard", () => {
  it("propagates non-ok requireAdmin response", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ ok: false, error: "Forbidden" }), { status: 403 })
    mockRequireAdmin.mockResolvedValue({ ok: false, response: forbiddenResponse as never })

    const response = await POST(makeRequest())
    expect(response.status).toBe(403)
    expect(mockGetChallengeState).not.toHaveBeenCalled()
  })
})

// ── challenge state guard ─────────────────────────────────────────────────────

describe("POST /api/auth/passkey/register/verify — challenge guard", () => {
  it("returns 400 when challenge state is null", async () => {
    mockGetChallengeState.mockReturnValue(null)

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/challenge expired/i)
  })

  it("returns 400 when challenge state userId does not match authenticated user", async () => {
    mockGetChallengeState.mockReturnValue({ challenge: "test-challenge", userId: "different-user-id", nonce: "n" })

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/challenge expired/i)
  })
})

// ── payload guard ─────────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/register/verify — payload guard", () => {
  it("returns 400 when response payload is missing", async () => {
    const response = await POST(makeRequest({ name: "My Key" }))
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/missing/i)
  })
})

// ── verification guard ────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/register/verify — verification guard", () => {
  it("returns 400 when verifyRegistrationResponse returns verified:false", async () => {
    mockVerify.mockResolvedValue({ verified: false } as never)

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/unable to verify/i)
  })
})

// ── Success ───────────────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/register/verify — success", () => {
  it("returns 200 with ok:true", async () => {
    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean }
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it("calls saveAdminPasskey with the correct userId and credential data", async () => {
    await POST(makeRequest({ response: MOCK_REGISTRATION_RESPONSE, name: "My Passkey" }))
    expect(mockSavePasskey).toHaveBeenCalledOnce()
    const [params] = mockSavePasskey.mock.calls[0] as [{ userId: string; credentialId: string; name: string | null }]
    expect(params.userId).toBe(USER_ID)
    expect(params.credentialId).toBe("cred-id")
    expect(params.name).toBe("My Passkey")
  })

  it("calls clearPasskeyChallengeCookie", async () => {
    await POST(makeRequest())
    expect(mockClearCookie).toHaveBeenCalledOnce()
  })
})
