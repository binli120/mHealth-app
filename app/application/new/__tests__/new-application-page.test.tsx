/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"
import { appReducer } from "@/lib/redux/features/app-slice"
import { applicationReducer } from "@/lib/redux/features/application-slice"

const mocks = vi.hoisted(() => ({
  applicationAssistant: vi.fn(() => <div data-testid="application-assistant" />),
  formWizard: vi.fn(() => <div data-testid="form-wizard" />),
  intakeChat: vi.fn(() => <div data-testid="intake-chat" />),
  useSearchParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: mocks.useSearchParams,
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

import NewApplicationPage from "@/app/application/new/page"

function makeStore() {
  return configureStore({ reducer: { app: appReducer, application: applicationReducer } })
}

function renderPage() {
  return render(
    <Provider store={makeStore()}>
      <NewApplicationPage />
    </Provider>,
  )
}

describe("new application page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mocks.useSearchParams.mockReturnValue(new URLSearchParams())
  })

  it("uses the schema-backed intake chat for the normal Compass flow", async () => {
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams({
        applicationId: "app-123",
        patientId: "patient-456",
      }),
    )

    renderPage()

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.intakeChat.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "app-123",
      actingForPatientId: "patient-456",
    })
    expect(mocks.applicationAssistant).not.toHaveBeenCalled()
  })

  it("keeps the legacy assistant for document-prefill handoff", async () => {
    sessionStorage.setItem("prefill-key", JSON.stringify({ firstName: "Ada" }))
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams({
        applicationId: "app-789",
        patientId: "patient-012",
        prefillKey: "prefill-key",
      }),
    )

    renderPage()

    await waitFor(() => expect(mocks.applicationAssistant).toHaveBeenCalled())
    expect(mocks.applicationAssistant.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "app-789",
      actingForPatientId: "patient-012",
      prefillFormData: { firstName: "Ada" },
    })
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(sessionStorage.getItem("prefill-key")).toBeNull()
  })
})
