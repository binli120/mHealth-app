/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useField } from "@/hooks/use-field"

function createStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

describe("hooks/use-field", () => {
  const localStorageMock = createStorageMock()

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
    writable: true,
  })

  afterEach(() => {
    localStorageMock.clear()
    vi.restoreAllMocks()
  })

  it("returns valid when all validators pass", () => {
    const { result } = renderHook(() =>
      useField({
        value: "MassHealth",
        validators: [
          (value) => (value.trim() ? null : "Required"),
          (value) => (value.length >= 3 ? null : "Too short"),
        ],
      }),
    )

    expect(result.current.isValid).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it("returns first validator error", () => {
    const { result } = renderHook(() =>
      useField({
        value: "",
        validators: [
          (value) => (value.trim() ? null : "Required"),
          () => "Second error",
        ],
      }),
    )

    expect(result.current.isValid).toBe(false)
    expect(result.current.error).toBe("Required")
  })

  it("stores values in localStorage when cacheKey is provided", async () => {
    renderHook(() =>
      useField({
        value: "MassHealth",
        validators: [],
        cacheKey: "test:field",
      }),
    )

    await waitFor(() => {
      expect(window.localStorage.getItem("test:field")).toBe("MassHealth")
    })
  })

  it("hydrates cached value once through onHydrate", async () => {
    window.localStorage.setItem("test:hydration", "from-cache")
    const onHydrate = vi.fn()

    renderHook(() =>
      useField({
        value: "",
        validators: [],
        cacheKey: "test:hydration",
        onHydrate,
      }),
    )

    await waitFor(() => {
      expect(onHydrate).toHaveBeenCalledTimes(1)
    })
    expect(onHydrate).toHaveBeenCalledWith("from-cache")
  })
})
