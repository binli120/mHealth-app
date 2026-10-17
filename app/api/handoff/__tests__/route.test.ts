import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:os", () => ({ default: { networkInterfaces: vi.fn(() => ({})) }, networkInterfaces: vi.fn(() => ({})) }))
vi.mock("@/lib/auth/require-auth", () => ({ requireAuthenticatedUser: vi.fn() }))
vi.mock("@/lib/db/mobile-handoff-session", () => ({
  createHandoffSession: vi.fn(),
  getHandoffSessionForUser: vi.fn(),
  cancelHandoffSession: vi.fn(),
}))
vi.mock("@/lib/db/application-drafts", () => ({ getApplicationDraft: vi.fn() }))
vi.mock("@/lib/server/logger", () => ({ logServerError: vi.fn() }))

import { POST, GET, DELETE } from "@/app/api/handoff/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getApplicationDraft } from "@/lib/db/application-drafts"
import { logServerError } from "@/lib/server/logger"
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

  const postHandoff = (contextType: string, contextPayload: Record<string, unknown>) =>
    POST(new Request("http://localhost/api/handoff", {
      method: "POST",
      body: JSON.stringify({ contextType, contextPayload, refreshToken: "rt" }),
      headers: { "Content-Type": "application/json" },
    }))

  it("refuses an intake_chat hand-off for a SACA-2 application", async () => {
     
    vi.mocked(getApplicationDraft).mockResolvedValue({ applicationType: "saca2" } as any)
    const res = await postHandoff("intake_chat", { applicationId: "app-1" })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, error: "SACA-2 applications cannot be continued on a phone yet." })
    expect(getApplicationDraft).toHaveBeenCalledWith(USER_ID, "app-1")
    expect(createHandoffSession).not.toHaveBeenCalled()
  })

  it("lets an ACA-3 application through", async () => {
     
    vi.mocked(getApplicationDraft).mockResolvedValue({ applicationType: "aca3" } as any)
     
    vi.mocked(createHandoffSession).mockResolvedValue({ token: TOKEN, expiresAt: "x" } as any)
    const res = await postHandoff("intake_chat", { applicationId: "app-1" })
    expect(res.status).toBe(200)
    expect(createHandoffSession).toHaveBeenCalled()
  })

  it("falls through when the application row is not found", async () => {
    vi.mocked(getApplicationDraft).mockResolvedValue(null)
     
    vi.mocked(createHandoffSession).mockResolvedValue({ token: TOKEN, expiresAt: "x" } as any)
    const res = await postHandoff("intake_chat", { applicationId: "app-1" })
    expect(res.status).toBe(200)
  })

  it.each(["mh_chat", "voice_message"])("never looks up the application for %s", async (type) => {
     
    vi.mocked(createHandoffSession).mockResolvedValue({ token: TOKEN, expiresAt: "x" } as any)
    const res = await postHandoff(type, { applicationId: "app-1" })
    expect(res.status).toBe(200)
    expect(getApplicationDraft).not.toHaveBeenCalled()
  })

  it("fails closed with 400 when the lookup throws", async () => {
    vi.mocked(getApplicationDraft).mockRejectedValue(new Error("db down"))
    const res = await postHandoff("intake_chat", { applicationId: "app-1" })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, error: "Could not verify the application. Try again." })
    expect(logServerError).toHaveBeenCalled()
    expect(createHandoffSession).not.toHaveBeenCalled()
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
