/**
 * Unit tests for GET /api/admin/stats
 * Auth and DB are mocked; only route handler logic is exercised.
 * @author Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db/admin", () => ({
  getAdminStats: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { GET } from "@/app/api/admin/stats/route"
import { requireAdmin } from "@/lib/auth/require-admin"
import { getAdminStats } from "@/lib/db/admin"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_ID = "admin-uuid-001"

function mockAdmin() {
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: ADMIN_ID } as never)
}

function mockAdminFail(status: number) {
  const res = new Response(JSON.stringify({ ok: false, error: "Forbidden" }), { status })
  vi.mocked(requireAdmin).mockResolvedValue({ ok: false, response: res } as never)
}

function makeRequest(path: string) {
  return new Request(`http://localhost${path}`)
}

const SAMPLE_STATS = {
  totalUsers: 42,
  pendingSwApprovals: 3,
  totalCompanies: 7,
  pendingCompanies: 2,
}

beforeEach(() => { vi.clearAllMocks() })

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/stats", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await GET(makeRequest("/api/admin/stats"))
    expect(res.status).toBe(401)
  })

  it("returns 403 when authenticated but not an admin", async () => {
    mockAdminFail(403)
    const res = await GET(makeRequest("/api/admin/stats"))
    expect(res.status).toBe(403)
  })

  it("returns 200 with stats on success", async () => {
    mockAdmin()
    vi.mocked(getAdminStats).mockResolvedValue(SAMPLE_STATS)

    const res = await GET(makeRequest("/api/admin/stats"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.stats).toEqual(SAMPLE_STATS)
  })

  it("calls getAdminStats exactly once per request", async () => {
    mockAdmin()
    vi.mocked(getAdminStats).mockResolvedValue(SAMPLE_STATS)

    await GET(makeRequest("/api/admin/stats"))

    expect(getAdminStats).toHaveBeenCalledOnce()
    expect(getAdminStats).toHaveBeenCalledWith()
  })

  it("propagates DB errors (no try-catch in route)", async () => {
    mockAdmin()
    vi.mocked(getAdminStats).mockRejectedValue(new Error("DB connection lost"))

    await expect(GET(makeRequest("/api/admin/stats"))).rejects.toThrow("DB connection lost")
  })
})
