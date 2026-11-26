/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  push: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }))
vi.mock("@/lib/phi-token/restore", () => ({ restorePhiDraftState: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, back: vi.fn() }) }))
vi.mock("@/components/application/phi-save-exit-dialog", () => ({
  PhiSaveExitDialog: () => null,
  PhiResumePrompt: () => null,
}))

import { Saca2Wizard } from "@/components/application/saca2/saca2-wizard"

const APP_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"

function response(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

function putCalls() {
  return mocks.authenticatedFetch.mock.calls.filter(
    ([, init]) => (init as { method?: string } | undefined)?.method === "PUT",
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Saca2Wizard: draft load failures", () => {
  it("opens a fresh form when the draft does not exist yet (404)", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) =>
      init?.method === "PUT" ? response(200, { ok: true }) : response(404, { ok: false }),
    )
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("saca2-wizard")).toBeInTheDocument()
    expect(screen.queryByTestId("saca2-load-error")).not.toBeInTheDocument()
  })

  it.each([500, 503, 401])("blocks editing with a retry when the draft GET returns %i", async (status) => {
    mocks.authenticatedFetch.mockImplementation(async () => response(status, { ok: false }))
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("saca2-load-error")).toBeInTheDocument()
    expect(screen.queryByTestId("saca2-wizard")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save & Exit" })).not.toBeInTheDocument()
    expect(putCalls()).toHaveLength(0)
  })

  it("blocks editing when the draft GET throws, and never saves over the draft", async () => {
    mocks.authenticatedFetch.mockRejectedValue(new Error("network"))
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("saca2-load-error")).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(putCalls()).toHaveLength(0)
  })

  it("loads the draft after Try again succeeds", async () => {
    let calls = 0
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return response(200, { ok: true })
      calls += 1
      return calls === 1 ? response(500, { ok: false }) : response(404, { ok: false })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }))
    await waitFor(() => expect(screen.getByTestId("saca2-wizard")).toBeInTheDocument())
    expect(screen.queryByTestId("saca2-load-error")).not.toBeInTheDocument()
  })
})
