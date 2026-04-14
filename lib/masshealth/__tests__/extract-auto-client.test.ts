/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { extractMasshealthAuto } from "@/lib/masshealth/extract-auto-client"
import type { ExtractAutoResponse } from "@/lib/masshealth/extract-auto-client"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWorkflowResponse(overrides: Partial<ExtractAutoResponse> = {}): ExtractAutoResponse {
  return {
    scan: { pdf_type: "electronic_filled" },
    extraction_method: "workflow",
    result: { workflow_data: { applicant_name: "Jane Doe", ssn: "XXX-XX-1234" } },
    ...overrides,
  }
}

function makeStructuredResponse(overrides: Partial<ExtractAutoResponse> = {}): ExtractAutoResponse {
  return {
    scan: { pdf_type: "scanned" },
    extraction_method: "structured",
    result: {
      sections: [{ title: "Applicant Info", fields: [] }],
      pages: [{ page: 1, text: "..." }],
    },
    ocr_page_count: 12,
    ...overrides,
  }
}

function makePayload(userId = "user-123", documentType?: string) {
  const file = new File(["content"], "aca3.pdf", { type: "application/pdf" })
  return { userId, file, documentType }
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

describe("lib/masshealth/extract-auto-client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Happy path — workflow ────────────────────────────────────────────────────

  it("resolves with a workflow response for an electronic filled PDF", async () => {
    vi.stubGlobal("fetch", stubFetchOk(makeWorkflowResponse()))

    const result = await extractMasshealthAuto(makePayload())

    expect(result.scan.pdf_type).toBe("electronic_filled")
    expect(result.extraction_method).toBe("workflow")
    expect((result.result as Record<string, unknown>).workflow_data).toEqual({
      applicant_name: "Jane Doe",
      ssn: "XXX-XX-1234",
    })
  })

  // ── Happy path — structured ──────────────────────────────────────────────────

  it("resolves with a structured response for a scanned PDF", async () => {
    vi.stubGlobal("fetch", stubFetchOk(makeStructuredResponse()))

    const result = await extractMasshealthAuto(makePayload())

    expect(result.scan.pdf_type).toBe("scanned")
    expect(result.extraction_method).toBe("structured")
    expect(result.ocr_page_count).toBe(12)
    const structured = result.result as Record<string, unknown>
    expect(Array.isArray(structured.sections)).toBe(true)
    expect(Array.isArray(structured.pages)).toBe(true)
  })

  // ── HTTP method and endpoint ─────────────────────────────────────────────────

  it("sends a POST request to the extract/auto endpoint", async () => {
    const fetchMock = stubFetchOk(makeWorkflowResponse())
    vi.stubGlobal("fetch", fetchMock)

    await extractMasshealthAuto(makePayload())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/masshealth/extract/auto")
    expect(init.method).toBe("POST")
  })

  it("uses FormData as the request body", async () => {
    const fetchMock = stubFetchOk(makeWorkflowResponse())
    vi.stubGlobal("fetch", fetchMock)

    await extractMasshealthAuto(makePayload())

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeInstanceOf(FormData)
  })

  // ── FormData fields ──────────────────────────────────────────────────────────

  it("includes user_id in FormData", async () => {
    let captured: FormData | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        captured = init.body as FormData
        return Promise.resolve({ ok: true, json: () => Promise.resolve(makeWorkflowResponse()) })
      }),
    )

    await extractMasshealthAuto(makePayload("user-abc"))

    expect(captured?.get("user_id")).toBe("user-abc")
  })

  it("includes the file in FormData", async () => {
    let captured: FormData | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        captured = init.body as FormData
        return Promise.resolve({ ok: true, json: () => Promise.resolve(makeWorkflowResponse()) })
      }),
    )

    const file = new File(["data"], "my-aca3.pdf", { type: "application/pdf" })
    await extractMasshealthAuto({ userId: "u1", file })

    const uploaded = captured?.get("file")
    expect(uploaded).toBeInstanceOf(File)
    expect((uploaded as File).name).toBe("my-aca3.pdf")
  })

  it("includes document_type in FormData when provided", async () => {
    let captured: FormData | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        captured = init.body as FormData
        return Promise.resolve({ ok: true, json: () => Promise.resolve(makeWorkflowResponse()) })
      }),
    )

    await extractMasshealthAuto(makePayload("u1", "aca3"))

    expect(captured?.get("document_type")).toBe("aca3")
  })

  it("defaults document_type to 'aca3' when omitted", async () => {
    let captured: FormData | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        captured = init.body as FormData
        return Promise.resolve({ ok: true, json: () => Promise.resolve(makeWorkflowResponse()) })
      }),
    )

    const file = new File(["d"], "f.pdf", { type: "application/pdf" })
    await extractMasshealthAuto({ userId: "u1", file })

    expect(captured?.get("document_type")).toBe("aca3")
  })

  // ── HTTP error handling ──────────────────────────────────────────────────────

  it("throws with the server error message when HTTP response is not ok", async () => {
    vi.stubGlobal("fetch", stubFetchError(400, { error: "Blank template uploaded" }))

    await expect(extractMasshealthAuto(makePayload())).rejects.toThrow("Blank template uploaded")
  })

  it("throws a status-code message when the error body has no error field", async () => {
    vi.stubGlobal("fetch", stubFetchError(503, {}))

    await expect(extractMasshealthAuto(makePayload())).rejects.toThrow("503")
  })

  // ── Response validation ──────────────────────────────────────────────────────

  it("throws when the response is not an object", async () => {
    vi.stubGlobal("fetch", stubFetchOk(null))

    await expect(extractMasshealthAuto(makePayload())).rejects.toThrow()
  })

  it("throws when scan is missing", async () => {
    const bad = { extraction_method: "workflow", result: {} }
    vi.stubGlobal("fetch", stubFetchOk(bad))

    await expect(extractMasshealthAuto(makePayload())).rejects.toThrow("missing scan")
  })

  it("throws when scan.pdf_type is missing", async () => {
    const bad = { scan: {}, extraction_method: "workflow", result: {} }
    vi.stubGlobal("fetch", stubFetchOk(bad))

    await expect(extractMasshealthAuto(makePayload())).rejects.toThrow("pdf_type")
  })

  it("throws when extraction_method is missing", async () => {
    const bad = { scan: { pdf_type: "electronic_filled" }, result: {} }
    vi.stubGlobal("fetch", stubFetchOk(bad))

    await expect(extractMasshealthAuto(makePayload())).rejects.toThrow("missing extraction_method")
  })

  it("throws when result is missing", async () => {
    const bad = { scan: { pdf_type: "electronic_filled" }, extraction_method: "workflow" }
    vi.stubGlobal("fetch", stubFetchOk(bad))

    await expect(extractMasshealthAuto(makePayload())).rejects.toThrow("missing result")
  })
})
