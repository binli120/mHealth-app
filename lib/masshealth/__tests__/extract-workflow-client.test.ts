/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { extractMasshealthWorkflow } from "@/lib/masshealth/extract-workflow-client"
import type { ExtractWorkflowResponse } from "@/lib/masshealth/extract-workflow-client"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeValidResponse(overrides: Partial<ExtractWorkflowResponse> = {}): ExtractWorkflowResponse {
  return {
    status: "ok",
    user_id: "user-123",
    source_pdf: "form.pdf",
    workflow_data: { key: "value" },
    ...overrides,
  }
}

function makePayload(userId = "user-123") {
  const file = new File(["content"], "form.pdf", { type: "application/pdf" })
  return { userId, file }
}

function stubFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

function stubFetchError(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("lib/masshealth/extract-workflow-client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("resolves with the parsed response on success", async () => {
    vi.stubGlobal("fetch", stubFetchOk(makeValidResponse()))

    const result = await extractMasshealthWorkflow(makePayload())

    expect(result.status).toBe("ok")
    expect(result.user_id).toBe("user-123")
    expect(result.source_pdf).toBe("form.pdf")
    expect(result.workflow_data).toEqual({ key: "value" })
  })

  it("sends a POST request to the extract-workflow endpoint", async () => {
    const fetchMock = stubFetchOk(makeValidResponse())
    vi.stubGlobal("fetch", fetchMock)

    await extractMasshealthWorkflow(makePayload())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/masshealth/forms/extract-workflow")
    expect(init.method).toBe("POST")
  })

  it("uses FormData as the request body", async () => {
    const fetchMock = stubFetchOk(makeValidResponse())
    vi.stubGlobal("fetch", fetchMock)

    await extractMasshealthWorkflow(makePayload())

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeInstanceOf(FormData)
  })

  it("includes user_id in the FormData", async () => {
    let capturedBody: FormData | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedBody = init.body as FormData
        return Promise.resolve({ ok: true, json: () => Promise.resolve(makeValidResponse()) })
      }),
    )

    await extractMasshealthWorkflow(makePayload("test-user-456"))

    expect(capturedBody?.get("user_id")).toBe("test-user-456")
  })

  it("includes the file in the FormData", async () => {
    let capturedBody: FormData | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedBody = init.body as FormData
        return Promise.resolve({ ok: true, json: () => Promise.resolve(makeValidResponse()) })
      }),
    )

    const file = new File(["data"], "my-form.pdf", { type: "application/pdf" })
    await extractMasshealthWorkflow({ userId: "u1", file })

    const uploaded = capturedBody?.get("file")
    expect(uploaded).toBeInstanceOf(File)
    expect((uploaded as File).name).toBe("my-form.pdf")
  })

  // ── HTTP error handling ──────────────────────────────────────────────────────

  it("throws with the server error message when HTTP response is not ok", async () => {
    vi.stubGlobal("fetch", stubFetchError(500, { error: "Internal server error" }))

    await expect(extractMasshealthWorkflow(makePayload())).rejects.toThrow("Internal server error")
  })

  it("throws a status-code message when the error body has no error field", async () => {
    vi.stubGlobal("fetch", stubFetchError(503, {}))

    await expect(extractMasshealthWorkflow(makePayload())).rejects.toThrow("503")
  })

  // ── Response validation ──────────────────────────────────────────────────────

  it("throws when the response status field is not 'ok'", async () => {
    vi.stubGlobal("fetch", stubFetchOk(makeValidResponse({ status: "error" })))

    await expect(extractMasshealthWorkflow(makePayload())).rejects.toThrow(/status "error"/)
  })

  it("throws when workflow_data is missing from the response", async () => {
    const bad = { status: "ok", user_id: "u", source_pdf: "f.pdf" }
    vi.stubGlobal("fetch", stubFetchOk(bad))

    await expect(extractMasshealthWorkflow(makePayload())).rejects.toThrow("missing workflow_data")
  })

  it("throws when user_id is missing from the response", async () => {
    const bad = { status: "ok", source_pdf: "f.pdf", workflow_data: {} }
    vi.stubGlobal("fetch", stubFetchOk(bad))

    await expect(extractMasshealthWorkflow(makePayload())).rejects.toThrow("missing user_id")
  })

  it("throws when source_pdf is missing from the response", async () => {
    const bad = { status: "ok", user_id: "u", workflow_data: {} }
    vi.stubGlobal("fetch", stubFetchOk(bad))

    await expect(extractMasshealthWorkflow(makePayload())).rejects.toThrow("missing source_pdf")
  })

  it("throws when the response is not an object", async () => {
    vi.stubGlobal("fetch", stubFetchOk(null))

    await expect(extractMasshealthWorkflow(makePayload())).rejects.toThrow()
  })
})
