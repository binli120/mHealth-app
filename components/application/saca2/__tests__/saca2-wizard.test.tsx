/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  restorePhiDraftState: vi.fn(),
  push: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({ authenticatedFetch: mocks.authenticatedFetch }))
vi.mock("@/lib/phi-token/restore", () => ({ restorePhiDraftState: mocks.restorePhiDraftState }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, back: vi.fn() }) }))
vi.mock("@/components/application/phi-save-exit-dialog", () => ({
  PhiSaveExitDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="save-exit-dialog" /> : null),
  PhiResumePrompt: ({ onSkip, onRestored }: { onSkip: () => void; onRestored: (s: Record<string, unknown>) => void }) => (
    <div data-testid="resume-prompt">
      <button type="button" onClick={onSkip}>skip-resume</button>
      <button
        type="button"
        onClick={() =>
          onRestored({
            schemaVersion: "saca2-2026-08",
            currentStepId: "person1",
            data: { persons: [{ firstName: "Restored" }] },
          })
        }
      >
        restore-resume
      </button>
      <button type="button" onClick={() => onRestored({ currentStepId: "person1", data: { persons: [{ firstName: "Bare" }] } })}>
        restore-resume-bare
      </button>
      <button type="button" onClick={() => onRestored({ data: "x" })}>
        restore-resume-bad
      </button>
    </div>
  ),
}))

import { Saca2Wizard } from "@/components/application/saca2/saca2-wizard"
import { getSyntheticCase } from "@/lib/masshealth/saca2/synthetic-cases"

const APP_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function draftGet(body: unknown) {
  return ok(body)
}

function putBodies(): Array<{ wizardState: Record<string, unknown>; applicationType: string }> {
  return mocks.authenticatedFetch.mock.calls
    .filter(([, init]) => (init as { method?: string } | undefined)?.method === "PUT")
    .map(([, init]) => JSON.parse(String((init as { body: string }).body)))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
    if (init?.method === "PUT") return ok({ ok: true })
    return draftGet({ ok: false })
  })
})

describe("Saca2Wizard: navigation and validation", () => {
  it("starts on the programs step and blocks Next until a program is chosen", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("saca2-wizard")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/select at least one program/i)
    expect(screen.getByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText(/MassHealth or the Health Safety Net/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("heading", { name: "About you" })).toBeInTheDocument()
  })

  it("goes Back without validating", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await screen.findByLabelText(/MassHealth or the Health Safety Net/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await screen.findByRole("heading", { name: "About you" })
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()
  })

  it("opens Save & Exit from the header action", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("saca2-wizard")
    await userEvent.click(screen.getAllByRole("button", { name: /save (&|and) exit/i })[0])
    expect(await screen.findByTestId("save-exit-dialog")).toBeInTheDocument()
  })
})

