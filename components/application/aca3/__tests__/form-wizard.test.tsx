/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"

import { appReducer } from "@/lib/redux/features/app-slice"
import {
  applicationReducer,
  DEFAULT_APPLICATION_ID,
  setApplicationWizardState,
} from "@/lib/redux/features/application-slice"
import { FORM_CACHE_KEY_PREFIX } from "@/lib/constant"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn().mockResolvedValue({ ok: false, status: 404 }),
}))
vi.mock("@/lib/supabase/client", () => ({
  getSafeSupabaseSession: vi.fn().mockResolvedValue({ session: null }),
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

import { FormWizard } from "@/components/application/aca3/form-wizard"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { createDraftWizardState, createInitialData } from "@/components/application/aca3/wizard-reducer"

function makeStore() {
  return configureStore({
    reducer: { app: appReducer, application: applicationReducer },
  })
}

function renderWizard(applicationId?: string) {
  return render(
    <Provider store={makeStore()}>
      <FormWizard applicationId={applicationId} />
    </Provider>,
  )
}

function renderWizardWithStore(store: ReturnType<typeof makeStore>, applicationId?: string) {
  return render(
    <Provider store={store}>
      <FormWizard applicationId={applicationId} />
    </Provider>,
  )
}

describe("FormWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(authenticatedFetch).mockResolvedValue({ ok: false, status: 404 } as Response)
  })

  it("renders without crashing", () => {
    const { container } = renderWizard()
    expect(container.firstChild).toBeTruthy()
  })

  it("renders a Next or navigation button", async () => {
    renderWizard()
    // Wait for hydration to complete before buttons appear
    await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(0))
  })

  it("renders step progress indicator", async () => {
    renderWizard()
    // WizardLayout renders a step counter after hydration
    await waitFor(() => expect(screen.getByText(/step/i)).toBeInTheDocument())
  })

  it("renders the MassHealth branding", async () => {
    renderWizard()
    // Component is async: shows "Loading saved application..." until hydration resolves
    await waitFor(() => expect(screen.getByText("MassHealth")).toBeInTheDocument())
  })

  it("prefers the server draft over stale local cache and clamps invalid progress", async () => {
    const applicationId = "9b786f61-c945-4098-b813-e62c069114d2"
    localStorage.setItem(
      `${FORM_CACHE_KEY_PREFIX}:${applicationId}`,
      JSON.stringify({
        currentStep: 1,
        completedSteps: [],
        persistedAt: "2099-01-01T00:00:00.000Z",
        data: {},
      }),
    )

    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      const requestUrl = String(url)
      if (requestUrl.includes(`/api/applications/${applicationId}/draft`) && init?.method === "GET") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            record: {
              phiDraftResumeId: null,
              phiDraftKeyEnc: null,
            },
            draftState: {
              currentStep: 7,
              completedSteps: [1, 2, 3, 4, 5, 6],
              persistedAt: "2026-05-15T20:00:00.000Z",
              data: {
                assister: {},
                assisterEnabled: false,
                attestation: false,
              },
            },
          }),
        } as Response
      }

      return { ok: true, json: async () => ({ ok: true }) } as Response
    })

    renderWizard(applicationId)

    await waitFor(() => expect(screen.getByText("Step 2 of 9")).toBeInTheDocument())
    expect(screen.getByText("22% complete")).toBeInTheDocument()
  })

  it("does not overwrite a Redux chat draft with the empty pre-hydration state", async () => {
    const store = makeStore()
    const data = createInitialData()
    data.contact.p1_name = "Jane Doe"
    const wizardState = createDraftWizardState(data, 2)

    store.dispatch(
      setApplicationWizardState({
        applicationId: DEFAULT_APPLICATION_ID,
        wizardState: wizardState as unknown as Record<string, unknown>,
      }),
    )

    renderWizardWithStore(store)

    await waitFor(() => expect(screen.getByText("Step 2 of 9")).toBeInTheDocument())

    await waitFor(() => {
      const saved = store.getState().application.applicationsById[DEFAULT_APPLICATION_ID]?.aca3Wizard
      expect((saved?.data as { contact?: Record<string, unknown> } | undefined)?.contact?.p1_name).toBe("Jane Doe")
    })
  })

  it("clamps stale saved progress to the first incomplete wizard step", async () => {
    const store = makeStore()
    const data = createInitialData()

    store.dispatch(
      setApplicationWizardState({
        applicationId: DEFAULT_APPLICATION_ID,
        wizardState: createDraftWizardState(data, 5) as unknown as Record<string, unknown>,
      }),
    )

    renderWizardWithStore(store)

    await waitFor(() => expect(screen.getByText("Step 2 of 9")).toBeInTheDocument())
  })
})
