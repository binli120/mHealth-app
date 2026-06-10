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
import * as formWizardValidation from "@/components/application/aca3/form-wizard-validation"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { createDraftWizardState, createInitialData } from "@/components/application/aca3/wizard-reducer"
import type { ApplicationFormData } from "@/lib/redux/features/application-slice"

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

function renderWizardWithStore(
  store: ReturnType<typeof makeStore>,
  applicationId?: string,
  prefillFormData?: Partial<ApplicationFormData>,
) {
  return render(
    <Provider store={store}>
      <FormWizard applicationId={applicationId} prefillFormData={prefillFormData} />
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

  it("prefers the newer draft by timestamp and clamps invalid progress", async () => {
    const applicationId = "9b786f61-c945-4098-b813-e62c069114d2"
    // Local cache is older — server draft should win via timestamp comparison.
    localStorage.setItem(
      `${FORM_CACHE_KEY_PREFIX}:${applicationId}`,
      JSON.stringify({
        currentStep: 1,
        completedSteps: [],
        persistedAt: "2026-05-14T10:00:00.000Z",
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

  it("does not overwrite existing answers with profile prefill data", async () => {
    const store = makeStore()
    const data = createInitialData()
    data.contact.p1_name = "Chat User"
    data.contact.p1_home_street = "10 Chat Street"
    data.persons[0].coverage.us_citizen = "No"
    const wizardState = createDraftWizardState(data, 2)

    store.dispatch(
      setApplicationWizardState({
        applicationId: DEFAULT_APPLICATION_ID,
        wizardState: wizardState as unknown as Record<string, unknown>,
      }),
    )

    renderWizardWithStore(store, undefined, {
      firstName: "Profile",
      lastName: "Person",
      address: "99 Profile Avenue",
      citizenship: "citizen",
    })

    await waitFor(() => expect(screen.getByText("Step 2 of 9")).toBeInTheDocument())

    await waitFor(() => {
      const saved = store.getState().application.applicationsById[DEFAULT_APPLICATION_ID]?.aca3Wizard
      const contact = saved?.data?.contact as Record<string, unknown> | undefined
      const persons = saved?.data?.persons as Array<{ coverage?: Record<string, unknown> }> | undefined

      expect(contact?.p1_name).toBe("Chat User")
      expect(contact?.p1_home_street).toBe("10 Chat Street")
      expect(persons?.[0]?.coverage?.us_citizen).toBe("No")
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

  it("does not continuously retry automatic PDF generation after a failed preview", async () => {
    const validateSpy = vi.spyOn(formWizardValidation, "validateStepWithWizardRules").mockReturnValue({})
    const store = makeStore()
    const data = createInitialData()

    store.dispatch(
      setApplicationWizardState({
        applicationId: DEFAULT_APPLICATION_ID,
        wizardState: createDraftWizardState(data, 8) as unknown as Record<string, unknown>,
      }),
    )

    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      const requestUrl = String(url)
      if (requestUrl === "/api/forms/aca-3-0325/fill" && init?.method === "POST") {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Unable to generate filled ACA PDF" }),
        } as Response
      }

      return { ok: false, status: 404, json: async () => ({}) } as Response
    })

    try {
      renderWizardWithStore(store)

      await waitFor(() => expect(screen.getByText("Step 8 of 9")).toBeInTheDocument())
      await waitFor(() => {
        expect(
          vi.mocked(authenticatedFetch).mock.calls.filter(([url, init]) => (
            String(url) === "/api/forms/aca-3-0325/fill" && init?.method === "POST"
          )),
        ).toHaveLength(1)
      })
      const pdfRequest = vi.mocked(authenticatedFetch).mock.calls.find(([url, init]) => (
        String(url) === "/api/forms/aca-3-0325/fill" && init?.method === "POST"
      ))
      const pdfRequestBody = JSON.parse(String(pdfRequest?.[1]?.body ?? "{}")) as Record<string, unknown>
      expect(pdfRequestBody).toHaveProperty("workflowData")
      expect(pdfRequestBody.workflowData).toHaveProperty("step1_contact")
      expect(pdfRequestBody.workflowData).toHaveProperty("persons")

      await new Promise((resolve) => window.setTimeout(resolve, 100))

      expect(
        vi.mocked(authenticatedFetch).mock.calls.filter(([url, init]) => (
          String(url) === "/api/forms/aca-3-0325/fill" && init?.method === "POST"
        )),
      ).toHaveLength(1)
    } finally {
      validateSpy.mockRestore()
    }
  })

  it("renders the generated PDF blob URL in the preview iframe", async () => {
    const validateSpy = vi.spyOn(formWizardValidation, "validateStepWithWizardRules").mockReturnValue({})
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    })
    const createObjectUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:http://localhost/generated-pdf")
    const revokeObjectUrlSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {})
    const store = makeStore()
    const data = createInitialData()

    store.dispatch(
      setApplicationWizardState({
        applicationId: DEFAULT_APPLICATION_ID,
        wizardState: createDraftWizardState(data, 8) as unknown as Record<string, unknown>,
      }),
    )

    const pdfBlob = new Blob([new Uint8Array([37, 80, 68, 70])], { type: "application/pdf" })
    vi.mocked(authenticatedFetch).mockImplementation(async (url, init) => {
      const requestUrl = String(url)
      if (requestUrl === "/api/forms/aca-3-0325/fill" && init?.method === "POST") {
        return { ok: true, status: 200, blob: async () => pdfBlob } as unknown as Response
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response
    })

    try {
      renderWizardWithStore(store)

      await screen.findByText("Step 8 of 9")
      await waitFor(() => {
        expect(
          vi.mocked(authenticatedFetch).mock.calls.some(([url, init]) => (
            String(url) === "/api/forms/aca-3-0325/fill" && init?.method === "POST"
          )),
        ).toBe(true)
      })
      await waitFor(() => expect(createObjectUrlSpy).toHaveBeenCalled(), { timeout: 10_000 })

      const preview = await screen.findByTitle("ACA-03 PDF preview", {}, { timeout: 10_000 })
      expect(createObjectUrlSpy).toHaveBeenCalled()
      expect(preview).toHaveAttribute("src", "blob:http://localhost/generated-pdf#navpanes=0&view=FitH&zoom=page-fit")
    } finally {
      validateSpy.mockRestore()
      createObjectUrlSpy.mockRestore()
      revokeObjectUrlSpy.mockRestore()
    }
  }, 15_000)
})
