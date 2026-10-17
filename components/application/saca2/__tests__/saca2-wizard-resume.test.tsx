/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, waitFor } from "@testing-library/react"
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
      {/* Relies on normalizeRestoredSaca2State rejecting { data: "x" }. */}
      <button type="button" onClick={() => onRestored({ data: "x" })}>
        restore-resume-bad
      </button>
    </div>
  ),
}))

import { STEP_TITLES } from "@/lib/masshealth/saca2/questions"
import { Saca2Wizard } from "@/components/application/saca2/saca2-wizard"

const APP_ID = "88cbe518-ea42-476b-a8e9-12207573ff2c"
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function putCalls() {
  return mocks.authenticatedFetch.mock.calls.filter(
    ([, init]) => (init as { method?: string } | undefined)?.method === "PUT",
  )
}

// A PHI blob exists, no server key is held: the wizard must wait on the resume prompt.
function pendingDraft(draftState: unknown) {
  mocks.authenticatedFetch.mockImplementation(async (_url: string, init?: { method?: string }) => {
    if (init?.method === "PUT") return ok({ ok: true })
    return ok({
      ok: true,
      record: { phiDraftResumeId: "11111111-1111-4111-8111-111111111111", phiDraftKeyEnc: null },
      draftState,
    })
  })
}

const SERVER_STATE = {
  schemaVersion: "saca2-2026-08",
  currentStepId: "person1",
  data: { intake: { programs: { longTermCare: true } } },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Saca2Wizard: blocking resume prompt", () => {
  it("shows the prompt instead of the step form, nav row and save status while a resume is pending", async () => {
    pendingDraft(SERVER_STATE)
    render(<Saca2Wizard applicationId={APP_ID} />)
    expect(await screen.findByTestId("resume-prompt")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "About you" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument()
    expect(screen.queryByText(/changes saved|saving/i)).not.toBeInTheDocument()
    // The step list sidebar stays.
    expect(screen.getAllByText(STEP_TITLES.intake).length).toBeGreaterThan(0)
  })

  it("renders no step-form inputs while pending, so nothing can be typed", async () => {
    pendingDraft(SERVER_STATE)
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    expect(screen.queryAllByRole("textbox")).toHaveLength(0)
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument()
  })

  it("shows the form with the restored values after onRestored with a valid state", async () => {
    pendingDraft(SERVER_STATE)
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    await userEvent.click(screen.getByRole("button", { name: "restore-resume" }))
    expect(await screen.findByDisplayValue("Restored")).toBeInTheDocument()
    expect(screen.queryByTestId("resume-prompt")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument()
  })

  it("shows the form with the server (PHI-free) state after skip", async () => {
    pendingDraft({ ...SERVER_STATE, currentStepId: "aian" })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    await userEvent.click(screen.getByRole("button", { name: "skip-resume" }))
    expect(
      await screen.findByRole("heading", { name: "American Indian or Alaska Native household members" }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("resume-prompt")).not.toBeInTheDocument()
  })

  it("keeps the prompt and the alert, with the form still hidden, when the restored payload is invalid", async () => {
    pendingDraft(SERVER_STATE)
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    await userEvent.click(screen.getByRole("button", { name: "restore-resume-bad" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't restore your saved details/i)
    expect(screen.getByTestId("resume-prompt")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "About you" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument()
  })

  it("clears the restore alert when the user skips after an invalid restore", async () => {
    pendingDraft({ ...SERVER_STATE, currentStepId: "aian" })
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    await userEvent.click(screen.getByRole("button", { name: "restore-resume-bad" }))
    await screen.findByRole("alert")
    await userEvent.click(screen.getByRole("button", { name: "skip-resume" }))
    expect(
      await screen.findByRole("heading", { name: "American Indian or Alaska Native household members" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it.each([
    [undefined, "/customer/dashboard"],
    ["patient-9", "/social-worker/patients/patient-9/applications"],
  ])("header Save & Exit only exits (acting for %s) while a resume is pending", async (patient, href) => {
    pendingDraft(SERVER_STATE)
    render(<Saca2Wizard applicationId={APP_ID} actingForPatientId={patient} />)
    await screen.findByTestId("resume-prompt")
    await userEvent.click(screen.getByRole("button", { name: /save (&|and) exit/i }))
    expect(mocks.push).toHaveBeenCalledWith(href)
    expect(screen.queryByTestId("save-exit-dialog")).not.toBeInTheDocument()
  })

  it("sends no autosave PUT while the prompt is pending", async () => {
    pendingDraft(SERVER_STATE)
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    await sleep(1_200)
    expect(putCalls()).toHaveLength(0)
  })
})

describe("Saca2Wizard: no autosave or step normalising under the resume prompt", () => {
  // person2 is only visible when PHI (Person 1 married) is known, so the PHI-free server state hides it.
  const PHI_GATED = { ...SERVER_STATE, currentStepId: "person2", furthestStepNumber: 3, currentStep: 3 }

  it("sends no PUT while the prompt is open even though the saved step is hidden without PHI", async () => {
    pendingDraft(PHI_GATED)
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    await sleep(1_500)
    expect(putCalls()).toHaveLength(0)
  })

  it("normalises the step after Skip as before (and only then autosaves)", async () => {
    pendingDraft(PHI_GATED)
    render(<Saca2Wizard applicationId={APP_ID} />)
    await screen.findByTestId("resume-prompt")
    await sleep(900)
    expect(putCalls()).toHaveLength(0)
    await userEvent.click(screen.getByRole("button", { name: "skip-resume" }))
    expect(await screen.findByRole("heading", { name: "About you" })).toBeInTheDocument()
    await waitFor(() => expect(putCalls()).toHaveLength(1), { timeout: 3_000 })
    const body = JSON.parse((putCalls()[0][1] as { body: string }).body)
    expect(body.wizardState.currentStepId).toBe("person1")
  })
})
