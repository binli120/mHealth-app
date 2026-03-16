import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useAutoScroll } from "@/hooks/use-auto-scroll"

describe("hooks/use-auto-scroll", () => {
  it("returns a ref object", () => {
    const { result } = renderHook(() => useAutoScroll([]))
    expect(result.current).toBeDefined()
    expect(result.current).toHaveProperty("current")
  })

  it("calls scrollIntoView on the ref element when deps change", () => {
    const scrollIntoView = vi.fn()
    const { result, rerender } = renderHook(
      ({ deps }) => useAutoScroll(deps),
      { initialProps: { deps: [0] } },
    )

    // Attach a mock DOM element to the ref
    Object.defineProperty(result.current, "current", {
      value: { scrollIntoView },
      writable: true,
      configurable: true,
    })

    // Trigger a dep change
    act(() => rerender({ deps: [1] }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" })
  })

  it("calls scrollIntoView with behavior:smooth on mount", () => {
    const scrollIntoView = vi.fn()
    const element = { scrollIntoView }

    renderHook(() => {
      const ref = useAutoScroll([])
      // Simulate the ref being attached before the effect runs
      Object.defineProperty(ref, "current", {
        value: element,
        writable: true,
        configurable: true,
      })
      return ref
    })

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" })
  })

  it("does not throw when ref.current is null", () => {
    expect(() => {
      renderHook(() => useAutoScroll(["trigger"]))
    }).not.toThrow()
  })
})
