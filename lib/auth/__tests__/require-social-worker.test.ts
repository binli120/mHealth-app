/**
 * Unit tests for lib/auth/require-social-worker.ts
 * requireAuthenticatedUser and the DB pool are mocked; only the social-worker
 * role check logic is exercised.
 * @author Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

const mockDbQuery = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: vi.fn(() => ({ query: mockDbQuery })),
}))

import { requireApprovedSocialWorker } from "@/lib/auth/require-social-worker"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

const mockAuth = vi.mocked(requireAuthenticatedUser)

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"

function makeRequest(): Request {
  return new Request("http://localhost/api/test", {
    headers: { authorization: "Bearer sometoken" },
  })
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("requireApprovedSocialWorker — auth guard", () => {
  it("returns the 401 response directly when the user is not authenticated", async () => {
    const unauthedResponse = new Response(JSON.stringify({ ok: false, error: "Authentication required." }), {
      status: 401,
    })
    mockAuth.mockResolvedValue({ ok: false, response: unauthedResponse as never })

    const result = await requireApprovedSocialWorker(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
    // DB should never be reached
    expect(mockDbQuery).not.toHaveBeenCalled()
  })
})

// ── Approved social worker ────────────────────────────────────────────────────

describe("requireApprovedSocialWorker — approved social worker", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID })
  })

  it("returns ok: true with the userId when the user has an approved social_worker role", async () => {
    mockDbQuery.mockResolvedValue({ rows: [{ approved: true }] })

    const result = await requireApprovedSocialWorker(makeRequest())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(USER_ID)
  })

  it("passes the correct userId to the DB query", async () => {
    mockDbQuery.mockResolvedValue({ rows: [{ approved: true }] })

    await requireApprovedSocialWorker(makeRequest())
    expect(mockDbQuery).toHaveBeenCalledOnce()
    expect(mockDbQuery.mock.calls[0][1]).toEqual([USER_ID])
  })
})

// ── Not an approved social worker ─────────────────────────────────────────────

describe("requireApprovedSocialWorker — not approved", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ ok: true, userId: USER_ID })
  })

  it("returns 403 when the DB query returns approved: false", async () => {
    mockDbQuery.mockResolvedValue({ rows: [{ approved: false }] })

    const result = await requireApprovedSocialWorker(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      const body = await result.response.json() as { error: string }
      expect(body.error).toMatch(/approved social worker/i)
    }
  })

  it("returns 403 when the DB returns no rows", async () => {
    mockDbQuery.mockResolvedValue({ rows: [] })

    const result = await requireApprovedSocialWorker(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })

  it("returns 403 when the DB row has a null/undefined approved field", async () => {
    mockDbQuery.mockResolvedValue({ rows: [{ approved: null }] })

    const result = await requireApprovedSocialWorker(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })
})
