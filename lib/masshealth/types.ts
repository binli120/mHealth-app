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

// ── Ollama internal ───────────────────────────────────────────────────────────

/** Raw response shape from Ollama /api/chat endpoint (used internally by fact-extraction). */
export interface OllamaResponse {
  message?: { content?: string }
}
