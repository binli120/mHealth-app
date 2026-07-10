import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/require-auth", () => ({ requireAuthenticatedUser: vi.fn() }))
vi.mock("@/lib/db/mobile-handoff-session", () => ({ completeHandoffSession: vi.fn() }))
vi.mock("@/lib/server/logger", () => ({ logServerError: vi.fn() }))

import { POST } from "@/app/api/handoff/[token]/complete/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { completeHandoffSession } from "@/lib/db/mobile-handoff-session"

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TOKEN = "tok-abc"

describe("POST /api/handoff/[token]/complete", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true as const, userId: USER_ID } as any)
  })

  it("calls completeHandoffSession and returns ok", async () => {
    vi.mocked(completeHandoffSession).mockResolvedValue(undefined)
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ progressSummary: { completedSteps: 3 } }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: Promise.resolve({ token: TOKEN }) })
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(completeHandoffSession).toHaveBeenCalledWith(TOKEN, USER_ID, { completedSteps: 3 })
  })
})
