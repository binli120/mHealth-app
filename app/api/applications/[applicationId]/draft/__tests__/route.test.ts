/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const { FakeApplicationDraftAccessError } = vi.hoisted(() => ({
  FakeApplicationDraftAccessError: class extends Error {},
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/db/application-drafts", () => ({
  ApplicationDraftAccessError: FakeApplicationDraftAccessError,
  getApplicationDraft: vi.fn(),
  upsertApplicationDraft: vi.fn(),
  deleteApplicationDraft: vi.fn(),
}))

vi.mock("@/lib/notifications/service", () => ({
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/masshealth/benefit-policy-change-notifier", () => ({
  notifyBenefitPolicyUpdatesForApplication: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

import { GET, PUT, DELETE } from "@/app/api/applications/[applicationId]/draft/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  getApplicationDraft,
  upsertApplicationDraft,
  deleteApplicationDraft,
} from "@/lib/db/application-drafts"
import { notifyStatusChange } from "@/lib/notifications/service"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const APPLICATION_ID = "22222222-2222-4222-8222-222222222222"

function makeContext(applicationId: string) {
  return { params: Promise.resolve({ applicationId }) }
}

function makePutRequest(rawBody: string): Request {
  return new Request(`http://localhost/api/applications/${APPLICATION_ID}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  vi.mocked(getApplicationDraft).mockResolvedValue({ id: APPLICATION_ID, draftState: {} } as never)
  vi.mocked(upsertApplicationDraft).mockResolvedValue({
    id: APPLICATION_ID,
    status: "draft",
    applicationType: "masshealth",
  } as never)
  vi.mocked(deleteApplicationDraft).mockResolvedValue({ deleted: true } as never)
})

describe("GET /api/applications/[applicationId]/draft — validation", () => {
  it("returns 400 for a non-UUID applicationId", async () => {
    const res = await GET(
      new Request("http://localhost/api/applications/not-a-uuid/draft"),
      makeContext("not-a-uuid"),
    )
    expect(res.status).toBe(400)
    expect(getApplicationDraft).not.toHaveBeenCalled()
  })

  it("returns 401 (not 400) when unauthenticated, even with a bad UUID — auth runs first", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)
    const res = await GET(
      new Request("http://localhost/api/applications/not-a-uuid/draft"),
      makeContext("not-a-uuid"),
    )
    expect(res.status).toBe(401)
  })

  it("returns the draft for a valid UUID", async () => {
    const res = await GET(
      new Request(`http://localhost/api/applications/${APPLICATION_ID}/draft`),
      makeContext(APPLICATION_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})

describe("PUT /api/applications/[applicationId]/draft — validation", () => {
  it("returns 400 for a non-UUID applicationId", async () => {
    const res = await PUT(makePutRequest(JSON.stringify({ wizardState: {} })), makeContext("not-a-uuid"))
    expect(res.status).toBe(400)
    expect(upsertApplicationDraft).not.toHaveBeenCalled()
  })

  it("returns 413 when the body exceeds the size guard", async () => {
    const huge = JSON.stringify({ wizardState: { blob: "x".repeat(100_001) } })
    const res = await PUT(makePutRequest(huge), makeContext(APPLICATION_ID))
    expect(res.status).toBe(413)
    expect(upsertApplicationDraft).not.toHaveBeenCalled()
  })

  it("returns 400 for malformed JSON", async () => {
    const res = await PUT(makePutRequest("{not json"), makeContext(APPLICATION_ID))
    expect(res.status).toBe(400)
    expect(upsertApplicationDraft).not.toHaveBeenCalled()
  })

  it("returns 400 when wizardState is missing", async () => {
    const res = await PUT(makePutRequest(JSON.stringify({})), makeContext(APPLICATION_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("wizardState object is required.")
    expect(upsertApplicationDraft).not.toHaveBeenCalled()
  })

  it("returns 400 when wizardState is not an object", async () => {
    const res = await PUT(
      makePutRequest(JSON.stringify({ wizardState: "not-an-object" })),
      makeContext(APPLICATION_ID),
    )
    expect(res.status).toBe(400)
    expect(upsertApplicationDraft).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid applicationType", async () => {
    const res = await PUT(
      makePutRequest(JSON.stringify({ wizardState: {}, applicationType: "Not Valid!" })),
      makeContext(APPLICATION_ID),
    )
    expect(res.status).toBe(400)
    expect(upsertApplicationDraft).not.toHaveBeenCalled()
  })

  it("saves a valid draft", async () => {
    const res = await PUT(
      makePutRequest(JSON.stringify({ wizardState: { step: 1 } })),
      makeContext(APPLICATION_ID),
    )
    expect(res.status).toBe(200)
    expect(upsertApplicationDraft).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, applicationId: APPLICATION_ID }),
    )
  })

  it("fires a submission notification when status becomes submitted", async () => {
    vi.mocked(upsertApplicationDraft).mockResolvedValue({
      id: APPLICATION_ID,
      status: "submitted",
      applicationType: "masshealth",
    } as never)
    const res = await PUT(
      makePutRequest(JSON.stringify({ wizardState: { step: 5 } })),
      makeContext(APPLICATION_ID),
    )
    expect(res.status).toBe(200)
    expect(notifyStatusChange).toHaveBeenCalledWith(USER_ID, APPLICATION_ID, "submitted")
  })

  it("returns 403 when the draft store rejects access", async () => {
    vi.mocked(upsertApplicationDraft).mockRejectedValue(new FakeApplicationDraftAccessError("nope"))
    const res = await PUT(
      makePutRequest(JSON.stringify({ wizardState: {} })),
      makeContext(APPLICATION_ID),
    )
    expect(res.status).toBe(403)
  })
})

describe("DELETE /api/applications/[applicationId]/draft — validation", () => {
  it("returns 400 for a non-UUID applicationId", async () => {
    const res = await DELETE(
      new Request(`http://localhost/api/applications/not-a-uuid/draft`, { method: "DELETE" }),
      makeContext("not-a-uuid"),
    )
    expect(res.status).toBe(400)
    expect(deleteApplicationDraft).not.toHaveBeenCalled()
  })

  it("deletes a valid application draft", async () => {
    const res = await DELETE(
      new Request(`http://localhost/api/applications/${APPLICATION_ID}/draft`, { method: "DELETE" }),
      makeContext(APPLICATION_ID),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
