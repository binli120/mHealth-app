/**
 * Shared type definitions for the MassHealth chat and eligibility modules.
 */

// ── Chat ──────────────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  role: ChatRole
  content: string
}

// ── Knowledge / FAQ ───────────────────────────────────────────────────────────

export interface MassHealthLink {
  label: string
  url: string
}

export interface MassHealthFaqItem {
  id: string
  question: string
  quickAnswer: string
  links: MassHealthLink[]
}

// ── ACA-3 form ────────────────────────────────────────────────────────────────

/**
 * Maps raw answer_type strings from the ACA-3 JSON to the typed input kinds
 * used by the UI.  Defined as a const object (not an enum) so the values are
 * plain strings at runtime and can be compared with === without any import issues.
 */
export const AnswerType = {
  Text:          "text",
  TextOrUnknown: "text_or_unknown",
  YesNo:         "yes_no",
  Date:          "date",
  SingleChoice:  "single_choice",
  MultiChoice:   "multi_choice",
} as const

export type AnswerTypeValue = (typeof AnswerType)[keyof typeof AnswerType]

// ── Ollama internal ───────────────────────────────────────────────────────────

/** Raw response shape from Ollama /api/chat endpoint (used internally by fact-extraction). */
export interface OllamaResponse {
  message?: { content?: string }
}
