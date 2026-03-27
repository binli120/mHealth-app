/**
 * Unit tests for POST /api/admin/users/invite
 * Auth, DB, and Resend are mocked; only route handler logic is exercised.
 * @author Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db/invitations", () => ({
  createInvitation: vi.fn(),
}))

vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: vi.fn() } },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { POST } from "@/app/api/admin/users/invite/route"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createInvitation } from "@/lib/db/invitations"
import { resend } from "@/lib/resend"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_ID   = "admin-uuid-001"
const INVITE_TOKEN = "tok_abc123"
const TEST_EMAIL   = "newuser@example.com"

function mockAdmin() {
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: ADMIN_ID } as never)
}

function mockAdminFail(status: number) {
  const res = new Response(JSON.stringify({ ok: false, error: "Forbidden" }), { status })
  vi.mocked(requireAdmin).mockResolvedValue({ ok: false, response: res } as never)
}

function mockInvitation() {
  vi.mocked(createInvitation).mockResolvedValue({ token: INVITE_TOKEN } as never)
}

function makePost(body: unknown) {
  return new Request("http://localhost/api/admin/users/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.RESEND_API_KEY
  delete process.env.NEXT_PUBLIC_APP_URL
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/admin/users/invite", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAdminFail(401)
    const res = await POST(makePost({ email: TEST_EMAIL }))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not an admin", async () => {
    mockAdminFail(403)
    const res = await POST(makePost({ email: TEST_EMAIL }))
    expect(res.status).toBe(403)
  })

  it("returns 400 when email is missing", async () => {
    mockAdmin()
    const res = await POST(makePost({}))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/email/i)
    expect(createInvitation).not.toHaveBeenCalled()
  })

  it("returns 400 when email is blank whitespace", async () => {
    mockAdmin()
    const res = await POST(makePost({ email: "   " }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(createInvitation).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid email address", async () => {
    mockAdmin()
    const res = await POST(makePost({ email: "not-an-email" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/invalid email/i)
    expect(createInvitation).not.toHaveBeenCalled()
  })

  it("returns 400 for email missing domain", async () => {
    mockAdmin()
    const res = await POST(makePost({ email: "user@" }))

    expect(res.status).toBe(400)
    expect(createInvitation).not.toHaveBeenCalled()
  })

  it("returns 400 for malformed JSON body", async () => {
    mockAdmin()
    const req = new Request("http://localhost/api/admin/users/invite", {
      method: "POST",
      body: "not-json",
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it("returns 200 with the inviteUrl on success", async () => {
    mockAdmin()
    mockInvitation()

    const res = await POST(makePost({ email: TEST_EMAIL }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.inviteUrl).toContain(INVITE_TOKEN)
    expect(json.inviteUrl).toContain("/auth/invite/")
  })

  it("passes trimmed email, companyId, role, and invitedBy to createInvitation", async () => {
    mockAdmin()
    mockInvitation()

    await POST(makePost({ email: "  admin@org.com  ", companyId: "company-uuid-1", role: "social_worker" }))

    expect(createInvitation).toHaveBeenCalledWith({
      email: "admin@org.com",
      companyId: "company-uuid-1",
      role: "social_worker",
      invitedBy: ADMIN_ID,
    })
  })

  it("defaults role to 'applicant' when not provided", async () => {
    mockAdmin()
    mockInvitation()

    await POST(makePost({ email: TEST_EMAIL }))

    expect(createInvitation).toHaveBeenCalledWith(expect.objectContaining({ role: "applicant" }))
  })

  it("passes null companyId when companyId is not provided", async () => {
    mockAdmin()
    mockInvitation()

    await POST(makePost({ email: TEST_EMAIL }))

    expect(createInvitation).toHaveBeenCalledWith(expect.objectContaining({ companyId: null }))
  })

  it("builds the inviteUrl from NEXT_PUBLIC_APP_URL env var", async () => {
    // APP_URL is a module-level const — must reload the module after setting the env var
    process.env.NEXT_PUBLIC_APP_URL = "https://app.healthcompassma.com"
    process.env.RESEND_API_KEY = undefined as unknown as string  // ensure no email send path

    vi.resetModules()

    // Re-establish mocks for the fresh module graph
    vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: vi.fn() }))
    vi.mock("@/lib/db/invitations",     () => ({ createInvitation: vi.fn() }))
    vi.mock("@/lib/resend",             () => ({ resend: { emails: { send: vi.fn() } } }))

    const { POST: freshPOST }      = await import("@/app/api/admin/users/invite/route")
    const { requireAdmin: freshRA } = await import("@/lib/auth/require-admin")
    const { createInvitation: freshCI } = await import("@/lib/db/invitations")

    vi.mocked(freshRA).mockResolvedValue({ ok: true, userId: ADMIN_ID } as never)
    vi.mocked(freshCI).mockResolvedValue({ token: INVITE_TOKEN } as never)

    const res = await freshPOST(makePost({ email: TEST_EMAIL }))
    const json = await res.json()

    expect(json.inviteUrl).toBe(`https://app.healthcompassma.com/auth/invite/${INVITE_TOKEN}`)
  })

  it("falls back to localhost:3000 when NEXT_PUBLIC_APP_URL is unset", async () => {
    mockAdmin()
    mockInvitation()

    const res = await POST(makePost({ email: TEST_EMAIL }))
    const json = await res.json()

    expect(json.inviteUrl).toContain("localhost:3000")
  })

  it("sends an invitation email when RESEND_API_KEY is set", async () => {
    mockAdmin()
    mockInvitation()
    process.env.RESEND_API_KEY = "re_test_key_123"
    vi.mocked(resend.emails.send).mockResolvedValue({ id: "email-id" } as never)

    await POST(makePost({ email: TEST_EMAIL }))

    expect(resend.emails.send).toHaveBeenCalledOnce()
    expect(resend.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      to: TEST_EMAIL,
      subject: expect.stringContaining("HealthCompass MA"),
      html: expect.stringContaining(INVITE_TOKEN),
    }))
  })

  it("does not send email when RESEND_API_KEY is absent", async () => {
    mockAdmin()
    mockInvitation()

    await POST(makePost({ email: TEST_EMAIL }))

    expect(resend.emails.send).not.toHaveBeenCalled()
  })

  it("still returns 200 even when Resend throws (email failure is non-fatal)", async () => {
    mockAdmin()
    mockInvitation()
    process.env.RESEND_API_KEY = "re_test_key_123"
    vi.mocked(resend.emails.send).mockRejectedValue(new Error("Resend API down"))

    const res = await POST(makePost({ email: TEST_EMAIL }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.inviteUrl).toContain(INVITE_TOKEN)
  })
})
