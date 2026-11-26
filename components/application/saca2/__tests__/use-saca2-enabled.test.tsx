/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSaca2Enabled } from "@/components/application/saca2/use-saca2-enabled"

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useSaca2Enabled", () => {
  it("does not fetch while inactive", () => {
    const { result } = renderHook(() => useSaca2Enabled(false))
    expect(result.current).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns the server's answer once active", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) })
    const { result } = renderHook(() => useSaca2Enabled(true))
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith("/api/config/saca2", expect.objectContaining({ cache: "no-store" }))
  })

  it("fails closed on a network error, a non-OK status, or a malformed body", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    const a = renderHook(() => useSaca2Enabled(true))
    await waitFor(() => expect(a.result.current).toBe(false))

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ enabled: true }) })
    const b = renderHook(() => useSaca2Enabled(true))
    await waitFor(() => expect(b.result.current).toBe(false))

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: "true" }) })
    const c = renderHook(() => useSaca2Enabled(true))
    await waitFor(() => expect(c.result.current).toBe(false))
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
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) })
    const { result } = renderHook(() => useSaca2Enabled(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("fails closed when the request never resolves", async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(hangUntilAborted)
    const { result } = renderHook(() => useSaca2Enabled(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_999)
    })
    expect(result.current).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(result.current).toBe(false)
  })

  it("clears the timer on unmount", () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(hangUntilAborted)
    const { unmount } = renderHook(() => useSaca2Enabled(true))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
