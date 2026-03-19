/**
 * @author Bin Lee
 * @email binlee120@gmail.com
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MassHealthChatWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom does not implement scrollIntoView — stub it to prevent TypeError
    Element.prototype.scrollIntoView = vi.fn()
  })

  it("renders the chat button (closed state)", () => {
    renderWidget()
    expect(screen.getByRole("button", { name: /open masshealth assistant/i })).toBeInTheDocument()
  })

  it("opens the widget when the chat button is clicked", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("MassHealth AI Assistant")).toBeInTheDocument()
  })

  it("closes the widget when the X button is clicked", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /close/i }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows Benefit Advisor tab as the first tab", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    const tabs = screen.getAllByRole("button")
    const labelledTabs = tabs.filter((b) =>
      ["Benefit Advisor", "Common Questions"].some((label) => b.textContent?.includes(label)),
    )
    expect(labelledTabs[0]).toHaveTextContent("Benefit Advisor")
    expect(labelledTabs[1]).toHaveTextContent("Common Questions")
  })

  it("shows the advisor greeting by default when opened", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    // "Benefit Advisor" appears in both the tab button and the greeting bubble
    expect(screen.getAllByText(/Benefit Advisor/i).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByText(/Tell me about yourself/i),
    ).toBeInTheDocument()
  })

  it("switches to Common Questions view when the tab is clicked", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    fireEvent.click(screen.getByRole("button", { name: /common questions/i }))
    expect(screen.getByText(/Common Questions/i)).toBeInTheDocument()
  })

  it("renders a language selector with English as default", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    // The select trigger should be present
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("shows a text input and Send button in advisor view", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    expect(screen.getByPlaceholderText(/Tell me your age/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
  })

  it("disables Send button when input is empty", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    const sendButton = screen.getByRole("button", { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  it("enables Send button when user types a message", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    const input = screen.getByPlaceholderText(/Tell me your age/i)
    fireEvent.change(input, { target: { value: "I am 35 years old" } })
    const sendButton = screen.getByRole("button", { name: /send/i })
    expect(sendButton).not.toBeDisabled()
  })

  it("shows the rule engine disclaimer banner in advisor view", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    expect(screen.getByText(/rule engine/i)).toBeInTheDocument()
  })

  it("resets to advisor view when Reset is clicked", () => {
    renderWidget()
    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    // Switch to FAQ
    fireEvent.click(screen.getByRole("button", { name: /common questions/i }))
    // Reset
    fireEvent.click(screen.getByRole("button", { name: /reset/i }))
    // Should be back on advisor
    expect(screen.getByText(/Tell me about yourself/i)).toBeInTheDocument()
  })

  it("updates widget copy and seeded assistant messages when language changes", () => {
    const { store } = renderWidget()

    fireEvent.click(screen.getByRole("button", { name: /open masshealth assistant/i }))
    expect(screen.getByText("MassHealth AI Assistant")).toBeInTheDocument()
    expect(screen.getByText(/tell me about yourself/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/tell me your age/i)).toBeInTheDocument()

    act(() => {
      store.dispatch(setLanguage("es"))
    })

    expect(screen.getByText("Asistente de IA de MassHealth")).toBeInTheDocument()
    expect(screen.getByText(/soy su asesor de beneficios de masshealth/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/dígame su edad/i)).toBeInTheDocument()
  })
})
