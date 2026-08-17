/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

const { FakeApplicationDraftAccessError } = vi.hoisted(() => ({
  FakeApplicationDraftAccessError: class extends Error {},
}))

vi.mock("@/lib/db/application-drafts", () => ({
  ApplicationDraftAccessError: FakeApplicationDraftAccessError,
  createApplicationDraft: vi.fn(),
  listApplicationDrafts: vi.fn(),
}))

import { GET, POST } from "@/app/api/applications/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  createApplicationDraft,
  listApplicationDrafts,
} from "@/lib/db/application-drafts"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const APPLICATION_ID = "22222222-2222-4222-8222-222222222222"

function makeGetRequest(query = ""): Request {
  return new Request(`http://localhost/api/applications${query}`)
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  vi.mocked(listApplicationDrafts).mockResolvedValue({ records: [], total: 0 })
  vi.mocked(createApplicationDraft).mockResolvedValue({ id: APPLICATION_ID } as never)
})

describe("GET /api/applications — auth", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    expect(listApplicationDrafts).not.toHaveBeenCalled()
  })
})

describe("GET /api/applications — validation", () => {
  it("returns 400 for an unknown status filter", async () => {
    const res = await GET(makeGetRequest("?status=bogus_status"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(listApplicationDrafts).not.toHaveBeenCalled()
  })

  it("returns 400 for a non-numeric limit", async () => {
    const res = await GET(makeGetRequest("?limit=abc"))
    expect(res.status).toBe(400)
    expect(listApplicationDrafts).not.toHaveBeenCalled()
  })

  it("returns 400 for a negative offset", async () => {
    const res = await GET(makeGetRequest("?offset=-1"))
    expect(res.status).toBe(400)
    expect(listApplicationDrafts).not.toHaveBeenCalled()
  })

  it("accepts a valid status, limit, and offset and forwards them", async () => {
    const res = await GET(makeGetRequest("?status=draft&limit=10&offset=5&q=hello"))
    expect(res.status).toBe(200)
    expect(listApplicationDrafts).toHaveBeenCalledWith(USER_ID, {
      status: "draft",
      query: "hello",
      limit: 10,
      offset: 5,
    })
  })

  it("treats an empty status as no filter", async () => {
    const res = await GET(makeGetRequest("?status="))
    expect(res.status).toBe(200)
    expect(listApplicationDrafts).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ status: null }),
    )
  })
})

describe("GET /api/applications — access error", () => {
  it("returns 403 when the draft store rejects access", async () => {
    vi.mocked(listApplicationDrafts).mockRejectedValue(new FakeApplicationDraftAccessError("nope"))
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
  })
})

describe("POST /api/applications — auth", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)
    const res = await POST(makePostRequest({ applicationId: APPLICATION_ID }))
    expect(res.status).toBe(401)
    expect(createApplicationDraft).not.toHaveBeenCalled()
  })
})

describe("POST /api/applications — validation", () => {
  it("returns 400 for a non-UUID applicationId", async () => {
    const res = await POST(makePostRequest({ applicationId: "not-a-uuid" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(createApplicationDraft).not.toHaveBeenCalled()
  })

  it("returns 400 for a missing applicationId", async () => {
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
    expect(createApplicationDraft).not.toHaveBeenCalled()
  })

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(createApplicationDraft).not.toHaveBeenCalled()
  })

  it("accepts a valid UUID and optional applicationType", async () => {
    const res = await POST(
      makePostRequest({ applicationId: APPLICATION_ID, applicationType: "masshealth" }),
    )
    expect(res.status).toBe(200)
    expect(createApplicationDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        applicationId: APPLICATION_ID,
        applicationType: "masshealth",
      }),
    )
  })
})

describe("POST /api/applications — access error", () => {
  it("returns 403 when the draft store rejects access", async () => {
    vi.mocked(createApplicationDraft).mockRejectedValue(new FakeApplicationDraftAccessError("nope"))
    const res = await POST(makePostRequest({ applicationId: APPLICATION_ID }))
    expect(res.status).toBe(403)
  })
})
