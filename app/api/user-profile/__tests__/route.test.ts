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

vi.mock("@/lib/server/rate-limit", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/db/user-profile", () => ({
  getUserProfile: vi.fn(),
  upsertUserProfile: vi.fn(),
  upsertBankAccount: vi.fn(),
}))

import { GET, PUT } from "@/app/api/user-profile/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getUserProfile, upsertUserProfile, upsertBankAccount } from "@/lib/db/user-profile"

const USER_ID = "11111111-1111-4111-8111-111111111111"

const VALID_PROFILE_DATA = {
  preferredLanguage: "en",
  accessibility: {
    needsReadingAssistance: false,
    needsTranslation: false,
    needsVoiceAssistant: false,
  },
  notifications: {
    deadlineReminders: true,
    qualificationAlerts: true,
    regulationUpdates: false,
    channel: "email",
    reminderLeadDays: 7,
  },
}

const VALID_BANK_DATA = {
  bankName: "Chase",
  accountType: "checking",
  routingNumber: "123456789",
  accountNumber: "12345678",
}

function makePutRequest(body: unknown): Request {
  return new Request("http://localhost/api/user-profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  vi.mocked(getUserProfile).mockResolvedValue({ id: USER_ID } as never)
  vi.mocked(upsertUserProfile).mockResolvedValue(undefined as never)
  vi.mocked(upsertBankAccount).mockResolvedValue(undefined as never)
})

describe("GET /api/user-profile", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)
    const res = await GET(new Request("http://localhost/api/user-profile"))
    expect(res.status).toBe(401)
  })

  it("returns 404 when no profile exists", async () => {
    vi.mocked(getUserProfile).mockResolvedValue(null as never)
    const res = await GET(new Request("http://localhost/api/user-profile"))
    expect(res.status).toBe(404)
  })
})

describe("PUT /api/user-profile — validation", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)
    const res = await PUT(makePutRequest({ section: "profile", data: VALID_PROFILE_DATA }))
    expect(res.status).toBe(401)
    expect(upsertUserProfile).not.toHaveBeenCalled()
  })

  it("returns 400 for an unknown section", async () => {
    const res = await PUT(makePutRequest({ section: "bogus", data: {} }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Invalid profile data submitted.")
    expect(upsertUserProfile).not.toHaveBeenCalled()
    expect(upsertBankAccount).not.toHaveBeenCalled()
  })

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/user-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 when profile data is missing required fields", async () => {
    const res = await PUT(makePutRequest({ section: "profile", data: {} }))
    expect(res.status).toBe(400)
    expect(upsertUserProfile).not.toHaveBeenCalled()
  })

  it("returns 400 for a bank routing number that isn't 9 digits", async () => {
    const res = await PUT(
      makePutRequest({
        section: "bank",
        data: { ...VALID_BANK_DATA, routingNumber: "123" },
      }),
    )
    expect(res.status).toBe(400)
    expect(upsertBankAccount).not.toHaveBeenCalled()
  })

  it("returns 400 for a bank account number that's too short", async () => {
    const res = await PUT(
      makePutRequest({
        section: "bank",
        data: { ...VALID_BANK_DATA, accountNumber: "12" },
      }),
    )
    expect(res.status).toBe(400)
    expect(upsertBankAccount).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid accountType enum value", async () => {
    const res = await PUT(
      makePutRequest({
        section: "bank",
        data: { ...VALID_BANK_DATA, accountType: "crypto" },
      }),
    )
    expect(res.status).toBe(400)
    expect(upsertBankAccount).not.toHaveBeenCalled()
  })
})

describe("PUT /api/user-profile — happy path", () => {
  it("saves valid profile data", async () => {
    const res = await PUT(makePutRequest({ section: "profile", data: VALID_PROFILE_DATA }))
    expect(res.status).toBe(200)
    expect(upsertUserProfile).toHaveBeenCalledWith(USER_ID, VALID_PROFILE_DATA)
  })

  it("saves valid bank data with client IP for the audit trail", async () => {
    const res = await PUT(makePutRequest({ section: "bank", data: VALID_BANK_DATA }))
    expect(res.status).toBe(200)
    expect(upsertBankAccount).toHaveBeenCalledWith(
      USER_ID,
      VALID_BANK_DATA,
      expect.objectContaining({ ipAddress: "127.0.0.1", purpose: "user-submitted" }),
    )
  })
})
