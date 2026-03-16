import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useStepWizard } from "@/hooks/use-step-wizard"

describe("hooks/use-step-wizard", () => {
  it("starts at step 0 by default", () => {
    const { result } = renderHook(() => useStepWizard(5))
    expect(result.current.step).toBe(0)
    expect(result.current.isFirst).toBe(true)
    expect(result.current.isLast).toBe(false)
  })

  it("respects a custom initialStep", () => {
    const { result } = renderHook(() => useStepWizard(5, 2))
    expect(result.current.step).toBe(2)
    expect(result.current.isFirst).toBe(false)
    expect(result.current.isLast).toBe(false)
  })

  it("goNext advances the step", () => {
    const { result } = renderHook(() => useStepWizard(5))
    act(() => result.current.goNext())
    expect(result.current.step).toBe(1)
  })

  it("goPrev decrements the step", () => {
    const { result } = renderHook(() => useStepWizard(5, 3))
    act(() => result.current.goPrev())
    expect(result.current.step).toBe(2)
  })

  it("goNext does not exceed the last step", () => {
    const { result } = renderHook(() => useStepWizard(3, 2))
    act(() => result.current.goNext())
    expect(result.current.step).toBe(2)
    expect(result.current.isLast).toBe(true)
  })

  it("goPrev does not go below 0", () => {
    const { result } = renderHook(() => useStepWizard(3, 0))
    act(() => result.current.goPrev())
    expect(result.current.step).toBe(0)
    expect(result.current.isFirst).toBe(true)
  })

  it("goTo jumps to any valid step", () => {
    const { result } = renderHook(() => useStepWizard(5))
    act(() => result.current.goTo(4))
    expect(result.current.step).toBe(4)
    expect(result.current.isLast).toBe(true)
  })

  it("goTo clamps to 0 for negative indices", () => {
    const { result } = renderHook(() => useStepWizard(5))
    act(() => result.current.goTo(-3))
    expect(result.current.step).toBe(0)
  })

  it("goTo clamps to the last step for out-of-range indices", () => {
    const { result } = renderHook(() => useStepWizard(5))
    act(() => result.current.goTo(99))
    expect(result.current.step).toBe(4)
  })

  it("isFirst is true only on step 0", () => {
    const { result } = renderHook(() => useStepWizard(3))
    expect(result.current.isFirst).toBe(true)
    act(() => result.current.goNext())
    expect(result.current.isFirst).toBe(false)
  })

  it("isLast is true only on the final step", () => {
    const { result } = renderHook(() => useStepWizard(2))
    expect(result.current.isLast).toBe(false)
    act(() => result.current.goNext())
    expect(result.current.isLast).toBe(true)
  })
})
