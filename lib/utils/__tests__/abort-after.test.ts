/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { abortAfter } from "@/lib/utils/abort-after"

const originalTimeout = AbortSignal.timeout

function removeNativeTimeout() {
  Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true, writable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  Object.defineProperty(AbortSignal, "timeout", { value: originalTimeout, configurable: true, writable: true })
  vi.useRealTimers()
})

describe("abortAfter with native AbortSignal.timeout", () => {
  it("aborts after ms and cancel is a harmless no-op", () => {
    const { signal, cancel } = abortAfter(1000)
    expect(signal.aborted).toBe(false)
    vi.advanceTimersByTime(999)
    expect(signal.aborted).toBe(false)
    vi.advanceTimersByTime(1)
    expect(signal.aborted).toBe(true)
    expect(() => cancel()).not.toThrow()
  })
})

describe("abortAfter fallback (no AbortSignal.timeout, Safari 15 and older)", () => {
  beforeEach(removeNativeTimeout)

  it("aborts after ms with a TimeoutError reason", () => {
    expect(typeof AbortSignal.timeout).not.toBe("function")
    const { signal } = abortAfter(1000)
    expect(signal.aborted).toBe(false)
    vi.advanceTimersByTime(999)
    expect(signal.aborted).toBe(false)
    vi.advanceTimersByTime(1)
    expect(signal.aborted).toBe(true)
    expect((signal.reason as DOMException).name).toBe("TimeoutError")
  })

  it("cancel before ms prevents the abort and leaves no timer", () => {
    const { signal, cancel } = abortAfter(1000)
    expect(vi.getTimerCount()).toBe(1)
    cancel()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(5000)
    expect(signal.aborted).toBe(false)
  })

  it("cancel twice is safe", () => {
    const { cancel } = abortAfter(1000)
    cancel()
    expect(() => cancel()).not.toThrow()
  })

  it("ms 0 aborts on the next tick", () => {
    const { signal } = abortAfter(0)
    vi.advanceTimersByTime(0)
    expect(signal.aborted).toBe(true)
  })
})
