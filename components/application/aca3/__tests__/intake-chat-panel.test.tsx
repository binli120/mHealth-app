/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { createRef } from "react"

import { IntakeChatPanel, type IntakeChatCopy } from "@/components/application/aca3/intake-chat-panel"
import type { IntakeMessage } from "@/components/application/aca3/intake-chat-message-bubble"

const copy: IntakeChatCopy = {
  title: "ACA-3 Intake",
  subtitle: "Answer questions to complete your application.",
  openingMemoPrompt: "Let's get started.",
  switchToWizard: "Switch to Wizard",
  placeholder: "Type your answer…",
  saving: "Saving…",
  send: "Send",
  resetChat: "Reset",
  autoPlay: "Auto-play questions",
  complete: "Complete",
  savedPrefix: "Saved:",
}

const messages: IntakeMessage[] = [
  { id: "1", role: "assistant", content: "Hello! What is your name?" },
  { id: "2", role: "user", content: "Jane Doe" },
]

function renderPanel(overrides: Partial<Parameters<typeof IntakeChatPanel>[0]> = {}) {
  const props = {
    copy,
    onSwitchToWizard: vi.fn(),
    autoSpeak: false,
    onAutoSpeakChange: vi.fn(),
    selectedLanguage: "en" as const,
    onLanguageChange: vi.fn(),
    messages,
    isLoading: false,
    onSpeakQuestion: vi.fn(),
    bottomAnchorRef: createRef<HTMLDivElement>(),
    draft: "",
    onDraftChange: vi.fn(),
    onSubmit: vi.fn((e) => e.preventDefault()),
    disableInput: false,
    disableSubmit: false,
    onResetChat: vi.fn(),
    ...overrides,
  }
  render(<IntakeChatPanel {...props} />)
  return props
}

describe("IntakeChatPanel", () => {
  it("renders the panel title", () => {
    renderPanel()
    expect(screen.getByText("ACA-3 Intake")).toBeInTheDocument()
  })

  it("renders the panel subtitle", () => {
    renderPanel()
    expect(screen.getByText("Answer questions to complete your application.")).toBeInTheDocument()
  })

  it("renders the Switch to Wizard button", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: /switch to wizard/i })).toBeInTheDocument()
  })

  it("calls onSwitchToWizard when the button is clicked", () => {
    const props = renderPanel()
    fireEvent.click(screen.getByRole("button", { name: /switch to wizard/i }))
    expect(props.onSwitchToWizard).toHaveBeenCalledOnce()
  })

  it("renders chat messages", () => {
    renderPanel()
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
  })

  it("renders the text input with correct placeholder", () => {
    renderPanel()
    expect(screen.getByPlaceholderText("Type your answer…")).toBeInTheDocument()
  })

  it("renders the Send button", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
  })

  it("disables the Send button when disableSubmit is true", () => {
    renderPanel({ disableSubmit: true })
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
  })

  it("disables the input when disableInput is true", () => {
    renderPanel({ disableInput: true })
    expect(screen.getByPlaceholderText("Type your answer…")).toBeDisabled()
  })

  it("renders the Reset button", () => {
    renderPanel()
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument()
  })

  it("calls onResetChat when Reset is clicked", () => {
    const props = renderPanel()
    fireEvent.click(screen.getByRole("button", { name: /reset/i }))
    expect(props.onResetChat).toHaveBeenCalledOnce()
  })

  it("shows loading indicator when isLoading is true", () => {
    renderPanel({ isLoading: true })
    expect(screen.getByText("Saving…")).toBeInTheDocument()
  })

  it("renders the auto-play switch", () => {
    renderPanel()
    expect(screen.getByRole("switch")).toBeInTheDocument()
    expect(screen.getByText("Auto-play questions")).toBeInTheDocument()
  })

  it("renders the language selector", () => {
    renderPanel()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })
})
