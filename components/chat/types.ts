/**
 * Type definitions for the MassHealth chat widget.
 */

import type { ChatMessage } from "@/lib/masshealth/types"

// ── View state ────────────────────────────────────────────────────────────────

export type WidgetView = "faq" | "chat" | "advisor"

// ── API response ──────────────────────────────────────────────────────────────

export interface EligibilityProgram {
  program: string
  eligible: boolean
  reason?: string
}

export interface ChatApiResponse {
  ok: boolean
  outOfScope?: boolean
  reply?: string
  error?: string
  factsExtracted?: Record<string, unknown>
  eligibilityResults?: {
    programs?: EligibilityProgram[]
    [key: string]: unknown
  }
}

// ── Messages ──────────────────────────────────────────────────────────────────

export interface WidgetMessage extends ChatMessage {
  id: string
  eligibilityResults?: ChatApiResponse["eligibilityResults"]
}
