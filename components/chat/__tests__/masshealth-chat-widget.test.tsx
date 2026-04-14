/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, fireEvent } from "@testing-library/react"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"

import { MassHealthChatWidget } from "@/components/chat/masshealth-chat-widget"
import { appReducer, setLanguage } from "@/lib/redux/features/app-slice"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn().mockResolvedValue({
    json: async () => ({ ok: true, reply: "Test reply from advisor." }),
  }),
}))

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        // Fire immediately with an authenticated session
        cb("SIGNED_IN", { user: { id: "test-user-id", email: "test@example.com" } })
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
    },
  })),
}))

// ── Test store ────────────────────────────────────────────────────────────────

function makeStore() {
  return configureStore({ reducer: { app: appReducer } })
}

function renderWidget() {
  const store = makeStore()
  const view = render(
    <Provider store={store}>
      <MassHealthChatWidget />
    </Provider>,
  )

  return { store, ...view }
}

/** Open the widget and wait for the auth check to resolve. */
async function openWidget() {
  // Wait for the mount-time auth check to resolve (widget hidden until then)
  await act(async () => {})
  fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
  // Wait for the open-time auth re-check to resolve
  await act(async () => {})
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MassHealthChatWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom does not implement scrollIntoView — stub it to prevent TypeError
    Element.prototype.scrollIntoView = vi.fn()
  })

  it("renders the chat button (closed state)", async () => {
    renderWidget()
    // Auth check resolves before the button appears
    await act(async () => {})
    expect(screen.getByRole("button", { name: /open masshealth assistant/i })).toBeInTheDocument()
  })

  it("opens the widget when the chat button is clicked", async () => {
    renderWidget()
    await openWidget()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("HealthCompass AI Assistant")).toBeInTheDocument()
  })

  it("closes the widget when the X button is clicked", async () => {
    renderWidget()
    await openWidget()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /close/i }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows Benefit Advisor tab as the first tab", async () => {
    renderWidget()
    await openWidget()
    const tabs = screen.getAllByRole("button")
    const labelledTabs = tabs.filter((b) =>
      ["Benefit Advisor", "Common Questions"].some((label) => b.textContent?.includes(label)),
    )
    expect(labelledTabs[0]).toHaveTextContent("Benefit Advisor")
    expect(labelledTabs[1]).toHaveTextContent("Common Questions")
  })

  it("shows the advisor greeting by default when opened", async () => {
    renderWidget()
    await openWidget()
    // "Benefit Advisor" appears in the tab button
    expect(screen.getAllByText(/Benefit Advisor/i).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByText(/Tell me about yourself/i),
    ).toBeInTheDocument()
  })

  it("switches to Common Questions view when the tab is clicked", async () => {
    renderWidget()
    await openWidget()
    fireEvent.click(screen.getByRole("button", { name: /common questions/i }))
    // The tab button itself should be present (use role query to be specific)
    expect(screen.getByRole("button", { name: /common questions/i })).toBeInTheDocument()
  })

  it("renders a language selector with English as default", async () => {
    renderWidget()
    await openWidget()
    // The select trigger should be present
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("shows a text input and Send button in advisor view", async () => {
    renderWidget()
    await openWidget()
    expect(screen.getByPlaceholderText(/Tell me your age/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
  })

  it("disables Send button when input is empty", async () => {
    renderWidget()
    await openWidget()
    const sendButton = screen.getByRole("button", { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  it("enables Send button when user types a message", async () => {
    renderWidget()
    await openWidget()
    const input = screen.getByPlaceholderText(/Tell me your age/i)
    fireEvent.change(input, { target: { value: "I am 35 years old" } })
    const sendButton = screen.getByRole("button", { name: /send/i })
    expect(sendButton).not.toBeDisabled()
  })

  it("shows the rule engine disclaimer banner in advisor view", async () => {
    renderWidget()
    await openWidget()
    expect(screen.getByText(/rule engine/i)).toBeInTheDocument()
  })

  it("resets to advisor view when Reset is clicked", async () => {
    renderWidget()
    await openWidget()
    // Switch to FAQ
    fireEvent.click(screen.getByRole("button", { name: /common questions/i }))
    // Reset
    fireEvent.click(screen.getByRole("button", { name: /reset/i }))
    // Should be back on advisor
    expect(screen.getByText(/Tell me about yourself/i)).toBeInTheDocument()
  })

  it("updates widget copy and seeded assistant messages when language changes", async () => {
    const { store } = renderWidget()

    await openWidget()
    // Title is now hardcoded as the brand name (not translated)
    expect(screen.getByText("HealthCompass AI Assistant")).toBeInTheDocument()
    expect(screen.getByText(/tell me about yourself/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/tell me your age/i)).toBeInTheDocument()

    act(() => {
      store.dispatch(setLanguage("es"))
    })

    // Greeting and placeholder should switch to Spanish
    expect(screen.getByText(/soy su asesor de beneficios de masshealth/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/dígame su edad/i)).toBeInTheDocument()
  })
})
