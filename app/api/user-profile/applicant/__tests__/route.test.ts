/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

vi.mock("@/lib/db/user-profile", () => ({
  updateApplicantInfo: vi.fn(),
}))

import { PUT } from "@/app/api/user-profile/applicant/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { updateApplicantInfo } from "@/lib/db/user-profile"

const USER_ID = "11111111-1111-4111-8111-111111111111"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/user-profile/applicant", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  vi.mocked(updateApplicantInfo).mockResolvedValue(undefined as never)
})

describe("PUT /api/user-profile/applicant — auth", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)
    const res = await PUT(makeRequest({ firstName: "Jane" }))
    expect(res.status).toBe(401)
    expect(updateApplicantInfo).not.toHaveBeenCalled()
  })
})

describe("PUT /api/user-profile/applicant — validation", () => {
  it("returns 400 for an invalid phone number", async () => {
    const res = await PUT(makeRequest({ phone: "abc" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Invalid profile data submitted.")
    expect(updateApplicantInfo).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid ZIP code", async () => {
    const res = await PUT(makeRequest({ zip: "abc" }))
    expect(res.status).toBe(400)
    expect(updateApplicantInfo).not.toHaveBeenCalled()
  })

  it("returns 400 when state is not exactly 2 characters", async () => {
    const res = await PUT(makeRequest({ state: "Massachusetts" }))
    expect(res.status).toBe(400)
    expect(updateApplicantInfo).not.toHaveBeenCalled()
  })

  it("returns 400 for an empty firstName", async () => {
    const res = await PUT(makeRequest({ firstName: "" }))
    expect(res.status).toBe(400)
    expect(updateApplicantInfo).not.toHaveBeenCalled()
  })

  it("returns 400 for a firstName over the max length", async () => {
    const res = await PUT(makeRequest({ firstName: "a".repeat(61) }))
    expect(res.status).toBe(400)
    expect(updateApplicantInfo).not.toHaveBeenCalled()
  })

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/user-profile/applicant", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })
})

describe("PUT /api/user-profile/applicant — happy path", () => {
  it("accepts a partial update with only some fields", async () => {
    const res = await PUT(makeRequest({ phone: "(617) 555-0199" }))
    expect(res.status).toBe(200)
    expect(updateApplicantInfo).toHaveBeenCalledWith(USER_ID, { phone: "(617) 555-0199" })
  })

  it("accepts a full valid update", async () => {
    const payload = {
      firstName: "Jane",
      lastName: "Doe",
      phone: "617-555-0199",
      addressLine1: "123 Main St",
      city: "Boston",
      state: "MA",
      zip: "02101",
    }
    const res = await PUT(makeRequest(payload))
    expect(res.status).toBe(200)
    expect(updateApplicantInfo).toHaveBeenCalledWith(USER_ID, payload)
  })

  it("accepts an empty body (no fields to update)", async () => {
    const res = await PUT(makeRequest({}))
    expect(res.status).toBe(200)
    expect(updateApplicantInfo).toHaveBeenCalledWith(USER_ID, {})
  })
})
