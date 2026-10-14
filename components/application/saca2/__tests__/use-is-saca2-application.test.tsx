/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch,
}))

import { useIsSaca2Application } from "@/components/application/saca2/use-is-saca2-application"

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response
}

describe("useIsSaca2Application", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("answers from Redux without fetching when the type is known", () => {
    const { result } = renderHook(() => useIsSaca2Application("app-1", "saca2"))
    expect(result.current).toBe("saca2")
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled()

    const other = renderHook(() => useIsSaca2Application("app-2", "aca3"))
    expect(other.result.current).toBe("other")
  })

  it("returns other immediately when there is no application id (new application)", () => {
    const { result } = renderHook(() => useIsSaca2Application(undefined, ""))
    expect(result.current).toBe("other")
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled()
  })

  it("looks the type up from the server draft after a reload (Redux empty)", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, record: { applicationType: "saca2" } }),
    )
    const { result } = renderHook(() => useIsSaca2Application("app-3", ""))
    expect(result.current).toBe("unknown")
    await waitFor(() => expect(result.current).toBe("saca2"))
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/applications/app-3/draft",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("forwards the acting-for-patient header for social workers", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, record: { applicationType: "aca3" } }),
    )
    const { result } = renderHook(() => useIsSaca2Application("app-4", "", "patient-9"))
    await waitFor(() => expect(result.current).toBe("other"))
    const init = mocks.authenticatedFetch.mock.calls[0][1] as { headers?: Record<string, string> }
    expect(init.headers?.["X-Acting-For-Patient"]).toBe("patient-9")
  })

  it("falls back to other when the lookup fails or the draft has no type", async () => {
    mocks.authenticatedFetch.mockRejectedValueOnce(new Error("network"))
    const failed = renderHook(() => useIsSaca2Application("app-5", ""))
    await waitFor(() => expect(failed.result.current).toBe("other"))

    mocks.authenticatedFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, record: { applicationType: null } }),
    )
    const untyped = renderHook(() => useIsSaca2Application("app-6", ""))
    await waitFor(() => expect(untyped.result.current).toBe("other"))
  })
})
