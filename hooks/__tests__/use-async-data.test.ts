/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useAsyncData } from "@/hooks/use-async-data"

describe("hooks/use-async-data", () => {
  it("starts in a loading state", () => {
    const fetcher = vi.fn(() => new Promise<string>(() => {}))
    const { result } = renderHook(() => useAsyncData(fetcher))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("transitions to data on a successful fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue(["item1", "item2"])
    const { result } = renderHook(() => useAsyncData(fetcher))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual(["item1", "item2"])
    expect(result.current.error).toBeNull()
  })

  it("transitions to error when the fetcher rejects", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("Network failure"))
    const { result } = renderHook(() => useAsyncData(fetcher))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe("Network failure")
  })

  it("uses a fallback error message for non-Error rejections", async () => {
    const fetcher = vi.fn().mockRejectedValue("plain string error")
    const { result } = renderHook(() => useAsyncData(fetcher))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBe("Failed to load data")
  })

  it("calls the fetcher once on mount", async () => {
    const fetcher = vi.fn().mockResolvedValue(null)
    renderHook(() => useAsyncData(fetcher))

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  })

  it("re-fetches when reload() is called", async () => {
    const fetcher = vi.fn().mockResolvedValue("data")
    const { result } = renderHook(() => useAsyncData(fetcher))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetcher).toHaveBeenCalledTimes(1)

    act(() => result.current.reload())

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(result.current.data).toBe("data")
  })

  it("clears the error and re-loads on reload()", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce("recovered")

    const { result } = renderHook(() => useAsyncData(fetcher))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe("first failure")

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.data).toBe("recovered")
  })

  it("re-fetches when the fetcher reference changes", async () => {
    const fetcherA = vi.fn().mockResolvedValue("A")
    const fetcherB = vi.fn().mockResolvedValue("B")

    const { result, rerender } = renderHook(({ fetcher }) => useAsyncData(fetcher), {
      initialProps: { fetcher: fetcherA },
    })

    await waitFor(() => expect(result.current.data).toBe("A"))

    rerender({ fetcher: fetcherB })
    await waitFor(() => expect(result.current.data).toBe("B"))
  })
})
