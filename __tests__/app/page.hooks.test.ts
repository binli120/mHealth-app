/**
 * Tests for the landing-page stat counter hooks.
 *
 * The critical invariant: the first render (what the server sends as HTML)
 * must show the FINAL stat value, never 0. Crawlers, link previews, and
 * no-JS visitors only ever see that first render — a 0 there means the
 * homepage reads "0+ benefit programs checked" to anyone without JS.
 */
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useCounter } from "@/app/page.hooks"

describe("useCounter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the final value on first render (SSR-safe, no zeros)", () => {
    const { result } = renderHook(() => useCounter(700000, false))
    expect(result.current).toBe(700000)
  })

  it("still shows the final value when never scrolled into view", () => {
    const { result } = renderHook(() => useCounter(9, false))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current).toBe(9)
  })

  it("animates from 0 back up to the final value once in view", () => {
    const { result, rerender } = renderHook(
      ({ inView }) => useCounter(100, inView, 160),
      { initialProps: { inView: false } },
    )
    expect(result.current).toBe(100)

    rerender({ inView: true })
    act(() => {
      vi.advanceTimersByTime(16)
    })
    // Animation has restarted from the bottom
    expect(result.current).toBeLessThan(100)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current).toBe(100)
  })

  it("settles exactly on the target value", () => {
    const { result } = renderHook(() => useCounter(15, true, 100))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current).toBe(15)
  })
})
