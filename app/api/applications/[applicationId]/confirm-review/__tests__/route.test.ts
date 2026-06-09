import { describe, it, expect, vi, beforeEach } from "vitest"

const mockConfirmCustomerReview = vi.fn()
vi.mock("@/lib/db/application-drafts", () => ({
  confirmCustomerReview: mockConfirmCustomerReview,
}))

const mockRequireAuth = vi.fn()
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: mockRequireAuth,
}))

const { PATCH } = await import("../route")

describe("PATCH /api/applications/[applicationId]/confirm-review", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    })
    const res = await PATCH(new Request("http://test/api/applications/app-1/confirm-review"), {
      params: Promise.resolve({ applicationId: "app-1" }),
    })
    expect(res.status).toBe(401)
  })

  it("calls confirmCustomerReview and returns ok:true on success", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, userId: "user-1" })
    mockConfirmCustomerReview.mockResolvedValue(undefined)
    const res = await PATCH(new Request("http://test/api/applications/app-1/confirm-review"), {
      params: Promise.resolve({ applicationId: "app-1" }),
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockConfirmCustomerReview).toHaveBeenCalledWith("app-1", "user-1")
  })
})
