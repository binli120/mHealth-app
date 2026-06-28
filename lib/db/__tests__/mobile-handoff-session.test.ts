import { beforeEach, describe, expect, it, vi } from "vitest"

const queryMock = vi.fn()
vi.mock("server-only", () => ({}))
vi.mock("pg", () => ({ Pool: vi.fn(() => ({ query: queryMock })) }))
vi.mock("@/lib/user-profile/encrypt", () => ({
  encryptField: vi.fn((s: string) => `enc:${s}`),
  decryptField: vi.fn((s: string) => s.replace("enc:", "")),
}))
vi.mock("@/lib/db/server", () => ({ getDbPool: vi.fn(() => ({ query: queryMock })) }))

import {
  createHandoffSession,
  getHandoffSessionForUser,
  claimHandoffSession,
  completeHandoffSession,
  cancelHandoffSession,
} from "@/lib/db/mobile-handoff-session"

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TOKEN = "test-token-abc123"

const baseRow = {
  id: "id-1",
  token: TOKEN,
  user_id: USER_ID,
  context_type: "intake_chat",
  context_payload: { applicationId: "app-1" },
  encrypted_refresh_token: "enc:rt-secret",
  status: "pending",
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 300_000).toISOString(),
  completed_at: null,
  progress_summary: null,
}

describe("createHandoffSession", () => {
  beforeEach(() => queryMock.mockReset())

  it("expires stale pending sessions then inserts new row", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] }) // expire stale
      .mockResolvedValueOnce({ rows: [baseRow] }) // insert
    const result = await createHandoffSession(USER_ID, "intake_chat", { applicationId: "app-1" }, "rt-secret")
    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(queryMock.mock.calls[0][0]).toMatch(/UPDATE mobile_handoff_sessions.*expired/s)
    expect(result.token).toBe(TOKEN)
    expect(result.decryptedRefreshToken).toBe("rt-secret")
  })
})

describe("claimHandoffSession", () => {
  beforeEach(() => queryMock.mockReset())

  it("returns null when no pending row updated (already claimed or expired)", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const result = await claimHandoffSession(TOKEN)
    expect(result).toBeNull()
  })

  it("returns session with decrypted refresh token on success", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...baseRow, status: "active", encrypted_refresh_token: "enc:rt-secret" }] })
    const result = await claimHandoffSession(TOKEN)
    expect(result?.status).toBe("active")
    expect(result?.decryptedRefreshToken).toBe("rt-secret")
  })
})

describe("completeHandoffSession", () => {
  beforeEach(() => queryMock.mockReset())

  it("issues UPDATE with completed status and summary", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await completeHandoffSession(TOKEN, USER_ID, { completedSteps: 5 })
    expect(queryMock.mock.calls[0][0]).toMatch(/status.*completed/s)
    expect(queryMock.mock.calls[0][1]).toContain(TOKEN)
  })
})

describe("cancelHandoffSession", () => {
  beforeEach(() => queryMock.mockReset())

  it("sets status to expired", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await cancelHandoffSession(TOKEN, USER_ID)
    expect(queryMock.mock.calls[0][0]).toMatch(/expired/)
  })
})
