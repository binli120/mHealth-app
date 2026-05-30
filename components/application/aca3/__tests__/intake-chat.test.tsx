/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"

import { appReducer } from "@/lib/redux/features/app-slice"
import {
  applicationReducer,
  DEFAULT_APPLICATION_ID,
} from "@/lib/redux/features/application-slice"
import { FORM_CACHE_KEY_PREFIX } from "@/lib/constant"

// Heavy deps mocked at module level
vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn(),
}))
vi.mock("@/lib/supabase/client", () => ({
  getSafeSupabaseSession: vi.fn().mockResolvedValue({ session: null }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { IntakeChat } from "@/components/application/aca3/intake-chat"

function makeStore() {
  return configureStore({
    reducer: { app: appReducer, application: applicationReducer },
  })
}

function renderChat(props: Partial<Parameters<typeof IntakeChat>[0]> = {}) {
  const store = makeStore()
  const view = render(
    <Provider store={store}>
      <IntakeChat onSwitchToWizard={vi.fn()} {...props} />
    </Provider>,
  )
  return { ...view, store }
}

function renderChatWithStore(props: Partial<Parameters<typeof IntakeChat>[0]> = {}) {
  const store = makeStore()
  const view = render(
    <Provider store={store}>
      <IntakeChat onSwitchToWizard={vi.fn()} {...props} />
    </Provider>,
  )
  return { ...view, store }
}

describe("IntakeChat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
  })

  it("renders without crashing", () => {
    const { container } = renderChat()
    expect(container.firstChild).toBeTruthy()
  })

  it("renders the chat panel with a Send button by default", () => {
    renderChat()
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
  })

  it("renders the language selector", () => {
    renderChat()
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument()
  })

  it("renders the Reset button", () => {
    renderChat()
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument()
  })

  it("renders the Switch to Form Wizard button", () => {
    renderChat()
    expect(screen.getByRole("button", { name: /switch to form wizard/i })).toBeInTheDocument()
  })

  it("persists new chat answers to the default application wizard state", async () => {
    const { store } = renderChatWithStore()

    await screen.findByText(/could you tell me about yourself/i)

    fireEvent.change(screen.getByPlaceholderText(/type your answer/i), {
      target: {
        value:
          "My name is Jane Doe. I was born 01/02/1990. My email is jane@example.com and my phone is 617-555-1212.",
      },
    })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    await waitFor(() => {
      const saved = store.getState().application.applicationsById[DEFAULT_APPLICATION_ID]?.aca3Wizard
      expect(saved).toBeTruthy()
      expect((saved?.data as { contact?: Record<string, unknown> } | undefined)?.contact?.p1_name).toBe("Jane Doe")
    })

    const cached = JSON.parse(localStorage.getItem(`${FORM_CACHE_KEY_PREFIX}:${DEFAULT_APPLICATION_ID}`) ?? "{}") as {
      data?: { contact?: Record<string, unknown> }
    }
    expect(cached.data?.contact?.p1_name).toBe("Jane Doe")
  })

  it("resumes from Redux after answering an explicit question and remounting chat", async () => {
    const store = makeStore()
    const onSwitchToWizard = vi.fn()
    const view = render(
      <Provider store={store}>
        <IntakeChat onSwitchToWizard={onSwitchToWizard} />
      </Provider>,
    )

    await screen.findByText(/could you tell me about yourself/i)

    fireEvent.change(screen.getByPlaceholderText(/type your answer/i), {
      target: { value: "I need help applying." },
    })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    await screen.findByText(/full name/i)

    fireEvent.change(screen.getByPlaceholderText(/type your answer/i), {
      target: { value: "Jane Doe" },
    })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    await waitFor(() => {
      const saved = store.getState().application.applicationsById[DEFAULT_APPLICATION_ID]?.aca3Wizard
      expect((saved?.data as { contact?: Record<string, unknown> } | undefined)?.contact?.p1_name).toBe("Jane Doe")
    })

    view.unmount()

    render(
      <Provider store={store}>
        <IntakeChat onSwitchToWizard={onSwitchToWizard} />
      </Provider>,
    )

    await screen.findByText(/continue where we left off/i)
    expect(screen.queryByText(/full name/i)).not.toBeInTheDocument()
    expect(screen.getByText(/date of birth/i)).toBeInTheDocument()
  })
})
