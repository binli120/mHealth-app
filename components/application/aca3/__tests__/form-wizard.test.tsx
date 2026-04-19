/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"

import { appReducer } from "@/lib/redux/features/app-slice"
import { applicationReducer } from "@/lib/redux/features/application-slice"

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

describe("FormWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
