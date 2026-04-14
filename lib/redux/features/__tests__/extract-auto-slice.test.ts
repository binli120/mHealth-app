/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import {
  extractAutoReducer,
  requestStarted,
  requestSucceeded,
  requestFailed,
  resetExtractAutoState,
  requestExtractAuto,
  selectExtractAutoState,
  selectExtractAutoStatus,
  selectExtractAutoData,
  selectExtractAutoMethod,
  selectExtractAutoPdfType,
  selectIsBlankTemplate,
  selectExtractAutoError,
  selectWorkflowData,
  selectStructuredSections,
  type ExtractAutoState,
} from "@/lib/redux/features/extract-auto-slice"
import type { ExtractAutoResponse } from "@/lib/masshealth/extract-auto-client"
import { makeStore } from "@/lib/redux/store"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWorkflowResponse(overrides: Partial<ExtractAutoResponse> = {}): ExtractAutoResponse {
  return {
    scan: { pdf_type: "electronic_filled" },
    extraction_method: "workflow",
    result: { workflow_data: { applicant_name: "Jane Doe" } },
    ...overrides,
  }
}

function makeStructuredResponse(overrides: Partial<ExtractAutoResponse> = {}): ExtractAutoResponse {
  return {
    scan: { pdf_type: "scanned" },
    extraction_method: "structured",
    result: {
      sections: [{ title: "Section A" }],
      pages: [{ page: 1 }],
    },
    ocr_page_count: 8,
    ...overrides,
  }
}

/** Minimal RootState shape the selectors need. */
function rootStateWith(slice: ExtractAutoState) {
  return { extractAuto: slice } as ReturnType<ReturnType<typeof makeStore>["getState"]>
}

function initialState(): ExtractAutoState {
  return extractAutoReducer(undefined, { type: "@@init" })
}

// ── Reducer ───────────────────────────────────────────────────────────────────

describe("extractAutoReducer", () => {
  it("returns correct initial state", () => {
    const state = initialState()

    expect(state).toEqual({
      status: "idle",
      data: null,
      extractionMethod: null,
      pdfType: null,
      isBlankTemplate: false,
      error: null,
    })
  })

  it("requestStarted → status loading, clears error and isBlankTemplate", () => {
    const prev: ExtractAutoState = {
      ...initialState(),
      status: "failed",
      error: "prior error",
      isBlankTemplate: true,
    }

    const state = extractAutoReducer(prev, requestStarted())

    expect(state.status).toBe("loading")
    expect(state.error).toBeNull()
    expect(state.isBlankTemplate).toBe(false)
  })

  it("requestSucceeded — workflow path populates derived fields", () => {
    const response = makeWorkflowResponse()
    const state = extractAutoReducer(initialState(), requestSucceeded(response))

    expect(state.status).toBe("succeeded")
    expect(state.data).toEqual(response)
    expect(state.extractionMethod).toBe("workflow")
    expect(state.pdfType).toBe("electronic_filled")
    expect(state.isBlankTemplate).toBe(false)
    expect(state.error).toBeNull()
  })

  it("requestSucceeded — structured path populates derived fields", () => {
    const response = makeStructuredResponse()
    const state = extractAutoReducer(initialState(), requestSucceeded(response))

    expect(state.status).toBe("succeeded")
    expect(state.extractionMethod).toBe("structured")
    expect(state.pdfType).toBe("scanned")
    expect(state.isBlankTemplate).toBe(false)
  })

  it("requestSucceeded — electronic_blank sets isBlankTemplate true", () => {
    const response = makeWorkflowResponse({
      scan: { pdf_type: "electronic_blank" },
    })
    const state = extractAutoReducer(initialState(), requestSucceeded(response))

    expect(state.isBlankTemplate).toBe(true)
    expect(state.pdfType).toBe("electronic_blank")
  })

  it("requestFailed → status failed with error message", () => {
    const state = extractAutoReducer(initialState(), requestFailed("Upload timed out"))

    expect(state.status).toBe("failed")
    expect(state.error).toBe("Upload timed out")
    expect(state.data).toBeNull()
  })

  it("resetExtractAutoState → returns to initial state", () => {
    const loaded = extractAutoReducer(
      initialState(),
      requestSucceeded(makeWorkflowResponse()),
    )

    const reset = extractAutoReducer(loaded, resetExtractAutoState())

    expect(reset).toEqual(initialState())
  })
})

