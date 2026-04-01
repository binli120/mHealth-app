import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/invitations", () => ({
  claimInvitationByToken: vi.fn(),
  getInvitationByToken: vi.fn(),
}))

const queryMock = vi.fn()
const releaseMock = vi.fn()
const connectMock = vi.fn(() => ({
  query: queryMock,
  release: releaseMock,
}))

vi.mock("@/lib/db/server", () => ({
  getDbPool: vi.fn(() => ({
    connect: connectMock,
  })),
}))

import { POST } from "@/app/api/auth/invite/[token]/route"
import { claimInvitationByToken, getInvitationByToken } from "@/lib/db/invitations"

const TOKEN = "test-token"
const INVITATION = {
  id: "inv-1",
  email: "invitee@example.com",
  company_id: null,
  company_name: null,
  role: "",
  token: TOKEN,
  invited_by: null,
  accepted_at: null,
  expires_at: "2099-01-01T00:00:00.000Z",
  created_at: "2026-04-01T00:00:00.000Z",
}

function makeRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/auth/invite/${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams() {
  return { params: Promise.resolve({ token: TOKEN }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  queryMock.mockResolvedValue({ rows: [] })
})

describe("POST /api/auth/invite/[token]", () => {
  it("returns 409 when the invitation claim loses the race", async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(INVITATION)
    vi.mocked(claimInvitationByToken).mockResolvedValue(null)

    const response = await POST(makeRequest({ password: "strong-pass-1" }), makeParams())
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.error).toMatch(/no longer available/i)
    expect(queryMock).toHaveBeenCalledWith("BEGIN")
    expect(queryMock).toHaveBeenCalledWith("ROLLBACK")
    expect(releaseMock).toHaveBeenCalledOnce()
  })

  it("commits after claiming and updating an existing auth user", async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(INVITATION)
    vi.mocked(claimInvitationByToken).mockResolvedValue({
      ...INVITATION,
      accepted_at: "2026-04-01T12:00:00.000Z",
    })
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "user-1" }] })
      .mockResolvedValue({ rows: [] })

    const response = await POST(
      makeRequest({ firstName: "Jane", lastName: "Doe", password: "strong-pass-1" }),
      makeParams(),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(claimInvitationByToken).toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledWith("COMMIT")
    expect(releaseMock).toHaveBeenCalledOnce()
  })
})
