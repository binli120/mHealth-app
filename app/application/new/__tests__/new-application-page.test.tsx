/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"
import { appReducer } from "@/lib/redux/features/app-slice"
import { applicationReducer, createApplication } from "@/lib/redux/features/application-slice"

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  applicationAssistant: vi.fn(() => <div data-testid="application-assistant" />),
  formWizard: vi.fn(() => <div data-testid="form-wizard" />),
  intakeChat: vi.fn(() => <div data-testid="intake-chat" />),
  createUuid: vi.fn(() => "generated-app-id"),
  useSearchParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
  useSaca2Enabled: vi.fn(),
  saca2Wizard: vi.fn(() => <div data-testid="saca2-wizard" />),
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

vi.mock("@/lib/utils/random-id", () => ({
  createUuid: mocks.createUuid,
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch,
}))

vi.mock("@/components/application/saca2/use-saca2-enabled", () => ({
  useSaca2Enabled: mocks.useSaca2Enabled,
}))

vi.mock("@/components/application/saca2/saca2-wizard", () => ({
  Saca2Wizard: mocks.saca2Wizard,
}))

import NewApplicationPage from "@/app/application/new/page"

function makeStore() {
  return configureStore({ reducer: { app: appReducer, application: applicationReducer } })
}

function renderPage(seed?: (store: ReturnType<typeof makeStore>) => void) {
  const store = makeStore()
  seed?.(store)
  return render(
    <Provider store={store}>
      <NewApplicationPage />
    </Provider>,
  )
}

describe("new application page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mocks.useSearchParams.mockReturnValue(new URLSearchParams())
    mocks.authenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, record: { applicationType: "aca3" } }),
    })
    mocks.useSaca2Enabled.mockReturnValue(false)
  })

  it("uses the schema-backed intake chat for a new Compass flow", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams())

    renderPage()

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.intakeChat.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "generated-app-id",
    })
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

  it("uses the same fresh application id for new chat and wizard tabs", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams())

    renderPage()

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.intakeChat.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "generated-app-id",
    })

    await userEvent.click(screen.getByRole("tab", { name: /form wizard/i }))

    await waitFor(() => expect(mocks.formWizard).toHaveBeenCalled())
    expect(mocks.formWizard.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "generated-app-id",
    })
  })

  it("shows the SACA-2 notice, not the ACA-3 wizard, when Redux says the draft is SACA-2", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-saca" }))

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-saca", applicationType: "saca2" })),
    )

    expect(await screen.findByTestId("saca2-unavailable")).toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.formWizard).not.toHaveBeenCalled()
    expect(mocks.applicationAssistant).not.toHaveBeenCalled()
  })

  it("shows the SACA-2 notice after a reload, when only the server draft knows the type", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-reload" }))
    mocks.authenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, record: { applicationType: "saca2" } }),
    })

    renderPage()

    expect(await screen.findByTestId("saca2-unavailable")).toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.formWizard).not.toHaveBeenCalled()
  })

  it("does not flash the ACA-3 flow while the server lookup is pending", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-pending" }))
    mocks.authenticatedFetch.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.queryByTestId("saca2-unavailable")).not.toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.formWizard).not.toHaveBeenCalled()
  })

  it("does not fall through to the ACA-3 flow when the draft lookup fails", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-flaky" }))
    mocks.authenticatedFetch.mockRejectedValue(new Error("network"))

    renderPage()

    expect(await screen.findByTestId("application-lookup-error")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.formWizard).not.toHaveBeenCalled()
  })

  it("still opens the ACA-3 flow for non-SACA-2 drafts", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-aca3" }))

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-aca3", applicationType: "aca3" })),
    )

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(screen.queryByTestId("saca2-unavailable")).not.toBeInTheDocument()
  })

  it("shows the SACA-2 wizard instead of the notice when the flag is on", async () => {
    mocks.useSaca2Enabled.mockReturnValue(true)
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams({ applicationId: "app-saca", patientId: "patient-7" }),
    )

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-saca", applicationType: "saca2" })),
    )

    expect(await screen.findByTestId("saca2-wizard")).toBeInTheDocument()
    expect(mocks.saca2Wizard.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "app-saca",
      actingForPatientId: "patient-7",
    })
    expect(screen.queryByTestId("saca2-unavailable")).not.toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
    expect(mocks.formWizard).not.toHaveBeenCalled()
  })

  it("shows nothing for a SACA-2 draft while the flag is still loading", async () => {
    mocks.useSaca2Enabled.mockReturnValue(null)
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-saca" }))

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-saca", applicationType: "saca2" })),
    )

    expect(screen.queryByTestId("saca2-wizard")).not.toBeInTheDocument()
    expect(screen.queryByTestId("saca2-unavailable")).not.toBeInTheDocument()
    expect(mocks.intakeChat).not.toHaveBeenCalled()
  })

  it("only asks for the flag when the draft is a SACA-2", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams({ applicationId: "app-aca3" }))

    renderPage((store) =>
      store.dispatch(createApplication({ applicationId: "app-aca3", applicationType: "aca3" })),
    )

    await waitFor(() => expect(mocks.intakeChat).toHaveBeenCalled())
    expect(mocks.useSaca2Enabled).toHaveBeenCalledWith(false)
  })
})
