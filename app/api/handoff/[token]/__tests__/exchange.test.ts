import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/mobile-handoff-session", () => ({ claimHandoffSession: vi.fn() }))
vi.mock("@/lib/server/logger", () => ({ logServerError: vi.fn() }))

import { POST } from "@/app/api/handoff/[token]/exchange/route"
import { claimHandoffSession } from "@/lib/db/mobile-handoff-session"

const TOKEN = "tok-abc"

function makeCtx(token: string) {
  return { params: Promise.resolve({ token }) }
}

describe("POST /api/handoff/[token]/exchange", () => {
  beforeEach(() => vi.resetAllMocks())

  it("returns 409 when token already claimed (claimHandoffSession returns null)", async () => {
    vi.mocked(claimHandoffSession).mockResolvedValue(null)
    const res = await POST(new Request("http://localhost"), makeCtx(TOKEN))
    expect(res.status).toBe(409)
  })

  it("returns session data on success", async () => {
    vi.mocked(claimHandoffSession).mockResolvedValue({
      decryptedRefreshToken: "rt-secret",
      contextType: "intake_chat",
      contextPayload: { applicationId: "app-1" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    const res = await POST(new Request("http://localhost"), makeCtx(TOKEN))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.refreshToken).toBe("rt-secret")
    expect(json.contextType).toBe("intake_chat")
  })
})
