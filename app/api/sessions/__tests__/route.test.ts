import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/auth/require-social-worker", () => ({
  requireApprovedSocialWorker: vi.fn(),
}))

vi.mock("@/lib/collaborative-sessions/db", () => ({
  createSession: vi.fn(),
  listSessionsForUser: vi.fn(),
}))

vi.mock("@/lib/notifications/service", () => ({
  notifySessionInvite: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

import { POST } from "@/app/api/sessions/route"
import { requireApprovedSocialWorker } from "@/lib/auth/require-social-worker"
import { createSession } from "@/lib/collaborative-sessions/db"
import { notifySessionInvite } from "@/lib/notifications/service"

const SW_ID = "11111111-1111-4111-8111-111111111111"
const PATIENT_ID = "22222222-2222-4222-8222-222222222222"

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireApprovedSocialWorker).mockResolvedValue({ ok: true, userId: SW_ID } as never)
})

describe("POST /api/sessions", () => {
  it("returns 403 when the social worker does not have active patient access", async () => {
    vi.mocked(createSession).mockResolvedValue(null)

    const response = await POST(makeRequest({ patientUserId: PATIENT_ID }))
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/active patient relationship/i)
    expect(notifySessionInvite).not.toHaveBeenCalled()
  })

  it("creates a session and notifies the patient when access exists", async () => {
    vi.mocked(createSession).mockResolvedValue({
      id: "session-1",
      swUserId: SW_ID,
      swName: "Jane SW",
      patientUserId: PATIENT_ID,
      patientName: "John Patient",
      status: "scheduled",
      scheduledAt: "2026-04-01T14:00:00Z",
      startedAt: null,
      endedAt: null,
      inviteMessage: "Let's review your case.",
      createdAt: "2026-04-01T13:00:00Z",
    })

    const response = await POST(
      makeRequest({
        patientUserId: PATIENT_ID,
        scheduledAt: "2026-04-01T14:00:00Z",
        inviteMessage: "Let's review your case.",
      }),
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(notifySessionInvite).toHaveBeenCalledWith(
      PATIENT_ID,
      "session-1",
      "Jane SW",
      "2026-04-01T14:00:00Z",
      "Let's review your case.",
    )
  })
})
