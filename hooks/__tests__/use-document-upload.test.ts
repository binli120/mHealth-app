/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDocumentUpload } from "@/hooks/use-document-upload"

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn(),
}))

import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

const mockFetch = vi.mocked(authenticatedFetch)

const ENDPOINT = "/api/appeals/extract-document"
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

function makeFile(name: string, sizeBytes: number, type = "image/jpeg"): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("hooks/use-document-upload", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("starts in idle state", () => {
    const { result } = renderHook(() =>
      useDocumentUpload({ extractEndpoint: ENDPOINT, maxBytes: MAX_BYTES }),
    )
    expect(result.current.state.status).toBe("idle")
  })

  it("exposes a fileInputRef", () => {
    const { result } = renderHook(() =>
      useDocumentUpload({ extractEndpoint: ENDPOINT, maxBytes: MAX_BYTES }),
    )
    expect(result.current.fileInputRef).toBeDefined()
    expect(result.current.fileInputRef).toHaveProperty("current")
  })

  it("sets error state when file exceeds maxBytes", async () => {
    const { result } = renderHook(() =>
      useDocumentUpload({ extractEndpoint: ENDPOINT, maxBytes: MAX_BYTES }),
    )
    const tooBig = makeFile("big.pdf", MAX_BYTES + 1)

    await act(async () => {
      await result.current.handleFile(tooBig)
    })

    expect(result.current.state.status).toBe("error")
    if (result.current.state.status === "error") {
      expect(result.current.state.fileName).toBe("big.pdf")
      expect(result.current.state.message).toMatch(/limit/)
    }
  })

  it("goes through extracting → ready on a successful API response", async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ ok: true, extractedText: "extracted content" }),
    )

    const { result } = renderHook(() =>
      useDocumentUpload({ extractEndpoint: ENDPOINT, maxBytes: MAX_BYTES }),
    )
    const file = makeFile("letter.pdf", 1024)

    await act(async () => {
      await result.current.handleFile(file)
    })

    await waitFor(() => expect(result.current.state.status).toBe("ready"))

    if (result.current.state.status === "ready") {
      expect(result.current.state.fileName).toBe("letter.pdf")
      expect(result.current.state.extractedText).toBe("extracted content")
    }
  })

  it("sets error state when the API returns ok:false", async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ ok: false, error: "Unsupported file type" }),
    )

    const { result } = renderHook(() =>
      useDocumentUpload({ extractEndpoint: ENDPOINT, maxBytes: MAX_BYTES }),
    )
    const file = makeFile("bad.gif", 512, "image/gif")

    await act(async () => {
      await result.current.handleFile(file)
    })

    await waitFor(() => expect(result.current.state.status).toBe("error"))

    if (result.current.state.status === "error") {
      expect(result.current.state.message).toBe("Unsupported file type")
    }
  })

  it("sets error state when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() =>
      useDocumentUpload({ extractEndpoint: ENDPOINT, maxBytes: MAX_BYTES }),
    )
    const file = makeFile("doc.pdf", 1024)

    await act(async () => {
      await result.current.handleFile(file)
    })

    await waitFor(() => expect(result.current.state.status).toBe("error"))

    if (result.current.state.status === "error") {
      expect(result.current.state.message).toMatch(/upload failed/i)
    }
  })

  it("posts to the correct endpoint with a FormData body", async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ ok: true, extractedText: "text" }),
    )

    const { result } = renderHook(() =>
      useDocumentUpload({ extractEndpoint: ENDPOINT, maxBytes: MAX_BYTES }),
    )
    const file = makeFile("letter.pdf", 1024)

    await act(async () => {
      await result.current.handleFile(file)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    )
  })

  it("clear() resets state back to idle", async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ ok: true, extractedText: "text" }),
    )

    const { result } = renderHook(() =>
      useDocumentUpload({ extractEndpoint: ENDPOINT, maxBytes: MAX_BYTES }),
    )

    await act(async () => {
      await result.current.handleFile(makeFile("doc.pdf", 1024))
    })
    await waitFor(() => expect(result.current.state.status).toBe("ready"))

    act(() => result.current.clear())
    expect(result.current.state.status).toBe("idle")
  })

  it("clear() resets error state back to idle", async () => {
    mockFetch.mockRejectedValue(new Error("fail"))

    const { result } = renderHook(() =>
      useDocumentUpload({ extractEndpoint: ENDPOINT, maxBytes: MAX_BYTES }),
    )

    await act(async () => {
      await result.current.handleFile(makeFile("doc.pdf", 1024))
    })
    await waitFor(() => expect(result.current.state.status).toBe("error"))

    act(() => result.current.clear())
    expect(result.current.state.status).toBe("idle")
  })
})
