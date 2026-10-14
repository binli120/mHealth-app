/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { renderHook, waitFor } from "@testing-library/react"
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
