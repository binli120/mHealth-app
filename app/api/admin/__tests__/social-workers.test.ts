/**
 * Unit tests for the admin social-workers API routes.
 *   GET   /api/admin/social-workers  — list with filters
 *   PATCH /api/admin/social-workers  — approve / reject
 *
 * Auth and DB are mocked; only route handler logic is exercised.
 * @author Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db/admin", () => ({
  listSocialWorkers:        vi.fn(),
  updateSocialWorkerStatus: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { GET, PATCH } from "@/app/api/admin/social-workers/route"
import { requireAdmin } from "@/lib/auth/require-admin"
import { listSocialWorkers, updateSocialWorkerStatus } from "@/lib/db/admin"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_ID  = "admin-uuid-001"
const PROFILE_ID = "sw-profile-uuid-xyz"

function mockAdmin() {
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: ADMIN_ID } as never)
}

function mockAdminFail(status: number) {
  const res = new Response(JSON.stringify({ ok: false, error: "Forbidden" }), { status })
  vi.mocked(requireAdmin).mockResolvedValue({ ok: false, response: res } as never)
}

function makeGet(path: string) {
  return new Request(`http://localhost${path}`)
}

function makePatch(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const SAMPLE_SW = {
  id: PROFILE_ID,
  user_id: "user-uuid-sw",
  email: "james@acme.com",
  first_name: "James",
  last_name: "Rivera",
  company_id: "company-uuid-abc",
  company_name: "Acme Health",
  license_number: "LIC-001",
  job_title: "Case Manager",
  status: "pending" as const,
  rejection_note: null,
  created_at: "2026-01-01T00:00:00.000Z",
}

const SAMPLE_LIST = { socialWorkers: [SAMPLE_SW], total: 1 }

beforeEach(() => { vi.clearAllMocks() })

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/admin/social-workers", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await GET(makeGet("/api/admin/social-workers"))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not an admin", async () => {
    mockAdminFail(403)
    const res = await GET(makeGet("/api/admin/social-workers"))
    expect(res.status).toBe(403)
  })

  it("returns 200 with the social worker list", async () => {
    mockAdmin()
    vi.mocked(listSocialWorkers).mockResolvedValue(SAMPLE_LIST)

    const res = await GET(makeGet("/api/admin/social-workers"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.socialWorkers).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it("passes default limit 50 and offset 0 when not specified", async () => {
    mockAdmin()
    vi.mocked(listSocialWorkers).mockResolvedValue({ socialWorkers: [], total: 0 })

    await GET(makeGet("/api/admin/social-workers"))

    expect(listSocialWorkers).toHaveBeenCalledWith({
      search: undefined, status: undefined, companyId: undefined, limit: 50, offset: 0,
    })
  })

  it("passes search, status, and companyId query params", async () => {
    mockAdmin()
    vi.mocked(listSocialWorkers).mockResolvedValue({ socialWorkers: [], total: 0 })

    await GET(makeGet("/api/admin/social-workers?search=james&status=pending&companyId=company-uuid-abc"))

    expect(listSocialWorkers).toHaveBeenCalledWith({
      search: "james",
      status: "pending",
      companyId: "company-uuid-abc",
      limit: 50,
      offset: 0,
    })
  })

  it("passes custom limit and offset", async () => {
    mockAdmin()
    vi.mocked(listSocialWorkers).mockResolvedValue({ socialWorkers: [], total: 0 })

    await GET(makeGet("/api/admin/social-workers?limit=10&offset=20"))

    expect(listSocialWorkers).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 20 }))
  })

  it("clamps limit to 100", async () => {
    mockAdmin()
    vi.mocked(listSocialWorkers).mockResolvedValue({ socialWorkers: [], total: 0 })

    await GET(makeGet("/api/admin/social-workers?limit=500"))

    expect(listSocialWorkers).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/social-workers", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await PATCH(makePatch("/api/admin/social-workers", { profileId: PROFILE_ID, action: "approve" }))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not an admin", async () => {
    mockAdminFail(403)
    const res = await PATCH(makePatch("/api/admin/social-workers", { profileId: PROFILE_ID, action: "approve" }))
    expect(res.status).toBe(403)
  })

  it("returns 400 when profileId is missing", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/social-workers", { action: "approve" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it("returns 400 when action is missing", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/social-workers", { profileId: PROFILE_ID }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it("returns 400 for an invalid action value", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/social-workers", { profileId: PROFILE_ID, action: "delete" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/approve or reject/i)
  })

  it("calls updateSocialWorkerStatus with 'approved' for approve action", async () => {
    mockAdmin()
    vi.mocked(updateSocialWorkerStatus).mockResolvedValue(undefined)

    const res = await PATCH(makePatch("/api/admin/social-workers", { profileId: PROFILE_ID, action: "approve" }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(updateSocialWorkerStatus).toHaveBeenCalledWith(PROFILE_ID, "approved", ADMIN_ID, undefined)
  })

  it("calls updateSocialWorkerStatus with 'rejected' and no note when no rejectionNote given", async () => {
    mockAdmin()
    vi.mocked(updateSocialWorkerStatus).mockResolvedValue(undefined)

    await PATCH(makePatch("/api/admin/social-workers", { profileId: PROFILE_ID, action: "reject" }))

    expect(updateSocialWorkerStatus).toHaveBeenCalledWith(PROFILE_ID, "rejected", ADMIN_ID, undefined)
  })

  it("passes rejectionNote through when rejecting", async () => {
    mockAdmin()
    vi.mocked(updateSocialWorkerStatus).mockResolvedValue(undefined)

    await PATCH(makePatch("/api/admin/social-workers", {
      profileId: PROFILE_ID,
      action: "reject",
      rejectionNote: "License could not be verified",
    }))

    expect(updateSocialWorkerStatus).toHaveBeenCalledWith(
      PROFILE_ID,
      "rejected",
      ADMIN_ID,
      "License could not be verified",
    )
  })

  it("returns 400 for malformed JSON body", async () => {
    mockAdmin()
    const req = new Request("http://localhost/api/admin/social-workers", {
      method: "PATCH",
      body: "not-json",
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
