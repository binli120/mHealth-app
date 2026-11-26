// @vitest-environment jsdom
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }))
vi.mock("@/lib/redux/hooks", () => ({ useAppSelector: () => "en" }))

import StatusListPage from "@/app/customer/status/page"

const nativeTimeout = AbortSignal.timeout

describe("StatusListPage on a browser without AbortSignal.timeout (Safari 15)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true, writable: true })
  })
  afterEach(() => {
    Object.defineProperty(AbortSignal, "timeout", { value: nativeTimeout, configurable: true, writable: true })
    cleanup()
  })

  it("loads the application list, sending an abort signal", async () => {
    mocks.authenticatedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        records: [
          {
            id: "app-77",
            status: "submitted",
            applicationType: "saca2",
            draftStep: null,
            lastSavedAt: null,
            submittedAt: "2026-10-01T00:00:00Z",
            createdAt: "2026-09-01T00:00:00Z",
            updatedAt: "2026-10-01T00:00:00Z",
            applicantName: "Ada Lovelace",
            householdSize: 1,
            phiDraftLocked: false,
            needsCustomerReview: false,
            swLastModifiedAt: null,
          },
        ],
      }),
    })
    const { container } = render(<StatusListPage />)

    await waitFor(() => expect(container.querySelector('a[href="/customer/status/app-77"]')).not.toBeNull())
    const [url, init] = mocks.authenticatedFetch.mock.calls[0]
    expect(url).toContain("/api/applications?")
    expect((init as { signal?: AbortSignal }).signal).toBeInstanceOf(AbortSignal)
  })
})
