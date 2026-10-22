/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  push: vi.fn(),
  beforeSecureSave: null as null | (() => Promise<boolean | { ok: boolean; warning?: string }>),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }))
vi.mock("@/lib/phi-token/restore", () => ({ restorePhiDraftState: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, back: vi.fn() }) }))
vi.mock("@/components/application/phi-save-exit-dialog", () => ({
  // Capture the prop the wizard hands the dialog so the tests can call it exactly as the dialog does.
  PhiSaveExitDialog: ({ onBeforeSecureSave }: { onBeforeSecureSave?: () => Promise<boolean | { ok: boolean; warning?: string }> }) => {
    mocks.beforeSecureSave = onBeforeSecureSave ?? null
    return null
  },
  PhiResumePrompt: () => null,
}))

import { Saca2Wizard } from "@/components/application/saca2/saca2-wizard"

const APP_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function res(status: number): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) } as unknown as Response
}

function putCount(): number {
  return mocks.authenticatedFetch.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === "PUT").length
}

/** Route GET to "no draft" and PUT through the given handler. */
function onPut(handler: () => Promise<Response> | Response) {
  mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
    if (init?.method === "PUT") return handler()
    return res(404)
  })
}

const ltc = () => screen.findByLabelText(/Long-term care \(nursing home/i)
const medicaid = () => screen.getByLabelText(/MassHealth or the Health Safety Net/i)

async function firstEdit() {
  await userEvent.click(await ltc())
  await waitFor(() => expect(putCount()).toBe(1), { timeout: 3_000 })
}

async function secureSave() {
  let result: Awaited<ReturnType<NonNullable<typeof mocks.beforeSecureSave>>> | undefined
  await act(async () => {
    result = await mocks.beforeSecureSave!()
  })
  return result!
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.beforeSecureSave = null
})

describe("Saca2Wizard: autosave status line", () => {
  it("reads Saving… while the PUT is pending and All changes saved once it resolves", async () => {
    let release!: () => void
    onPut(() => new Promise<Response>((resolve) => { release = () => resolve(res(200)) }))
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await ltc())
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saving…"), { timeout: 3_000 })
    release()
    // Every answer edit (the intake click included) leaves phiDirty set until Save & Exit, so this is the
    // "not secured yet" copy; the plain "All changes saved" line is pinned in saca2-save-status.test.tsx.
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Progress saved. Your answers are not secured yet"))
  })

  it("shows the error with Retry on a 500 and Retry sends at once inside the backoff window", async () => {
    let calls = 0
    onPut(() => res(++calls === 1 ? 500 : 200))
    render(<Saca2Wizard applicationId={APP_ID} />)
    await firstEdit()
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't save your changes"))

    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(putCount()).toBe(2))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Progress saved. Your answers are not secured yet"))
  })

  it("does not claim All changes saved when a newer edit landed while the PUT was in flight", async () => {
    let release!: () => void
    let calls = 0
    onPut(() => {
      calls += 1
      if (calls === 1) return new Promise<Response>((resolve) => { release = () => resolve(res(200)) })
      return new Promise<Response>(() => {}) // later saves never finish
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await ltc())
    await waitFor(() => expect(putCount()).toBe(1), { timeout: 3_000 })
    await userEvent.click(medicaid())
    release()
    await sleep(100)
    expect(screen.getByRole("status")).not.toHaveTextContent("All changes saved")
  })
})

describe("Saca2Wizard: PHI-only edits are not reported as fully saved", () => {
  it("shows the not-secured line after a PHI-only edit saves, never All changes saved", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return res(200)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          record: {},
          draftState: { schemaVersion: "saca2-2026-08", currentStepId: "person1", data: {} },
        }),
      } as unknown as Response
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.type(await screen.findByLabelText("First name"), "Ada")
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("not secured yet"), { timeout: 3_000 })
    expect(screen.getByRole("status")).not.toHaveTextContent("All changes saved")
  })
})

describe("Saca2Wizard: autosave backoff", () => {
  it("does not send a second autosave inside the backoff after a 500, and keeps the error", async () => {
    onPut(() => res(500))
    render(<Saca2Wizard applicationId={APP_ID} />)
    await firstEdit()
    await userEvent.click(medicaid())
    await sleep(1_200)
    expect(putCount()).toBe(1)
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't save your changes")
  })

  it.each([400, 403])("a %i autosave failure sets the error WITHOUT starting the backoff", async (status) => {
    onPut(() => res(status))
    render(<Saca2Wizard applicationId={APP_ID} />)
    await firstEdit()
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't save your changes"))
    await userEvent.click(medicaid())
    await waitFor(() => expect(putCount()).toBe(2), { timeout: 3_000 })
  })

  it.each([
    ["500", () => res(500)],
    ["429", () => res(429)],
    ["network error", () => { throw new Error("offline") }],
  ])("a %s autosave failure starts the backoff", async (_name, handler) => {
    onPut(handler as () => Response)
    render(<Saca2Wizard applicationId={APP_ID} />)
    await firstEdit()
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't save your changes"))
    await userEvent.click(medicaid())
    await sleep(1_200)
    expect(putCount()).toBe(1)
  })
})

describe("Saca2Wizard: Save & Exit is not trapped by the autosave", () => {
  async function inBackoff() {
    let calls = 0
    onPut(() => res(++calls === 1 ? 500 : 200))
    render(<Saca2Wizard applicationId={APP_ID} />)
    await firstEdit()
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't save your changes"))
    return () => calls
  }

  it("makes one forced PUT despite the backoff, then lets the secure save proceed", async () => {
    await inBackoff()
    // The unchanged PHI-free snapshot would be skipped, so change it first.
    await userEvent.click(medicaid())
    const before = putCount()
    expect(await secureSave()).toBe(true)
    expect(putCount()).toBe(before + 1)
  })

  it.each([400, 403, 409, 413, 422])("a %i on the forced PUT does not block the secure save, warns, and shows the error", async (status) => {
    onPut(() => res(500))
    render(<Saca2Wizard applicationId={APP_ID} />)
    await firstEdit()
    onPut(() => res(status))
    await userEvent.click(medicaid())
    expect(await secureSave()).toEqual({
      ok: true,
      warning: expect.stringMatching(/programs you selected and which steps you have completed.*may revert when you resume/),
    })
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't save your changes")
  })

  it.each([
    ["500", () => res(500)],
    ["429", () => res(429)],
    ["network error", () => { throw new Error("offline") }],
  ])("a %s on the forced PUT blocks the secure save", async (_name, handler) => {
    onPut(() => res(500))
    render(<Saca2Wizard applicationId={APP_ID} />)
    await firstEdit()
    onPut(handler as () => Response)
    await userEvent.click(medicaid())
    const result = await secureSave()
    expect(typeof result === "boolean" ? result : result.ok).toBe(false)
  })
})

describe("Saca2Wizard: no overlapping saves", () => {
  it("never has two PUTs in flight across rapid edits and a Retry", async () => {
    let inFlight = 0
    let maxInFlight = 0
    let calls = 0
    onPut(async () => {
      calls += 1
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await sleep(60)
      inFlight -= 1
      return res(calls === 1 ? 500 : 200)
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await ltc())
    const retry = await screen.findByRole("button", { name: "Retry" }, { timeout: 3_000 })
    await userEvent.click(medicaid())
    // Two Retry clicks in the same tick, on top of the pending edit.
    act(() => {
      retry.click()
      retry.click()
    })
    await sleep(1_500)
    expect(putCount()).toBeGreaterThanOrEqual(2)
    expect(maxInFlight).toBe(1)
  })
})
