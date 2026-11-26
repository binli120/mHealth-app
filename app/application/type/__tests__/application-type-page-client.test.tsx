// @vitest-environment jsdom
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  push: vi.fn(),
  dispatch: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, back: vi.fn() }) }))
vi.mock("@/lib/redux/hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: () => "en",
}))
vi.mock("@/components/shared/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }))

import ApplicationTypePage from "@/app/application/type/application-type-page-client"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"

const FIRST = MASSHEALTH_APPLICATION_TYPES[0]
const nativeTimeout = AbortSignal.timeout

function json(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

describe("ApplicationTypePage on a browser without AbortSignal.timeout (Safari 15)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true, writable: true })
  })
  afterEach(() => {
    Object.defineProperty(AbortSignal, "timeout", { value: nativeTimeout, configurable: true, writable: true })
    cleanup()
  })

  it("still runs the existing-draft check and the create POST, each with an abort signal", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) =>
      init?.method === "POST" ? json({ ok: true }) : json({ ok: true, records: [] }),
    )
    render(<ApplicationTypePage />)
    await userEvent.click(screen.getByRole("heading", { name: FIRST.shortLabel }))

    await waitFor(() => expect(mocks.push).toHaveBeenCalled())
    const calls = mocks.authenticatedFetch.mock.calls
    expect(calls.map(([url, init]) => `${(init as { method: string }).method} ${url}`)).toEqual([
      "GET /api/applications?status=draft",
      "POST /api/applications",
    ])
    for (const [, init] of calls) expect((init as { signal?: AbortSignal }).signal).toBeInstanceOf(AbortSignal)
  })

  it("offers to continue an existing draft found by the check", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      json({ ok: true, records: [{ id: "draft-1", applicationType: FIRST.id }] }),
    )
    render(<ApplicationTypePage />)
    await userEvent.click(screen.getByRole("heading", { name: FIRST.shortLabel }))

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument())
    expect(mocks.authenticatedFetch).toHaveBeenCalledTimes(1)
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
