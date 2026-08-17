/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/admin-access", () => ({
  logLoginEvent: vi.fn(),
}))

vi.mock("@/lib/server/customer-analytics", () => ({
  getAnalyticsIpHash: vi.fn(() => null),
  getAnalyticsUserHash: vi.fn(() => "hash"),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerInfo: vi.fn(),
}))

const mockGetUser = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ auth: { getUser: mockGetUser } }),
}))

import { POST, DELETE } from "@/app/api/auth/session-cookie/route"
import { logLoginEvent } from "@/lib/db/admin-access"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/session-cookie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeRawRequest(raw: string): Request {
  return new Request("http://localhost/api/auth/session-cookie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/auth/session-cookie — validation", () => {
  it("returns 400 for malformed JSON", async () => {
    const res = await POST(makeRawRequest("{not json"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns 400 when accessToken is missing", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns 400 when accessToken is an empty string", async () => {
    const res = await POST(makeRequest({ accessToken: "   " }))
    expect(res.status).toBe(400)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns 400 when accessToken is not a string", async () => {
    const res = await POST(makeRequest({ accessToken: 12345 }))
    expect(res.status).toBe(400)
    expect(mockGetUser).not.toHaveBeenCalled()
  })
})

describe("POST /api/auth/session-cookie — auth", () => {
  it("returns 401 when the token is invalid or expired", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") })
    const res = await POST(makeRequest({ accessToken: "bad-token" }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it("sets the session cookie and returns ok:true for a valid token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    const res = await POST(makeRequest({ accessToken: "good-token" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(res.headers.get("set-cookie")).toContain("sb-access-token=good-token")
    expect(logLoginEvent).toHaveBeenCalledWith("user-1", "login", null, null)
  })
})

describe("DELETE /api/auth/session-cookie", () => {
  it("clears the session cookie", async () => {
    const res = await DELETE()
    expect(res.status).toBe(200)
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("sb-access-token=;")
  })
})
