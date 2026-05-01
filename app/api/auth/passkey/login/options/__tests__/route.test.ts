/**
 * Unit tests for app/api/auth/passkey/login/options/route.ts
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/admin-passkeys", () => ({
  getAdminUserByEmail: vi.fn(),
  listAdminPasskeysForUser: vi.fn(),
}))

vi.mock("@/lib/auth/passkey-webauthn", () => ({
  ADMIN_PASSKEY_LOGIN_CHALLENGE_COOKIE: "hc-admin-passkey-login",
  getWebAuthnRp: vi.fn(),
  setPasskeyChallengeCookie: vi.fn(),
}))

vi.mock("@/lib/auth/local-auth", () => ({
  normalizeAuthEmail: vi.fn((email: string) => email.trim().toLowerCase()),
}))

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: vi.fn(),
}))

import { POST } from "@/app/api/auth/passkey/login/options/route"
import { getAdminUserByEmail, listAdminPasskeysForUser } from "@/lib/auth/admin-passkeys"
import { getWebAuthnRp, setPasskeyChallengeCookie } from "@/lib/auth/passkey-webauthn"
import { generateAuthenticationOptions } from "@simplewebauthn/server"

const mockGetAdmin = vi.mocked(getAdminUserByEmail)
const mockListPasskeys = vi.mocked(listAdminPasskeysForUser)
const mockGetRp = vi.mocked(getWebAuthnRp)
const mockSetChallengeCookie = vi.mocked(setPasskeyChallengeCookie)
const mockGenerateOptions = vi.mocked(generateAuthenticationOptions)

const ADMIN_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"
const ADMIN_EMAIL = "admin@test.com"

const MOCK_PASSKEY_ROW = {
  id: "row-1",
  user_id: ADMIN_ID,
  credential_id: "cred-id-1",
  public_key: "publickey==",
  counter: "0",
  transports: ["internal"],
  device_type: "singleDevice",
  backed_up: false,
  name: null,
}

function makeRequest(body: unknown = { email: ADMIN_EMAIL }) {
  return new Request("http://localhost/api/auth/passkey/login/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()

  mockGetAdmin.mockResolvedValue({ id: ADMIN_ID, email: ADMIN_EMAIL })
  mockListPasskeys.mockResolvedValue([MOCK_PASSKEY_ROW])
  mockGetRp.mockReturnValue({ rpName: "Test", rpID: "localhost", origin: "http://localhost" })
  mockGenerateOptions.mockResolvedValue({
    challenge: "auth-challenge",
    rpId: "localhost",
    allowCredentials: [],
    userVerification: "required",
    timeout: 60000,
  } as never)
})

// ── Email validation ───────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/login/options — email validation", () => {
  it("returns 400 when email is empty", async () => {
    const response = await POST(makeRequest({ email: "" }))
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/email is required/i)
  })

  it("returns 400 when body is missing email field", async () => {
    const response = await POST(makeRequest({}))
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/email is required/i)
  })
})

// ── Admin lookup guard ────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/login/options — admin guard", () => {
  it("returns 404 when getAdminUserByEmail returns null", async () => {
    mockGetAdmin.mockResolvedValue(null)

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(404)
    expect(body.error).toMatch(/no admin passkey/i)
  })
})

// ── Passkey list guard ────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/login/options — passkey list guard", () => {
  it("returns 404 when no passkeys are registered for the admin", async () => {
    mockListPasskeys.mockResolvedValue([])

    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; error: string }
    expect(response.status).toBe(404)
    expect(body.error).toMatch(/no admin passkey/i)
  })
})

// ── Success ───────────────────────────────────────────────────────────────────

describe("POST /api/auth/passkey/login/options — success", () => {
  it("returns 200 with ok:true and options", async () => {
    const response = await POST(makeRequest())
    const body = await response.json() as { ok: boolean; options: unknown }
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.options).toBeDefined()
  })

  it("calls setPasskeyChallengeCookie with challenge, email, and userId", async () => {
    await POST(makeRequest())
    expect(mockSetChallengeCookie).toHaveBeenCalledOnce()
    const [, , state] = mockSetChallengeCookie.mock.calls[0] as [
      unknown,
      unknown,
      { challenge: string; email: string; userId: string },
    ]
    expect(state.challenge).toBe("auth-challenge")
    expect(state.email).toBe(ADMIN_EMAIL)
    expect(state.userId).toBe(ADMIN_ID)
  })
})
