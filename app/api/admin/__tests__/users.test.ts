/**
 * Unit tests for the admin users API routes.
 *   GET   /api/admin/users  — list with filters + optional companies
 *   PATCH /api/admin/users  — set_active / set_role
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
  listUsers:              vi.fn(),
  setUserActive:          vi.fn(),
  setUserRole:            vi.fn(),
  listCompaniesForSelect: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { GET, PATCH } from "@/app/api/admin/users/route"
import { requireAdmin } from "@/lib/auth/require-admin"
import { listUsers, setUserActive, setUserRole, listCompaniesForSelect } from "@/lib/db/admin"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_ID  = "admin-uuid-001"
const TARGET_UID = "user-uuid-target"

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

const SAMPLE_USER = {
  id: TARGET_UID,
  email: "patient@example.com",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  roles: ["applicant"],
  first_name: "Jane",
  last_name: "Doe",
  company_id: null,
  company_name: null,
}

const SAMPLE_COMPANY_SELECT = [
  { id: "company-uuid-1", name: "Acme Health", email_domain: "acme.com", status: "approved" },
]

beforeEach(() => { vi.clearAllMocks() })

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/admin/users", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await GET(makeGet("/api/admin/users"))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not an admin", async () => {
    mockAdminFail(403)
    const res = await GET(makeGet("/api/admin/users"))
    expect(res.status).toBe(403)
  })

  it("returns 200 with the user list", async () => {
    mockAdmin()
    vi.mocked(listUsers).mockResolvedValue({ users: [SAMPLE_USER], total: 1 })

    const res = await GET(makeGet("/api/admin/users"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.users).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it("passes default limit 50 and offset 0", async () => {
    mockAdmin()
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 })

    await GET(makeGet("/api/admin/users"))

    expect(listUsers).toHaveBeenCalledWith({
      search: undefined, role: undefined, companyId: undefined, limit: 50, offset: 0,
    })
  })

  it("passes search, role, and company_id query params", async () => {
    mockAdmin()
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 })

    await GET(makeGet("/api/admin/users?search=jane&role=admin&company_id=company-uuid-1"))

    expect(listUsers).toHaveBeenCalledWith({
      search: "jane",
      role: "admin",
      companyId: "company-uuid-1",
      limit: 50,
      offset: 0,
    })
  })

  it("clamps limit to 100", async () => {
    mockAdmin()
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 })

    await GET(makeGet("/api/admin/users?limit=9999"))

    expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
  })

  it("does NOT fetch companies by default", async () => {
    mockAdmin()
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 })

    const res = await GET(makeGet("/api/admin/users"))
    const json = await res.json()

    expect(listCompaniesForSelect).not.toHaveBeenCalled()
    expect(json.companies).toBeUndefined()
  })

  it("includes companies in the response when companies=1", async () => {
    mockAdmin()
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 })
    vi.mocked(listCompaniesForSelect).mockResolvedValue(SAMPLE_COMPANY_SELECT)

    const res = await GET(makeGet("/api/admin/users?companies=1"))
    const json = await res.json()

    expect(listCompaniesForSelect).toHaveBeenCalledOnce()
    expect(json.companies).toEqual(SAMPLE_COMPANY_SELECT)
  })

  it("fetches users and companies in parallel when companies=1", async () => {
    mockAdmin()
    vi.mocked(listUsers).mockResolvedValue({ users: [SAMPLE_USER], total: 1 })
    vi.mocked(listCompaniesForSelect).mockResolvedValue(SAMPLE_COMPANY_SELECT)

    const res = await GET(makeGet("/api/admin/users?companies=1"))
    const json = await res.json()

    expect(json.users).toHaveLength(1)
    expect(json.companies).toHaveLength(1)
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/users", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await PATCH(makePatch("/api/admin/users", { userId: TARGET_UID, action: "set_active", isActive: false }))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not an admin", async () => {
    mockAdminFail(403)
    const res = await PATCH(makePatch("/api/admin/users", { userId: TARGET_UID, action: "set_active", isActive: false }))
    expect(res.status).toBe(403)
  })

  it("returns 400 when userId is missing", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/users", { action: "set_active", isActive: false }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it("returns 400 when action is missing", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/users", { userId: TARGET_UID }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  // ── set_active ─────────────────────────────────────────────────────────────

  it("calls setUserActive(userId, false) to deactivate a user", async () => {
    mockAdmin()
    vi.mocked(setUserActive).mockResolvedValue(undefined)

    const res = await PATCH(makePatch("/api/admin/users", { userId: TARGET_UID, action: "set_active", isActive: false }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(setUserActive).toHaveBeenCalledWith(TARGET_UID, false)
  })

  it("calls setUserActive(userId, true) to reactivate a user", async () => {
    mockAdmin()
    vi.mocked(setUserActive).mockResolvedValue(undefined)

    await PATCH(makePatch("/api/admin/users", { userId: TARGET_UID, action: "set_active", isActive: true }))

    expect(setUserActive).toHaveBeenCalledWith(TARGET_UID, true)
  })

  it("returns 400 for set_active when isActive is not a boolean", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/users", { userId: TARGET_UID, action: "set_active", isActive: "yes" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/isActive/i)
    expect(setUserActive).not.toHaveBeenCalled()
  })

  it("returns 400 for set_active when isActive is omitted", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/users", { userId: TARGET_UID, action: "set_active" }))

    expect(res.status).toBe(400)
  })

  // ── set_role ───────────────────────────────────────────────────────────────

  it("calls setUserRole to add a role", async () => {
    mockAdmin()
    vi.mocked(setUserRole).mockResolvedValue(undefined)

    const res = await PATCH(makePatch("/api/admin/users", {
      userId: TARGET_UID,
      action: "set_role",
      roleName: "admin",
      add: true,
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(setUserRole).toHaveBeenCalledWith(TARGET_UID, "admin", true)
  })

  it("calls setUserRole to remove a role", async () => {
    mockAdmin()
    vi.mocked(setUserRole).mockResolvedValue(undefined)

    await PATCH(makePatch("/api/admin/users", {
      userId: TARGET_UID,
      action: "set_role",
      roleName: "admin",
      add: false,
    }))

    expect(setUserRole).toHaveBeenCalledWith(TARGET_UID, "admin", false)
  })

  it("returns 400 for set_role when roleName is missing", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/users", {
      userId: TARGET_UID,
      action: "set_role",
      add: true,
    }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(setUserRole).not.toHaveBeenCalled()
  })

  it("returns 400 for set_role when add is not a boolean", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/users", {
      userId: TARGET_UID,
      action: "set_role",
      roleName: "admin",
      add: "yes",
    }))

    expect(res.status).toBe(400)
    expect(setUserRole).not.toHaveBeenCalled()
  })

  // ── unknown action ─────────────────────────────────────────────────────────

  it("returns 400 for an unknown action", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/users", { userId: TARGET_UID, action: "delete" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/unknown action/i)
  })

  it("returns 400 for malformed JSON body", async () => {
    mockAdmin()
    const req = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      body: "not-json",
    })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })
})
