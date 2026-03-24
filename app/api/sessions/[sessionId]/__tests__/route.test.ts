/**
 * Unit tests for PATCH /api/sessions/[sessionId] and DELETE /api/sessions/[sessionId].
 * DB and auth are mocked — only the route handler logic is exercised.
 * @author Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { SessionSummary } from "@/lib/collaborative-sessions/types"

// ── Mocks (hoisted before any imports that use them) ─────────────────────────

vi.mock("@/lib/collaborative-sessions/db", () => ({
  getSession:           vi.fn(),
  updateSessionStatus:  vi.fn(),
  deleteSession:        vi.fn(),
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/notifications/service", () => ({
  notifySessionStarting: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

import { PATCH, DELETE } from "@/app/api/sessions/[sessionId]/route"
import { getSession, updateSessionStatus, deleteSession } from "@/lib/collaborative-sessions/db"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { notifySessionStarting } from "@/lib/notifications/service"

// ── Helpers ──────────────────────────────────────────────────────────────────

const SW_ID      = "sw-user-1"
const PATIENT_ID = "patient-user-1"
const SESSION_ID = "session-abc"

function makeParams(sessionId = SESSION_ID) {
  return { params: Promise.resolve({ sessionId }) }
}

function makeRequest(method: string, body?: object) {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function mockAuth(userId: string) {
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId } as never)
}

function mockAuthFail() {
  const res = new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 })
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: false, response: res } as never)
}

function makeSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id:             SESSION_ID,
    swUserId:       SW_ID,
    swName:         "Jane SW",
    patientUserId:  PATIENT_ID,
    patientName:    "John Patient",
    status:         "scheduled",
    scheduledAt:    null,
    startedAt:      null,
    endedAt:        null,
    inviteMessage:  null,
    createdAt:      "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/sessions/[sessionId]", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 401 when not authenticated", async () => {
    mockAuthFail()
    const res = await PATCH(makeRequest("PATCH", { status: "active" }), makeParams())
    expect(res.status).toBe(401)
  })

  it("returns 404 when session does not exist", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await PATCH(makeRequest("PATCH", { status: "active" }), makeParams())
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.ok).toBe(false)
  })

  it("returns 403 when caller is not a participant", async () => {
    mockAuth("stranger-id")
    vi.mocked(getSession).mockResolvedValue(makeSession())
    const res = await PATCH(makeRequest("PATCH", { status: "active" }), makeParams())
    expect(res.status).toBe(403)
  })

  it("returns 400 when status field is missing", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession())
    const res = await PATCH(makeRequest("PATCH", {}), makeParams())
    expect(res.status).toBe(400)
  })

  it("SW can transition scheduled → active", async () => {
    mockAuth(SW_ID)
    const session = makeSession({ status: "scheduled" })
    vi.mocked(getSession).mockResolvedValue(session)
    const updated = makeSession({ status: "active", startedAt: "2026-01-01T10:00:00Z" })
    vi.mocked(updateSessionStatus).mockResolvedValue(updated)

    const res = await PATCH(makeRequest("PATCH", { status: "active" }), makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.session.status).toBe("active")
  })

  it("SW can transition active → ended", async () => {
    mockAuth(SW_ID)
    const session = makeSession({ status: "active" })
    vi.mocked(getSession).mockResolvedValue(session)
    const updated = makeSession({ status: "ended", endedAt: "2026-01-01T11:00:00Z" })
    vi.mocked(updateSessionStatus).mockResolvedValue(updated)

    const res = await PATCH(makeRequest("PATCH", { status: "ended" }), makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.session.status).toBe("ended")
  })

  it("SW cannot reverse an ended session (ended → active is rejected)", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "ended" }))

    const res = await PATCH(makeRequest("PATCH", { status: "active" }), makeParams())
    expect(res.status).toBe(422)
  })

  it("patient can cancel (scheduled → cancelled)", async () => {
    mockAuth(PATIENT_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "scheduled" }))
    const updated = makeSession({ status: "cancelled" })
    vi.mocked(updateSessionStatus).mockResolvedValue(updated)

    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.session.status).toBe("cancelled")
  })

  it("patient cannot start a session (scheduled → active is rejected for patient)", async () => {
    mockAuth(PATIENT_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "scheduled" }))

    const res = await PATCH(makeRequest("PATCH", { status: "active" }), makeParams())
    expect(res.status).toBe(422)
  })

  it("notifies the patient when SW starts the session", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "scheduled" }))
    vi.mocked(updateSessionStatus).mockResolvedValue(makeSession({ status: "active" }))

    await PATCH(makeRequest("PATCH", { status: "active" }), makeParams())
    // notifySessionStarting is fire-and-forget; give microtasks a tick
    await Promise.resolve()
    expect(notifySessionStarting).toHaveBeenCalledWith(PATIENT_ID, SESSION_ID, "Jane SW")
  })

  it("does NOT notify on transitions other than → active", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "active" }))
    vi.mocked(updateSessionStatus).mockResolvedValue(makeSession({ status: "ended" }))

    await PATCH(makeRequest("PATCH", { status: "ended" }), makeParams())
    await Promise.resolve()
    expect(notifySessionStarting).not.toHaveBeenCalled()
  })
})

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/sessions/[sessionId]", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("returns 401 when not authenticated", async () => {
    mockAuthFail()
    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(401)
  })

  it("returns 404 when session does not exist", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(404)
  })

  it("returns 403 when caller is the patient (not SW)", async () => {
    mockAuth(PATIENT_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "ended" }))
    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(403)
  })

  it("returns 403 when caller is an unrelated user", async () => {
    mockAuth("stranger-id")
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "ended" }))
    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(403)
  })

  it("SW can delete an ended session", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "ended" }))
    vi.mocked(deleteSession).mockResolvedValue(true)

    const res = await DELETE(makeRequest("DELETE"), makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(deleteSession).toHaveBeenCalledWith(SESSION_ID)
  })

  it("SW can delete a cancelled session", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "cancelled" }))
    vi.mocked(deleteSession).mockResolvedValue(true)

    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(200)
  })

  it("returns 422 when trying to delete an active session", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "active" }))

    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(422)
    expect(deleteSession).not.toHaveBeenCalled()
  })

  it("returns 422 when trying to delete a scheduled session", async () => {
    mockAuth(SW_ID)
    vi.mocked(getSession).mockResolvedValue(makeSession({ status: "scheduled" }))

    const res = await DELETE(makeRequest("DELETE"), makeParams())
    expect(res.status).toBe(422)
    expect(deleteSession).not.toHaveBeenCalled()
  })
})