// ── Selectors ─────────────────────────────────────────────────────────────────

describe("extract-auto selectors", () => {
  it("selectExtractAutoState returns the full slice", () => {
    const slice = { ...initialState(), status: "loading" as const }
    expect(selectExtractAutoState(rootStateWith(slice))).toBe(slice)
  })

  it("selectExtractAutoStatus returns status", () => {
    const slice = { ...initialState(), status: "succeeded" as const }
    expect(selectExtractAutoStatus(rootStateWith(slice))).toBe("succeeded")
  })

  it("selectExtractAutoData returns data", () => {
    const response = makeWorkflowResponse()
    const slice = { ...initialState(), data: response }
    expect(selectExtractAutoData(rootStateWith(slice))).toEqual(response)
  })

  it("selectExtractAutoMethod returns extractionMethod", () => {
    const slice = { ...initialState(), extractionMethod: "structured" as const }
    expect(selectExtractAutoMethod(rootStateWith(slice))).toBe("structured")
  })

  it("selectExtractAutoPdfType returns pdfType", () => {
    const slice = { ...initialState(), pdfType: "scanned" as const }
    expect(selectExtractAutoPdfType(rootStateWith(slice))).toBe("scanned")
  })

  it("selectIsBlankTemplate returns isBlankTemplate", () => {
    const slice = { ...initialState(), isBlankTemplate: true }
    expect(selectIsBlankTemplate(rootStateWith(slice))).toBe(true)
  })

  it("selectExtractAutoError returns error", () => {
    const slice = { ...initialState(), error: "something went wrong" }
    expect(selectExtractAutoError(rootStateWith(slice))).toBe("something went wrong")
  })

  describe("selectWorkflowData", () => {
    it("returns workflow_data when extraction_method is 'workflow'", () => {
      const response = makeWorkflowResponse()
      const slice: ExtractAutoState = {
        ...initialState(),
        data: response,
        extractionMethod: "workflow",
      }

      const result = selectWorkflowData(rootStateWith(slice))

      expect(result).toEqual({ applicant_name: "Jane Doe" })
    })

    it("returns null when extraction_method is 'structured'", () => {
      const slice: ExtractAutoState = {
        ...initialState(),
        data: makeStructuredResponse(),
        extractionMethod: "structured",
      }

      expect(selectWorkflowData(rootStateWith(slice))).toBeNull()
    })

    it("returns null when data is null", () => {
      expect(selectWorkflowData(rootStateWith(initialState()))).toBeNull()
    })
  })

  describe("selectStructuredSections", () => {
    it("returns sections when extraction_method is 'structured'", () => {
      const response = makeStructuredResponse()
      const slice: ExtractAutoState = {
        ...initialState(),
        data: response,
        extractionMethod: "structured",
      }

      const result = selectStructuredSections(rootStateWith(slice))

      expect(result).toEqual([{ title: "Section A" }])
    })

    it("returns null when extraction_method is 'workflow'", () => {
      const slice: ExtractAutoState = {
        ...initialState(),
        data: makeWorkflowResponse(),
        extractionMethod: "workflow",
      }

      expect(selectStructuredSections(rootStateWith(slice))).toBeNull()
    })

    it("returns null when data is null", () => {
      expect(selectStructuredSections(rootStateWith(initialState()))).toBeNull()
    })
  })
})

// ── Thunk ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/masshealth/extract-auto-client", () => ({
  extractMasshealthAuto: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  getSafeSupabaseUser: vi.fn(),
}))

import { extractMasshealthAuto } from "@/lib/masshealth/extract-auto-client"
import { getSafeSupabaseUser } from "@/lib/supabase/client"

const mockExtract = vi.mocked(extractMasshealthAuto)
const mockGetUser = vi.mocked(getSafeSupabaseUser)

