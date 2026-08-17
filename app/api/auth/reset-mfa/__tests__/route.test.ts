/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSignInWithOtp = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ auth: { signInWithOtp: mockSignInWithOtp } }),
}))

import { POST } from "@/app/api/auth/reset-mfa/route"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/reset-mfa", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
})

describe("POST /api/auth/reset-mfa — validation", () => {
  it("returns 400 for a missing email", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it("returns 400 for an email without an @", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }))
    expect(res.status).toBe(400)
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it("returns 400 for an empty string email", async () => {
    const res = await POST(makeRequest({ email: "" }))
    expect(res.status).toBe(400)
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it("rejects a non-string email", async () => {
    const res = await POST(makeRequest({ email: 12345 }))
    expect(res.status).toBe(400)
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })
})

describe("POST /api/auth/reset-mfa — happy path", () => {
  it("normalizes email casing/whitespace and calls signInWithOtp", async () => {
    const res = await POST(makeRequest({ email: "  User@Example.com  " }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: expect.objectContaining({
        shouldCreateUser: false,
        emailRedirectTo: "http://localhost:3000/auth/reset-mfa/confirm",
      }),
    })
  })

  it("still returns ok:true even when the account doesn't exist (no user enumeration)", async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: { message: "User not found" } })
    const res = await POST(makeRequest({ email: "ghost@example.com" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
