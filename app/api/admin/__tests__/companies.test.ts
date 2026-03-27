/**
 * Unit tests for the admin companies API routes.
 *   GET   /api/admin/companies  — list with filters
 *   POST  /api/admin/companies  — create company
 *   PATCH /api/admin/companies  — approve / reject / set email domain
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
  listCompanies:            vi.fn(),
  createCompany:            vi.fn(),
  updateCompanyStatus:      vi.fn(),
  updateCompanyEmailDomain: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { GET, POST, PATCH } from "@/app/api/admin/companies/route"
import { requireAdmin } from "@/lib/auth/require-admin"
import {
  listCompanies,
  createCompany,
  updateCompanyStatus,
  updateCompanyEmailDomain,
} from "@/lib/db/admin"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_ID = "admin-uuid-001"
const COMPANY_ID = "company-uuid-abc"

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

function makePost(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makePatch(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const SAMPLE_COMPANY = {
  id: COMPANY_ID,
  name: "Acme Health",
  npi: null,
  address: null,
  city: null,
  state: null,
  zip: null,
  phone: null,
  email_domain: "acme.com",
  status: "pending" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  approved_at: null,
  sw_count: 0,
}

const SAMPLE_LIST = { companies: [SAMPLE_COMPANY], total: 1 }

beforeEach(() => { vi.clearAllMocks() })

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/admin/companies", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await GET(makeGet("/api/admin/companies"))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not an admin", async () => {
    mockAdminFail(403)
    const res = await GET(makeGet("/api/admin/companies"))
    expect(res.status).toBe(403)
  })

  it("returns 200 with the company list", async () => {
    mockAdmin()
    vi.mocked(listCompanies).mockResolvedValue(SAMPLE_LIST)

    const res = await GET(makeGet("/api/admin/companies"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.companies).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it("passes default limit 50 and offset 0", async () => {
    mockAdmin()
    vi.mocked(listCompanies).mockResolvedValue({ companies: [], total: 0 })

    await GET(makeGet("/api/admin/companies"))

    expect(listCompanies).toHaveBeenCalledWith({ search: undefined, status: undefined, limit: 50, offset: 0 })
  })

  it("passes search and status query params", async () => {
    mockAdmin()
    vi.mocked(listCompanies).mockResolvedValue({ companies: [], total: 0 })

    await GET(makeGet("/api/admin/companies?search=acme&status=pending"))

    expect(listCompanies).toHaveBeenCalledWith({ search: "acme", status: "pending", limit: 50, offset: 0 })
  })

  it("passes custom limit and offset", async () => {
    mockAdmin()
    vi.mocked(listCompanies).mockResolvedValue({ companies: [], total: 0 })

    await GET(makeGet("/api/admin/companies?limit=10&offset=20"))

    expect(listCompanies).toHaveBeenCalledWith({ search: undefined, status: undefined, limit: 10, offset: 20 })
  })

  it("clamps limit to 100 even when a larger value is supplied", async () => {
    mockAdmin()
    vi.mocked(listCompanies).mockResolvedValue({ companies: [], total: 0 })

    await GET(makeGet("/api/admin/companies?limit=999"))

    expect(listCompanies).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
  })
})

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/admin/companies", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await POST(makePost("/api/admin/companies", { name: "Test Corp" }))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not an admin", async () => {
    mockAdminFail(403)
    const res = await POST(makePost("/api/admin/companies", { name: "Test Corp" }))
    expect(res.status).toBe(403)
  })

  it("returns 400 when company name is missing", async () => {
    mockAdmin()
    const res = await POST(makePost("/api/admin/companies", {}))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/name/i)
  })

  it("returns 400 when company name is blank whitespace", async () => {
    mockAdmin()
    const res = await POST(makePost("/api/admin/companies", { name: "   " }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it("returns 400 when body is malformed JSON", async () => {
    mockAdmin()
    const req = new Request("http://localhost/api/admin/companies", {
      method: "POST",
      body: "not-json",
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it("returns 201 with the created company on success", async () => {
    mockAdmin()
    vi.mocked(createCompany).mockResolvedValue(SAMPLE_COMPANY)

    const res = await POST(makePost("/api/admin/companies", { name: "  Acme Health  ", npi: "1234567890" }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.company).toEqual(SAMPLE_COMPANY)
  })

  it("trims whitespace from name before passing to DB", async () => {
    mockAdmin()
    vi.mocked(createCompany).mockResolvedValue(SAMPLE_COMPANY)

    await POST(makePost("/api/admin/companies", { name: "  Trimmed Name  " }))

    expect(createCompany).toHaveBeenCalledWith(expect.objectContaining({ name: "Trimmed Name" }))
  })

  it("passes optional fields through to createCompany", async () => {
    mockAdmin()
    vi.mocked(createCompany).mockResolvedValue(SAMPLE_COMPANY)

    await POST(makePost("/api/admin/companies", {
      name: "MedCo",
      npi: "9876543210",
      address: "123 Main St",
      city: "Boston",
      state: "MA",
      zip: "02101",
      phone: "617-555-0100",
      email_domain: "medco.com",
    }))

    expect(createCompany).toHaveBeenCalledWith({
      name: "MedCo",
      npi: "9876543210",
      address: "123 Main St",
      city: "Boston",
      state: "MA",
      zip: "02101",
      phone: "617-555-0100",
      email_domain: "medco.com",
    })
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/companies", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await PATCH(makePatch("/api/admin/companies", { companyId: COMPANY_ID, action: "approve" }))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not an admin", async () => {
    mockAdminFail(403)
    const res = await PATCH(makePatch("/api/admin/companies", { companyId: COMPANY_ID, action: "approve" }))
    expect(res.status).toBe(403)
  })

  it("returns 400 when companyId is missing", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/companies", { action: "approve" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it("returns 400 when action is missing", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/companies", { companyId: COMPANY_ID }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it("calls updateCompanyStatus with 'approved' for approve action", async () => {
    mockAdmin()
    vi.mocked(updateCompanyStatus).mockResolvedValue(undefined)

    const res = await PATCH(makePatch("/api/admin/companies", { companyId: COMPANY_ID, action: "approve" }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(updateCompanyStatus).toHaveBeenCalledWith(COMPANY_ID, "approved", ADMIN_ID)
  })

  it("calls updateCompanyStatus with 'rejected' for reject action", async () => {
    mockAdmin()
    vi.mocked(updateCompanyStatus).mockResolvedValue(undefined)

    const res = await PATCH(makePatch("/api/admin/companies", { companyId: COMPANY_ID, action: "reject" }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(updateCompanyStatus).toHaveBeenCalledWith(COMPANY_ID, "rejected", ADMIN_ID)
  })

  it("returns 400 for set_email_domain when emailDomain is missing", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/companies", { companyId: COMPANY_ID, action: "set_email_domain" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(updateCompanyEmailDomain).not.toHaveBeenCalled()
  })

  it("calls updateCompanyEmailDomain for set_email_domain action", async () => {
    mockAdmin()
    vi.mocked(updateCompanyEmailDomain).mockResolvedValue(undefined)

    const res = await PATCH(makePatch("/api/admin/companies", {
      companyId: COMPANY_ID,
      action: "set_email_domain",
      emailDomain: "newdomain.com",
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(updateCompanyEmailDomain).toHaveBeenCalledWith(COMPANY_ID, "newdomain.com")
  })

  it("returns 400 for an unknown action", async () => {
    mockAdmin()
    const res = await PATCH(makePatch("/api/admin/companies", { companyId: COMPANY_ID, action: "delete" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/unknown action/i)
  })
})