describe("requestExtractAuto thunk", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ user: { id: "auto-user-id" } as never, error: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("dispatches requestStarted then requestSucceeded on success", async () => {
    const response = makeWorkflowResponse()
    mockExtract.mockResolvedValue(response)

    const store = makeStore()
    const file = new File(["data"], "aca3.pdf", { type: "application/pdf" })

    const result = await store.dispatch(requestExtractAuto({ file, userId: "u1" }))

    const state = store.getState().extractAuto
    expect(state.status).toBe("succeeded")
    expect(state.data).toEqual(response)
    expect(state.extractionMethod).toBe("workflow")
    expect(result).toEqual(response)
  })

  it("dispatches requestFailed when the client throws", async () => {
    mockExtract.mockRejectedValue(new Error("Service unavailable"))

    const store = makeStore()
    const file = new File(["data"], "aca3.pdf", { type: "application/pdf" })

    const result = await store.dispatch(requestExtractAuto({ file, userId: "u1" }))

    const state = store.getState().extractAuto
    expect(state.status).toBe("failed")
    expect(state.error).toBe("Service unavailable")
    expect(result).toBeNull()
  })

  it("dispatches requestFailed for a non-PDF file without calling the service", async () => {
    const store = makeStore()
    const file = new File(["data"], "form.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })

    await store.dispatch(requestExtractAuto({ file, userId: "u1" }))

    const state = store.getState().extractAuto
    expect(state.status).toBe("failed")
    expect(state.error).toMatch(/PDF/i)
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it("resolves userId from Supabase session when not provided", async () => {
    const response = makeWorkflowResponse()
    mockExtract.mockResolvedValue(response)

    const store = makeStore()
    const file = new File(["data"], "aca3.pdf", { type: "application/pdf" })

    await store.dispatch(requestExtractAuto({ file }))

    expect(mockGetUser).toHaveBeenCalledOnce()
    expect(mockExtract).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "auto-user-id" }),
    )
  })

  it("dispatches requestFailed when Supabase session is missing and no userId supplied", async () => {
    mockGetUser.mockResolvedValue({ user: null, error: new Error("no session") as never })

    const store = makeStore()
    const file = new File(["data"], "aca3.pdf", { type: "application/pdf" })

    await store.dispatch(requestExtractAuto({ file }))

    const state = store.getState().extractAuto
    expect(state.status).toBe("failed")
    expect(state.error).toMatch(/signed in/i)
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it("passes documentType through to the client", async () => {
    const response = makeWorkflowResponse()
    mockExtract.mockResolvedValue(response)

    const store = makeStore()
    const file = new File(["data"], "aca3.pdf", { type: "application/pdf" })

    await store.dispatch(requestExtractAuto({ file, userId: "u1", documentType: "aca3" }))

    expect(mockExtract).toHaveBeenCalledWith(
      expect.objectContaining({ documentType: "aca3" }),
    )
  })

  it("isBlankTemplate is true after a blank-template response", async () => {
    const response = makeWorkflowResponse({ scan: { pdf_type: "electronic_blank" } })
    mockExtract.mockResolvedValue(response)

    const store = makeStore()
    const file = new File(["data"], "aca3.pdf", { type: "application/pdf" })

    await store.dispatch(requestExtractAuto({ file, userId: "u1" }))

    expect(store.getState().extractAuto.isBlankTemplate).toBe(true)
  })

  it("status resets to loading on a subsequent dispatch after failure", async () => {
    mockExtract.mockRejectedValueOnce(new Error("timeout"))

    const store = makeStore()
    const file = new File(["data"], "aca3.pdf", { type: "application/pdf" })

    await store.dispatch(requestExtractAuto({ file, userId: "u1" }))
    expect(store.getState().extractAuto.status).toBe("failed")

    // Start a second dispatch — check the intermediate loading state
    mockExtract.mockResolvedValueOnce(makeWorkflowResponse())
    const thunk = store.dispatch(requestExtractAuto({ file, userId: "u1" }))
    // synchronously the store should already be in "loading"
    expect(store.getState().extractAuto.status).toBe("loading")

    await thunk
    expect(store.getState().extractAuto.status).toBe("succeeded")
  })
})
