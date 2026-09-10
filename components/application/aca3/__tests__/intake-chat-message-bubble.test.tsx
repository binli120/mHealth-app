/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import {
  IntakeMessageBubble,
  splitTrailingQuestion,
} from "@/components/application/aca3/intake-chat-message-bubble"
import type { IntakeMessage } from "@/components/application/aca3/intake-chat-message-bubble"

// ── splitTrailingQuestion ──────────────────────────────────────────────────────

describe("splitTrailingQuestion", () => {
  it("returns the full content as prefix when there is no trailing question", () => {
    const result = splitTrailingQuestion("Hello, I am a statement.")
    expect(result.prefix).toBe("Hello, I am a statement.")
    expect(result.question).toBeNull()
  })

  it("extracts the trailing question when content ends with '?'", () => {
    const result = splitTrailingQuestion("Here is some context. What is your age?")
    expect(result.question).toBe("What is your age?")
    expect(result.prefix).toBe("Here is some context.")
  })

  it("treats the entire string as question when there is no prefix delimiter", () => {
    const result = splitTrailingQuestion("Are you a resident?")
    expect(result.question).toBe("Are you a resident?")
    expect(result.prefix).toBe("")
  })

  it("returns null for question when the extracted question is too short (< 6 chars)", () => {
    // Trailing "ok?" has only 3 chars
    const result = splitTrailingQuestion("Some text. ok?")
    expect(result.question).toBeNull()
  })

  it("splits on newline delimiter", () => {
    const result = splitTrailingQuestion("Some context here.\nWhat is your name?")
    expect(result.question).toBe("What is your name?")
  })
})

// ── IntakeMessageBubble ────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<IntakeMessage> = {}): IntakeMessage {
  return {
    id: "msg-1",
    role: "assistant",
    content: "Hello! What is your age?",
    ...overrides,
  }
}

describe("IntakeMessageBubble", () => {
  it("renders user message content aligned to the right", () => {
    const message = makeMessage({ role: "user", content: "I am 35 years old." })
    render(<IntakeMessageBubble message={message} onSpeakQuestion={vi.fn()} />)
    expect(screen.getByText("I am 35 years old.")).toBeInTheDocument()
  })

  it("renders assistant message with the trailing question bolded", () => {
    const message = makeMessage({ role: "assistant", content: "Great. What is your name?" })
    render(<IntakeMessageBubble message={message} onSpeakQuestion={vi.fn()} />)
    expect(screen.getByText("What is your name?")).toBeInTheDocument()
  })

  it("shows 'Play question' button for assistant messages with a question", () => {
    const message = makeMessage({ role: "assistant", content: "Tell me about yourself. What is your age?" })
    render(<IntakeMessageBubble message={message} onSpeakQuestion={vi.fn()} />)
    expect(screen.getByRole("button", { name: /play question/i })).toBeInTheDocument()
  })

  it("calls onSpeakQuestion with the extracted question on button click", () => {
    const onSpeakQuestion = vi.fn()
    const message = makeMessage({ role: "assistant", content: "Tell me about yourself. What is your age?" })
    render(<IntakeMessageBubble message={message} onSpeakQuestion={onSpeakQuestion} />)
    fireEvent.click(screen.getByRole("button", { name: /play question/i }))
    expect(onSpeakQuestion).toHaveBeenCalledWith("What is your age?")
  })

  it("does not show 'Play question' button for user messages", () => {
    const message = makeMessage({ role: "user", content: "What is my name?" })
    render(<IntakeMessageBubble message={message} onSpeakQuestion={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /play question/i })).not.toBeInTheDocument()
  })

  it("shows 'Play question' for label-style assistant prompts with no trailing '?'", () => {
    // Most schema prompts are labels ("Date of birth", "Street address"), not
    // questions — the button must still appear so they can be read aloud.
    const onSpeakQuestion = vi.fn()
    const message = makeMessage({ role: "assistant", content: "Thanks. First name, middle name, last name, and suffix" })
    render(<IntakeMessageBubble message={message} onSpeakQuestion={onSpeakQuestion} />)
    fireEvent.click(screen.getByRole("button", { name: /play question/i }))
    expect(onSpeakQuestion).toHaveBeenCalledWith("First name, middle name, last name, and suffix")
  })

  it("does not show 'Play question' button for user messages even without a '?'", () => {
    const message = makeMessage({ role: "user", content: "This is a plain statement." })
    render(<IntakeMessageBubble message={message} onSpeakQuestion={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /play question/i })).not.toBeInTheDocument()
  })
})
