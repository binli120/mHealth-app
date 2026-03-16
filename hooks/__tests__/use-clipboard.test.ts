import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useClipboard } from "@/hooks/use-clipboard"

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  })
}

describe("hooks/use-clipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("starts with copied = false", () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined))
    const { result } = renderHook(() => useClipboard())
    expect(result.current.copied).toBe(false)
  })

  it("sets copied = true after a successful copy", async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined))
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy("hello world")
    })

    expect(result.current.copied).toBe(true)
  })

  it("passes the correct text to clipboard.writeText", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    mockClipboard(writeText)
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy("some text")
    })

    expect(writeText).toHaveBeenCalledWith("some text")
  })

  it("resets copied to false after the resetDelay", async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined))
    const { result } = renderHook(() => useClipboard(1000))

    await act(async () => {
      await result.current.copy("text")
    })
    expect(result.current.copied).toBe(true)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.copied).toBe(false)
  })

  it("does not reset before the delay has elapsed", async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined))
    const { result } = renderHook(() => useClipboard(1000))

    await act(async () => {
      await result.current.copy("text")
    })

    act(() => vi.advanceTimersByTime(500))
    expect(result.current.copied).toBe(true)
  })

  it("does not throw when clipboard is unavailable", async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error("clipboard unavailable")))
    const { result } = renderHook(() => useClipboard())

    await expect(
      act(async () => {
        await result.current.copy("text")
      }),
    ).resolves.not.toThrow()

    expect(result.current.copied).toBe(false)
  })
})
