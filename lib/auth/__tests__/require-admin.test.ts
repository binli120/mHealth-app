/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Unit tests for lib/auth/require-admin.ts
 * requireAuthenticatedUser and the DB pool are mocked; only the admin role
 * check logic is exercised.
 * @author: Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockIsLocalRequest = vi.fn(() => false)
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
  isLocalRequest: (...args: unknown[]) => mockIsLocalRequest(...args),
}))

const mockIsLocalAuthHelperEnabled = vi.fn(() => false)
vi.mock("@/lib/auth/local-auth", () => ({
  isLocalAuthHelperEnabled: () => mockIsLocalAuthHelperEnabled(),
}))

const mockDbQuery = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: vi.fn(() => ({ query: mockDbQuery })),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

import { requireAdmin } from "@/lib/auth/require-admin"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"

const mockLogServerError = vi.mocked(logServerError)

const mockAuth = vi.mocked(requireAuthenticatedUser)

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"

function makeRequest(): Request {
  return new Request("http://localhost/api/admin/test", {
    headers: { authorization: "Bearer sometoken" },
  })
}

function mockAdminDb(isAdmin: boolean, require2fa: string | null = "true"): void {
  mockDbQuery.mockResolvedValueOnce({ rows: [{ is_admin: isAdmin, require_2fa: require2fa }] })
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("requireAdmin — auth guard", () => {
  it("propagates a 401 response when the user is not authenticated", async () => {
    const unauthedResponse = new Response(
      JSON.stringify({ ok: false, error: "Authentication required." }),
      { status: 401 },
    )
    mockAuth.mockResolvedValue({ ok: false, response: unauthedResponse as never })

    const result = await requireAdmin(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
    // DB should never be reached
    expect(mockDbQuery).not.toHaveBeenCalled()
  })
})

// ── Admin user ────────────────────────────────────────────────────────────────

describe("requireAdmin — admin user", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID, aal: "aal2", isPasskeySession: false })
  })

  it("returns ok: true with the userId when the user has the admin role", async () => {
    mockAdminDb(true)

    const result = await requireAdmin(makeRequest())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(USER_ID)
  })

  it("runs exactly one DB query (is_admin EXISTS)", async () => {
    mockAdminDb(true)

    await requireAdmin(makeRequest())
    expect(mockDbQuery).toHaveBeenCalledTimes(1)
  })

  it("passes the correct userId to the is_admin query", async () => {
    mockAdminDb(true)

    await requireAdmin(makeRequest())
    const [, params] = mockDbQuery.mock.calls[0] as [string, string[]]
    expect(params).toEqual([USER_ID])
  })
})

// ── Non-admin user ────────────────────────────────────────────────────────────

describe("requireAdmin — non-admin user", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID, aal: "aal2", isPasskeySession: false })
  })

  it("returns 403 when is_admin is false", async () => {
    mockAdminDb(false)

    const result = await requireAdmin(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      const body = await result.response.json() as { error: string }
      expect(body.error).toMatch(/admin access required/i)
    }
  })

  it("returns 403 when the DB returns no rows", async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [] }) // is_admin — missing row

    const result = await requireAdmin(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })

  it("returns 403 when is_admin is null/undefined", async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ is_admin: null }] })

    const result = await requireAdmin(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })
})

// ── Local dev bypass ──────────────────────────────────────────────────────────

describe("requireAdmin — local dev bypass", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID, aal: "aal1", isPasskeySession: false })
  })

  it("skips MFA check when local auth helper is enabled and request is local", async () => {
    mockIsLocalAuthHelperEnabled.mockReturnValueOnce(true)
    mockIsLocalRequest.mockReturnValueOnce(true)
    mockAdminDb(true)
    // MFA factors query must NOT be called

    const result = await requireAdmin(makeRequest())

    expect(result.ok).toBe(true)
    // Only the is_admin query
    expect(mockDbQuery).toHaveBeenCalledTimes(1)
  })

  it("enforces MFA when local auth helper is enabled but request is NOT local", async () => {
    mockIsLocalAuthHelperEnabled.mockReturnValueOnce(true)
    mockIsLocalRequest.mockReturnValueOnce(false)
    mockAdminDb(true)
    // No MFA enrolled
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] })

    const result = await requireAdmin(makeRequest())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const body = await result.response.json() as Record<string, unknown>
      expect(body.mfa_enrollment_required).toBe(true)
    }
  })

  it("enforces MFA when request is local but local auth helper is NOT enabled", async () => {
    mockIsLocalAuthHelperEnabled.mockReturnValueOnce(false)
    mockIsLocalRequest.mockReturnValueOnce(true)
    mockAdminDb(true)
    // No MFA enrolled
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] })

    const result = await requireAdmin(makeRequest())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const body = await result.response.json() as Record<string, unknown>
      expect(body.mfa_enrollment_required).toBe(true)
    }
  })
})

