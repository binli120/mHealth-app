import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:os", () => ({ default: { networkInterfaces: vi.fn(() => ({})) }, networkInterfaces: vi.fn(() => ({})) }))
vi.mock("@/lib/auth/require-auth", () => ({ requireAuthenticatedUser: vi.fn() }))
vi.mock("@/lib/db/mobile-handoff-session", () => ({
  createHandoffSession: vi.fn(),
  getHandoffSessionForUser: vi.fn(),
  cancelHandoffSession: vi.fn(),
}))
vi.mock("@/lib/server/logger", () => ({ logServerError: vi.fn() }))

import { POST, GET, DELETE } from "@/app/api/handoff/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  createHandoffSession,
  getHandoffSessionForUser,
  cancelHandoffSession,
} from "@/lib/db/mobile-handoff-session"

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TOKEN = "tok-abc123"

function mockAuth() {
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({
    ok: true as const,
    userId: USER_ID,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

describe("POST /api/handoff", () => {
  beforeEach(() => { vi.resetAllMocks(); mockAuth() })

  it("returns 400 when contextType missing", async () => {
    const req = new Request("http://localhost/api/handoff", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("creates session and returns mobileUrl", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com"
    vi.mocked(createHandoffSession).mockResolvedValue({
      token: TOKEN, expiresAt: "2026-06-28T00:05:00Z",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    const req = new Request("http://localhost/api/handoff", {
      method: "POST",
      body: JSON.stringify({ contextType: "intake_chat", contextPayload: { applicationId: "app-1" }, refreshToken: "rt" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.mobileUrl).toContain(`/mobile/${TOKEN}`)
  })
})

describe("GET /api/handoff", () => {
  beforeEach(() => { vi.resetAllMocks(); mockAuth() })

  it("returns 400 when token missing", async () => {
    const req = new Request("http://localhost/api/handoff")
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it("returns session status", async () => {
    vi.mocked(getHandoffSessionForUser).mockResolvedValue({
      status: "active", progressSummary: null, expiresAt: "2026-06-28T00:05:00Z",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    const req = new Request(`http://localhost/api/handoff?token=${TOKEN}`)
    const res = await GET(req)
    const json = await res.json()
    expect(json.status).toBe("active")
  })
})

describe("DELETE /api/handoff", () => {
  beforeEach(() => { vi.resetAllMocks(); mockAuth() })

  it("calls cancelHandoffSession and returns ok", async () => {
    vi.mocked(cancelHandoffSession).mockResolvedValue(undefined)
    const req = new Request(`http://localhost/api/handoff?token=${TOKEN}`, { method: "DELETE" })
    const res = await DELETE(req)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(cancelHandoffSession).toHaveBeenCalledWith(TOKEN, USER_ID)
  })
})
