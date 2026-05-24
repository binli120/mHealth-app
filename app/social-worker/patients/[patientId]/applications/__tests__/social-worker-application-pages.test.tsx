/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  applicationAssistant: vi.fn(() => <div data-testid="application-assistant" />),
  formWizard: vi.fn(() => <div data-testid="form-wizard" />),
  intakeChat: vi.fn(() => <div data-testid="intake-chat" />),
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}))

vi.mock("next/navigation", () => ({
  useParams: mocks.useParams,
  useRouter: mocks.useRouter,
}))

vi.mock("@/components/application/aca3/application-assistant", () => ({
  ApplicationAssistant: mocks.applicationAssistant,
}))

vi.mock("@/components/application/aca3/intake-chat", () => ({
  IntakeChat: mocks.intakeChat,
}))

vi.mock("@/components/application/aca3/form-wizard", () => ({
  FormWizard: mocks.formWizard,
}))

import SWEditApplicationPage from "@/app/social-worker/patients/[patientId]/applications/[applicationId]/page"
import SWNewApplicationPage from "@/app/social-worker/patients/[patientId]/applications/new/page"

const PATIENT_ID = "22222222-2222-4222-8222-222222222222"
const APPLICATION_ID = "11111111-1111-4111-8111-111111111111"

describe("social-worker application pages", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useParams.mockReturnValue({
      patientId: PATIENT_ID,
      applicationId: APPLICATION_ID,
    })
  })

  it("passes acting-for patient context to Compass when editing an existing draft", async () => {
    render(<SWEditApplicationPage />)

    await userEvent.click(screen.getByRole("tab", { name: /compass/i }))

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.intakeChat.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: APPLICATION_ID,
      actingForPatientId: PATIENT_ID,
    })
  })

  it("passes acting-for patient context to Compass when creating a new draft", async () => {
    render(<SWNewApplicationPage />)

    await userEvent.click(screen.getByRole("tab", { name: /compass/i }))

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.intakeChat.mock.calls.at(-1)?.[0]).toMatchObject({
      actingForPatientId: PATIENT_ID,
    })
  })

  it("opens Compass by default when creating a new draft", async () => {
    render(<SWNewApplicationPage />)

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.intakeChat.mock.calls.at(-1)?.[0]).toMatchObject({
      actingForPatientId: PATIENT_ID,
    })
    expect(mocks.formWizard).not.toHaveBeenCalled()
  })
})
