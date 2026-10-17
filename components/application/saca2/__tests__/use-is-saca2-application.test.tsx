/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch,
}))

import { useIsSaca2Application } from "@/components/application/saca2/use-is-saca2-application"

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response
}

describe("useIsSaca2Application", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("answers from Redux without fetching when the type is known", () => {
    const { result } = renderHook(() => useIsSaca2Application("app-1", "saca2"))
    expect(result.current).toBe("saca2")
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled()

    const other = renderHook(() => useIsSaca2Application("app-2", "aca3"))
    expect(other.result.current).toBe("other")
  })

  it("returns other immediately when there is no application id (new application)", () => {
    const { result } = renderHook(() => useIsSaca2Application(undefined, ""))
    expect(result.current).toBe("other")
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled()
  })

  it("looks the type up from the server draft after a reload (Redux empty)", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, record: { applicationType: "saca2" } }),
    )
    const { result } = renderHook(() => useIsSaca2Application("app-3", ""))
    expect(result.current).toBe("unknown")
    await waitFor(() => expect(result.current).toBe("saca2"))
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/applications/app-3/draft",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("forwards the acting-for-patient header for social workers", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, record: { applicationType: "aca3" } }),
    )
    const { result } = renderHook(() => useIsSaca2Application("app-4", "", "patient-9"))
    await waitFor(() => expect(result.current).toBe("other"))
    const init = mocks.authenticatedFetch.mock.calls[0][1] as { headers?: Record<string, string> }
    expect(init.headers?.["X-Acting-For-Patient"]).toBe("patient-9")
  })

  it("treats a draft with no type, or no draft at all (404), as other", async () => {
    mocks.authenticatedFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, record: { applicationType: null } }),
    )
    const untyped = renderHook(() => useIsSaca2Application("app-6", ""))
    await waitFor(() => expect(untyped.result.current).toBe("other"))

    mocks.authenticatedFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ ok: false, error: "not found" }),
    } as unknown as Response)
    const missing = renderHook(() => useIsSaca2Application("app-7", ""))
    await waitFor(() => expect(missing.result.current).toBe("other"))
  })

  it("fails closed with error (never other) on a network failure, 5xx, or 401", async () => {
    mocks.authenticatedFetch.mockRejectedValueOnce(new Error("network"))
    const network = renderHook(() => useIsSaca2Application("app-8", ""))
    await waitFor(() => expect(network.result.current).toBe("error"))

    mocks.authenticatedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: "boom" }),
    } as unknown as Response)
    const serverError = renderHook(() => useIsSaca2Application("app-9", ""))
    await waitFor(() => expect(serverError.result.current).toBe("error"))

    mocks.authenticatedFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, error: "unauthorized" }),
    } as unknown as Response)
    const unauthorized = renderHook(() => useIsSaca2Application("app-10", ""))
    await waitFor(() => expect(unauthorized.result.current).toBe("error"))
  })
})

function hangUntilAborted(_url: unknown, init?: { signal?: AbortSignal }) {
  return new Promise<never>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")))
  })
}

describe("without AbortSignal.timeout (Safari 15 and older)", () => {
  const nativeTimeout = AbortSignal.timeout

  beforeEach(() => {
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true, writable: true })
  })

  afterEach(() => {
    Object.defineProperty(AbortSignal, "timeout", { value: nativeTimeout, configurable: true, writable: true })
    vi.useRealTimers()
  })

  it("still resolves normally and leaves no timer pending", async () => {
    vi.useFakeTimers()
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, record: { applicationType: "saca2" } }),
    )
    const { result } = renderHook(() => useIsSaca2Application("app-20", ""))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe("saca2")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("fails closed with error when the request never resolves", async () => {
    vi.useFakeTimers()
    mocks.authenticatedFetch.mockImplementation(hangUntilAborted)
    const { result } = renderHook(() => useIsSaca2Application("app-21", ""))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_999)
    })
    expect(result.current).toBe("unknown")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(result.current).toBe("error")
  })

  it("clears the timer on unmount", async () => {
    vi.useFakeTimers()
    mocks.authenticatedFetch.mockImplementation(hangUntilAborted)
    const { unmount } = renderHook(() => useIsSaca2Application("app-22", ""))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
