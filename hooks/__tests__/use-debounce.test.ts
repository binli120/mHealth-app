import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDebounce } from "@/hooks/use-debounce"

describe("hooks/use-debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300))
    expect(result.current).toBe("hello")
  })

  it("does not update the value before the delay elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    })

    rerender({ value: "updated" })
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe("initial")
  })

  it("updates the value after the delay elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    })

    rerender({ value: "updated" })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe("updated")
  })

  it("resets the timer when the value changes before delay completes", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    })

    rerender({ value: "first" })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: "second" })
    act(() => vi.advanceTimersByTime(200))
    // Only 200ms since "second" was set — still debouncing
    expect(result.current).toBe("initial")

    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe("second")
  })

  it("handles numeric values", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 200), {
      initialProps: { value: 0 },
    })

    rerender({ value: 42 })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe(42)
  })
})
