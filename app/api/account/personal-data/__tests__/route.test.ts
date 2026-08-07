import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

vi.mock("@/lib/auth/require-auth", () => ({ requireAuthenticatedUser: vi.fn() }))
vi.mock("@/lib/db/personal-data-reset", () => ({
  assertCustomerRole: vi.fn(),
  hasCustomerPersonalData: vi.fn(),
}))
vi.mock("@/lib/account/delete-personal-data", () => ({ resetPersonalData: vi.fn() }))
vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimitAsync: vi.fn(),
  personalDataResetLimiter: {},
}))
vi.mock("@/lib/server/logger", () => ({ logServerError: vi.fn() }))

import { DELETE, GET } from "@/app/api/account/personal-data/route"
import { resetPersonalData } from "@/lib/account/delete-personal-data"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { assertCustomerRole, hasCustomerPersonalData } from "@/lib/db/personal-data-reset"
import { checkRateLimitAsync } from "@/lib/server/rate-limit"

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function request(confirmation: unknown = "DELETE ALL DATA") {
  return new Request("http://localhost/api/account/personal-data", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  vi.mocked(assertCustomerRole).mockResolvedValue(true)
  vi.mocked(hasCustomerPersonalData).mockResolvedValue(false)
  vi.mocked(checkRateLimitAsync).mockResolvedValue(null)
  vi.mocked(resetPersonalData).mockResolvedValue(undefined)
})

describe("GET /api/account/personal-data", () => {
  it("rejects unauthenticated requests without querying personal data", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    } as never)

    expect((await GET(new Request("http://localhost/api/account/personal-data"))).status).toBe(401)
    expect(hasCustomerPersonalData).not.toHaveBeenCalled()
  })

  it("rejects staff accounts", async () => {
    vi.mocked(assertCustomerRole).mockResolvedValue(false)

    expect((await GET(new Request("http://localhost/api/account/personal-data"))).status).toBe(403)
    expect(hasCustomerPersonalData).not.toHaveBeenCalled()
  })

  it("returns personal-data presence for the authenticated customer", async () => {
    vi.mocked(hasCustomerPersonalData).mockResolvedValue(true)

    const response = await GET(new Request("http://localhost/api/account/personal-data"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ hasPersonalData: true })
    expect(hasCustomerPersonalData).toHaveBeenCalledWith(USER_ID)
  })

  it("returns false for an empty customer account", async () => {
    const response = await GET(new Request("http://localhost/api/account/personal-data"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ hasPersonalData: false })
  })

  it("returns a generic error when the presence query fails", async () => {
    vi.mocked(hasCustomerPersonalData).mockRejectedValue(new Error("secret profile value"))

    const response = await GET(new Request("http://localhost/api/account/personal-data"))

    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain("secret profile value")
  })
})

describe("DELETE /api/account/personal-data", () => {
  it("rejects unauthenticated requests", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false }, { status: 401 }),
    } as never)
    expect((await DELETE(request())).status).toBe(401)
    expect(resetPersonalData).not.toHaveBeenCalled()
  })

  it("requires the exact confirmation phrase before role or rate-limit checks", async () => {
    expect((await DELETE(request("delete all data"))).status).toBe(400)
    expect(assertCustomerRole).not.toHaveBeenCalled()
    expect(resetPersonalData).not.toHaveBeenCalled()
  })

  it("allows only customer accounts", async () => {
    vi.mocked(assertCustomerRole).mockResolvedValue(false)
    expect((await DELETE(request())).status).toBe(403)
    expect(resetPersonalData).not.toHaveBeenCalled()
  })

  it("returns the shared rate-limit response", async () => {
    vi.mocked(checkRateLimitAsync).mockResolvedValue(
      NextResponse.json({ ok: false }, { status: 429 }),
    )
    expect((await DELETE(request())).status).toBe(429)
    expect(resetPersonalData).not.toHaveBeenCalled()
  })

  it("derives the reset target from the authenticated session", async () => {
    const response = await DELETE(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(resetPersonalData).toHaveBeenCalledWith(USER_ID)
    const rateLimitKey = vi.mocked(checkRateLimitAsync).mock.calls[0]?.[1]
    expect(rateLimitKey).toMatch(/^personal-data-reset:[a-f0-9]{64}$/)
    expect(rateLimitKey).not.toContain(USER_ID)
  })

  it("returns a generic error when reset verification fails", async () => {
    vi.mocked(resetPersonalData).mockRejectedValue(new Error("secret/path/file.pdf"))
    const response = await DELETE(request())
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain("secret/path")
  })
})