// ── MFA enforcement (aal1 TOTP sessions) ─────────────────────────────────────

describe("requireAdmin — MFA enforcement", () => {
  beforeEach(() => {
    // aal1: password-only session, not a passkey session
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID, aal: "aal1", isPasskeySession: false })
  })

  it("returns 403 mfa_enrollment_required when admin has no TOTP factor enrolled", async () => {
    mockAdminDb(true)
    // MFA factors query → 0 verified TOTP factors
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] })

    const result = await requireAdmin(makeRequest())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      const body = await result.response.json() as Record<string, unknown>
      expect(body.mfa_enrollment_required).toBe(true)
      expect(body.mfa_required).toBeUndefined()
    }
  })

  it("returns 403 mfa_required when admin has TOTP enrolled but aal is aal1", async () => {
    mockAdminDb(true)
    // MFA factors query → 1 verified TOTP factor
    mockDbQuery.mockResolvedValueOnce({ rows: [{ count: "1" }] })

    const result = await requireAdmin(makeRequest())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      const body = await result.response.json() as Record<string, unknown>
      expect(body.mfa_required).toBe(true)
      expect(body.mfa_enrollment_required).toBeUndefined()
    }
  })

  it("returns 503 and logs when the MFA factors DB query throws — fails CLOSED", async () => {
    mockAdminDb(true)
    const dbError = new Error("connection timeout")
    mockDbQuery.mockRejectedValueOnce(dbError)

    const result = await requireAdmin(makeRequest())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(503)
      const body = await result.response.json() as Record<string, unknown>
      expect(typeof body.error).toBe("string")
    }
    expect(mockLogServerError).toHaveBeenCalledWith(
      expect.stringMatching(/MFA factors/i),
      dbError,
      expect.objectContaining({ userId: USER_ID }),
    )
  })

  it("skips MFA check entirely for passkey sessions (any aal)", async () => {
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID, aal: "aal1", isPasskeySession: true })
    mockAdminDb(true)
    // MFA factors query must NOT be called — passkey is inherently strong 2FA

    const result = await requireAdmin(makeRequest())

    expect(result.ok).toBe(true)
    // Only one DB query: the is_admin check
    expect(mockDbQuery).toHaveBeenCalledTimes(1)
  })

  it("returns ok: true for admin with aal2 without querying MFA factors", async () => {
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID, aal: "aal2", isPasskeySession: false })
    mockAdminDb(true)

    const result = await requireAdmin(makeRequest())

    expect(result.ok).toBe(true)
    // Only the is_admin query — MFA factors query skipped because aal === "aal2"
    expect(mockDbQuery).toHaveBeenCalledTimes(1)
  })
})

// ── require_2fa_admin setting validation ──────────────────────────────────────

describe("requireAdmin — require_2fa_admin DB setting", () => {
  beforeEach(() => {
    // Use aal2 + passkey so we reach the setting check without MFA factor queries.
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID, aal: "aal2", isPasskeySession: false })
  })

  it("does not log a warning when require_2fa is 'true'", async () => {
    mockAdminDb(true, "true")

    await requireAdmin(makeRequest())

    expect(mockLogServerError).not.toHaveBeenCalled()
  })

  it("logs a SECURITY warning and still allows access when require_2fa is 'false'", async () => {
    mockAdminDb(true, "false")

    const result = await requireAdmin(makeRequest())

    // Misconfigured setting must not block access — code enforces unconditionally
    expect(result.ok).toBe(true)
    expect(mockLogServerError).toHaveBeenCalledWith(
      expect.stringMatching(/SECURITY/i),
      expect.any(Error),
      expect.objectContaining({ currentValue: "false" }),
    )
  })

  it("logs a SECURITY warning when require_2fa is null (row missing)", async () => {
    mockAdminDb(true, null)

    const result = await requireAdmin(makeRequest())

    expect(result.ok).toBe(true)
    expect(mockLogServerError).toHaveBeenCalledWith(
      expect.stringMatching(/SECURITY/i),
      expect.any(Error),
      expect.objectContaining({ currentValue: "(missing)" }),
    )
  })
})
