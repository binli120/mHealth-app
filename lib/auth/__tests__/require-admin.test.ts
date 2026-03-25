/**
 * Unit tests for lib/auth/require-admin.ts
 * requireAuthenticatedUser and the DB pool are mocked; only the admin role
 * check logic is exercised.
 * @author Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

// requireAdmin runs TWO queries: a debug role-list query, then the is_admin EXISTS query.
// mockDbQuery is called in that order each test.
const mockDbQuery = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: vi.fn(() => ({ query: mockDbQuery })),
}))

// Silence console output from the debug console.log calls in requireAdmin
vi.spyOn(console, "log").mockImplementation(() => undefined)

import { requireAdmin } from "@/lib/auth/require-admin"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

const mockAuth = vi.mocked(requireAuthenticatedUser)

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"

function makeRequest(): Request {
  return new Request("http://localhost/api/admin/test", {
    headers: { authorization: "Bearer sometoken" },
  })
}

/**
 * requireAdmin calls pool.query() twice:
 *   1st call: debug query (SELECT roles for user) — return any rows array
 *   2nd call: EXISTS is_admin query — return { rows: [{ is_admin }] }
 */
function mockAdminDb(isAdmin: boolean): void {
  mockDbQuery
    .mockResolvedValueOnce({ rows: [] })                      // debug query
    .mockResolvedValueOnce({ rows: [{ is_admin: isAdmin }] }) // is_admin EXISTS query
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
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID })
  })

  it("returns ok: true with the userId when the user has the admin role", async () => {
    mockAdminDb(true)

    const result = await requireAdmin(makeRequest())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(USER_ID)
  })

  it("runs exactly two DB queries (debug + is_admin)", async () => {
    mockAdminDb(true)

    await requireAdmin(makeRequest())
    expect(mockDbQuery).toHaveBeenCalledTimes(2)
  })

  it("passes the correct userId to the is_admin query", async () => {
    mockAdminDb(true)

    await requireAdmin(makeRequest())
    // 2nd call is the EXISTS query; first arg is SQL, second is params array
    const [, params] = mockDbQuery.mock.calls[1] as [string, string[]]
    expect(params).toEqual([USER_ID])
  })
})

// ── Non-admin user ────────────────────────────────────────────────────────────

describe("requireAdmin — non-admin user", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID })
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
      .mockResolvedValueOnce({ rows: [] }) // debug
      .mockResolvedValueOnce({ rows: [] }) // is_admin — missing row

    const result = await requireAdmin(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })

  it("returns 403 when is_admin is null/undefined", async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ is_admin: null }] })

    const result = await requireAdmin(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })
})