describe("Saca2Wizard: PHI-safe autosave", () => {
  // Real timers: autosave debounces for 700 ms, so these tests wait on the clock.
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  it("never sends typed PHI or PHI keys to the server draft", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await screen.findByLabelText(/Long-term care \(nursing home/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await screen.findByRole("heading", { name: "About you" })
    await userEvent.type(screen.getByLabelText("First name"), "Ada")

    await waitFor(() => expect(putBodies().length).toBeGreaterThan(0), { timeout: 3_000 })
    await sleep(900)

    for (const body of putBodies()) {
      const raw = JSON.stringify(body)
      expect(raw).not.toMatch(/Ada/)
      expect(body.applicationType).toBe("saca2")
      const data = (body.wizardState as { data: Record<string, unknown> }).data
      for (const phiKey of ["persons", "assets", "screening", "aian", "health", "pca", "supplements", "transfers", "previousMedicalBills"]) {
        expect(data).not.toHaveProperty(phiKey)
      }
      const step = body.wizardState.currentStep as number
      expect(Number.isInteger(step) && step >= 1 && step <= 9).toBe(true)
    }
    const last = putBodies().at(-1)!
    expect((last.wizardState.data as { intake: { programs: { longTermCare: boolean } } }).intake.programs.longTermCare).toBe(true)
  })

  it("does not re-send an unchanged PHI-free snapshot when only PHI fields change", async () => {
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await screen.findByLabelText(/Long-term care \(nursing home/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await screen.findByRole("heading", { name: "About you" })
    await waitFor(() => expect(putBodies().length).toBeGreaterThan(0), { timeout: 3_000 })
    await sleep(900)

    const before = putBodies().length
    await userEvent.type(screen.getByLabelText("First name"), "Ada")
    await sleep(1_200)
    expect(putBodies().length).toBe(before)
  })
})

describe("Saca2Wizard: hydration and PHI resume", () => {
  it("resumes the saved step from a PHI-free server draft", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: null, phiDraftKeyEnc: null },
        draftState: {
          schemaVersion: "saca2-2026-08",
          currentStepId: "aian",
          furthestStepNumber: 4,
          completedSteps: ["intake"],
          data: { intake: { programs: { longTermCare: true } } },
        },
      })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByRole("heading", { name: "American Indian or Alaska Native household members" })).toBeInTheDocument()
  })

  it("shows the resume prompt when a PHI blob exists and no server key is held", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: "11111111-1111-4111-8111-111111111111", phiDraftKeyEnc: null },
        draftState: { schemaVersion: "saca2-2026-08", currentStepId: "person1", data: {} },
      })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("resume-prompt")).toBeInTheDocument()
    expect(mocks.restorePhiDraftState).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "restore-resume" }))
    expect(await screen.findByDisplayValue("Restored")).toBeInTheDocument()
    expect(screen.queryByTestId("resume-prompt")).not.toBeInTheDocument()
  })

  it("auto-restores PHI when the server holds the key, and falls back to the prompt if that fails", async () => {
    const withKey = async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: "11111111-1111-4111-8111-111111111111", phiDraftKeyEnc: "enc" },
        draftState: { schemaVersion: "saca2-2026-08", currentStepId: "person1", data: {} },
      })
    }
    mocks.authenticatedFetch.mockImplementation(withKey)
    mocks.restorePhiDraftState.mockResolvedValueOnce({
      schemaVersion: "saca2-2026-08",
      currentStepId: "person1",
      data: { persons: [{ firstName: "Auto" }] },
    })
    const first = render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByDisplayValue("Auto")).toBeInTheDocument()
    first.unmount()

    mocks.restorePhiDraftState.mockRejectedValueOnce(new Error("key unavailable"))
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("resume-prompt")).toBeInTheDocument()
  })

  it("starts a fresh form when the draft request fails or the draft is from another schema version", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      throw new Error("offline")
    })
    const failed = render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()
    failed.unmount()

    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({ ok: true, record: {}, draftState: { schemaVersion: "old", data: {} } })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()
  })

  it("sends the acting-for-patient header on the draft request", async () => {
    render(<Saca2Wizard applicationId={APP_ID} actingForPatientId="patient-9" />)
    await screen.findByTestId("saca2-wizard")
    const get = mocks.authenticatedFetch.mock.calls.find(([, init]) => (init as { method?: string }).method === "GET")
    expect((get?.[1] as { headers?: Record<string, string> }).headers?.["X-Acting-For-Patient"]).toBe("patient-9")
  })
})

describe("Saca2Wizard: fix round 1", () => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  it("serializes autosaves and sends newer edits made while a PUT is in flight", async () => {
    let inFlight = 0
    let maxInFlight = 0
    const releases: Array<() => void> = []
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise<void>((resolve) => releases.push(resolve))
        inFlight -= 1
        return ok({ ok: true })
      }
      return draftGet({ ok: false })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await userEvent.click(await screen.findByLabelText(/Long-term care \(nursing home/i))
    await waitFor(() => expect(putBodies().length).toBe(1), { timeout: 3_000 })
    // Edit while the first PUT is in flight.
    await userEvent.click(screen.getByLabelText(/MassHealth or the Health Safety Net/i))
    await sleep(1_000)
    expect(putBodies().length).toBe(1)
    releases.shift()!()
    await waitFor(() => expect(putBodies().length).toBe(2), { timeout: 3_000 })
    releases.shift()!()
    await sleep(300)
    const last = putBodies().at(-1)!
    const programs = (last.wizardState.data as { intake: { programs: Record<string, boolean> } }).intake.programs
    expect(programs.longTermCare).toBe(true)
    expect(Object.values(programs).filter(Boolean).length).toBe(2)
    expect(maxInFlight).toBe(1)
  })

  it("moves a hidden saved step to the nearest visible one", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: null, phiDraftKeyEnc: null },
        draftState: {
          schemaVersion: "saca2-2026-08",
          currentStepId: "person2",
          data: { intake: { programs: { longTermCare: true } } },
        },
      })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByRole("heading", { name: "About you" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: /Person 2/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByRole("heading", { name: "What are you applying for?" })).toBeInTheDocument()
  })

  const emptyDraftWithKey = async (_url: string, init?: { method?: string }) => {
    if (init?.method === "PUT") return ok({ ok: true })
    return draftGet({
      ok: true,
      record: { phiDraftResumeId: "11111111-1111-4111-8111-111111111111", phiDraftKeyEnc: "enc" },
      draftState: null,
    })
  }

  it("auto-restores PHI into an empty server draft (no schemaVersion in the blob)", async () => {
    mocks.authenticatedFetch.mockImplementation(emptyDraftWithKey)
    mocks.restorePhiDraftState.mockResolvedValueOnce({ data: { persons: [{ firstName: "Auto" }] } })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await waitFor(() => expect(screen.getByTestId("saca2-wizard")).toBeInTheDocument())
    expect(screen.queryByTestId("resume-prompt")).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText(/MassHealth or the Health Safety Net/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByDisplayValue("Auto")).toBeInTheDocument()
  })

  it("restores via the prompt even when the payload lacks a schemaVersion", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: "11111111-1111-4111-8111-111111111111", phiDraftKeyEnc: null },
        draftState: null,
      })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    await userEvent.click(screen.getByRole("button", { name: "restore-resume-bare" }))
    expect(await screen.findByDisplayValue("Bare")).toBeInTheDocument()
  })

  it("keeps the prompt with an alert when restored data cannot be normalized", async () => {
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: "11111111-1111-4111-8111-111111111111", phiDraftKeyEnc: null },
        draftState: null,
      })
    })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    await userEvent.click(screen.getByRole("button", { name: "restore-resume-bad" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't restore your saved details/i)
    expect(screen.getByTestId("resume-prompt")).toBeInTheDocument()
  })

  it("falls back to the prompt when auto-restored data cannot be normalized", async () => {
    mocks.authenticatedFetch.mockImplementation(emptyDraftWithKey)
    mocks.restorePhiDraftState.mockResolvedValueOnce({ data: "x" })
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("resume-prompt")).toBeInTheDocument()
  })
})

