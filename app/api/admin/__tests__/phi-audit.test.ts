/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for GET /api/admin/phi-audit
 * Auth and DB are mocked; only route handler logic is exercised.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db/phi-audit", () => ({
  getPhiAuditLogs: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({ logServerError: vi.fn() }))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { GET } from "@/app/api/admin/phi-audit/route"
import { requireAdmin } from "@/lib/auth/require-admin"
import { getPhiAuditLogs } from "@/lib/db/phi-audit"
import type { PhiAuditEntry } from "@/lib/db/phi-audit"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_ID = "admin-uuid-001"

function mockAdmin() {
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: ADMIN_ID } as never)
}

function mockAdminFail(status: number) {
  const res = new Response(JSON.stringify({ ok: false, error: "Forbidden" }), { status })
  vi.mocked(requireAdmin).mockResolvedValue({ ok: false, response: res } as never)
}

function makeRequest(url: string) {
  return new Request(`http://localhost${url}`)
}

const SAMPLE_ENTRIES: PhiAuditEntry[] = [
  {
    id: "entry-1",
    userId: "user-abc",
    action: "phi.ssn.decrypted",
    ipAddress: "1.2.3.4",
    metadata: { purpose: "pdf-generation" },
    createdAt: "2026-04-27T10:00:00Z",
  },
]

beforeEach(() => { vi.clearAllMocks() })

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/phi-audit", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await GET(makeRequest("/api/admin/phi-audit"))
    expect(res.status).toBe(401)
  })

  it("returns 403 when authenticated but not an admin", async () => {
    mockAdminFail(403)
    const res = await GET(makeRequest("/api/admin/phi-audit"))
    expect(res.status).toBe(403)
  })

  it("returns paginated phi audit entries to an admin", async () => {
    mockAdmin()
    vi.mocked(getPhiAuditLogs).mockResolvedValue({ entries: SAMPLE_ENTRIES, total: 1 })

    const res = await GET(makeRequest("/api/admin/phi-audit"))
    expect(res.status).toBe(200)

    const body = await res.json() as { ok: boolean; entries: PhiAuditEntry[]; total: number }
    expect(body.ok).toBe(true)
    expect(body.entries).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.entries[0]!.action).toBe("phi.ssn.decrypted")
  })

  it("forwards userId query param to getPhiAuditLogs", async () => {
    mockAdmin()
    vi.mocked(getPhiAuditLogs).mockResolvedValue({ entries: [], total: 0 })

    await GET(makeRequest("/api/admin/phi-audit?userId=user-xyz&limit=25&offset=50"))

    expect(vi.mocked(getPhiAuditLogs)).toHaveBeenCalledWith({
      userId: "user-xyz",
      limit: 25,
      offset: 50,
    })
  })

  it("uses default pagination when no params are given", async () => {
    mockAdmin()
    vi.mocked(getPhiAuditLogs).mockResolvedValue({ entries: [], total: 0 })

    await GET(makeRequest("/api/admin/phi-audit"))

    expect(vi.mocked(getPhiAuditLogs)).toHaveBeenCalledWith({
      userId: undefined,
      limit: 50,
      offset: 0,
    })
  })

  it("caps limit at 200 regardless of the requested value", async () => {
    mockAdmin()
    vi.mocked(getPhiAuditLogs).mockResolvedValue({ entries: [], total: 0 })

    await GET(makeRequest("/api/admin/phi-audit?limit=9999"))

    expect(vi.mocked(getPhiAuditLogs)).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 }),
    )
  })

  it("returns 500 when getPhiAuditLogs throws", async () => {
    mockAdmin()
    vi.mocked(getPhiAuditLogs).mockRejectedValue(new Error("DB error"))

    const res = await GET(makeRequest("/api/admin/phi-audit"))
    expect(res.status).toBe(500)

    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(false)
  })
})
