/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

  it("uses the schema-backed intake chat for a new Compass flow", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams())

    renderPage()

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.formWizard).not.toHaveBeenCalled()
    expect(mocks.applicationAssistant).not.toHaveBeenCalled()
  })

  it("opens the form wizard when continue mode is explicit", async () => {
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams({
        applicationId: "app-123",
        patientId: "patient-456",
        mode: "wizard",
      }),
    )

    renderPage()

    await waitFor(() => expect(mocks.formWizard).toHaveBeenCalled())
    expect(mocks.formWizard.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "app-123",
      actingForPatientId: "patient-456",
    })
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.applicationAssistant).not.toHaveBeenCalled()
  })

  it("defaults to chat when an application id is present without continue mode", async () => {
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams({
        applicationId: "app-123",
      }),
    )

    renderPage()

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.intakeChat.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "app-123",
    })
    expect(mocks.formWizard).not.toHaveBeenCalled()
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

  it("honors explicit chat mode even when an application id is present", async () => {
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams({
        applicationId: "app-123",
        mode: "chat",
      }),
    )

    renderPage()

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.formWizard).not.toHaveBeenCalled()
  })

  it("updates from chat to wizard when client navigation adds continue mode", async () => {
    let searchParams = new URLSearchParams()
    mocks.useSearchParams.mockImplementation(() => searchParams)

    const { rerender } = renderPage()

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.formWizard).not.toHaveBeenCalled()

    mocks.intakeChat.mockClear()
    searchParams = new URLSearchParams({ applicationId: "app-123", mode: "wizard" })

    rerender(
      <Provider store={makeStore()}>
        <NewApplicationPage />
      </Provider>,
    )

    await waitFor(() => expect(mocks.formWizard).toHaveBeenCalled())
    expect(mocks.formWizard.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "app-123",
    })
  })

  it("can switch from wizard to chat and back to wizard without a refresh", async () => {
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams({
        applicationId: "app-123",
        mode: "wizard",
      }),
    )

    renderPage()

    await waitFor(() => expect(screen.getByTestId("form-wizard")).toBeVisible())

    await userEvent.click(screen.getByRole("tab", { name: /compass/i }))
    expect(screen.getByTestId("intake-chat")).toBeVisible()

    await userEvent.click(screen.getByRole("tab", { name: /form wizard/i }))
    expect(screen.getByTestId("form-wizard")).toBeVisible()
    expect(screen.getByTestId("intake-chat")).not.toBeVisible()
  })
})