describe("Saca2Wizard: married to not married", () => {
  it("drops the Person 2 step when the marital answer is changed back to No", async () => {
    const person1 = {
      ...getSyntheticCase("couple-spouse-in-nursing-facility").answers.persons[0],
      isLegallyMarried: null,
      sexAtBirth: "male" as const,
      streetAddress: "1 Example Way",
      city: "Boston",
      zip: "02108",
      inInstitution: "no" as const,
      mobilePhone: "6175550100",
      hasSsn: "no" as const,
      noSsnReason: "justApplied" as const,
      naturalizedCitizen: "no" as const,
      hasDisability: "no" as const,
      everGotSsi: "no" as const,
      hasMedicareOrSsiOrSsdi: "no" as const,
      pregnant: "no" as const,
      everInFosterCare: "no" as const,
      rentOrOwn: "rent" as const,
      needsAccommodation: "no" as const,
      hasIncome: "no" as const,
      income: [],
      // The next-year one-time income and deductions questions are asked of every person.
      oneTimeIncome: { thisYear: null, thisYearItems: [], nextYear: "no" as const, nextYearItems: [] },
      deductions: { ...getSyntheticCase("couple-spouse-in-nursing-facility").answers.persons[0].deductions, none: true },
      // Person 1 is applying, so the Next click now validates the tax questions too.
      tax: {
        ...getSyntheticCase("couple-spouse-in-nursing-facility").answers.persons[0].tax,
        agreesToFileIfAptc: "no" as const,
        claimedAsDependent: "no" as const,
        filingSeparatelyAbuse: "no" as const,
      },
    }
    mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return ok({ ok: true })
      return draftGet({
        ok: true,
        record: { phiDraftResumeId: "11111111-1111-4111-8111-111111111111", phiDraftKeyEnc: "enc" },
        draftState: null,
      })
    })
    mocks.restorePhiDraftState.mockResolvedValueOnce({ data: { persons: [person1] } })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await waitFor(() => expect(screen.getByTestId("saca2-wizard")).toBeInTheDocument())
    await userEvent.click(screen.getByLabelText(/MassHealth or the Health Safety Net/i))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await screen.findByRole("heading", { name: "About you" })

    const marriedGroup = () => screen.getByRole("group", { name: /Are you legally married/i })
    await userEvent.click(within(marriedGroup()).getByLabelText("Yes"))
    expect(screen.getAllByText("Person 2 information").length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("heading", { name: "About this person" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    await screen.findByRole("heading", { name: "About you" })
    await userEvent.click(within(marriedGroup()).getByLabelText("No"))
    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    expect(screen.queryByRole("heading", { name: "About this person" })).not.toBeInTheDocument()
    expect(screen.queryByText("Person 2 information")).not.toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: /American Indian|Alaska Native/i })).toBeInTheDocument()
  })
})
