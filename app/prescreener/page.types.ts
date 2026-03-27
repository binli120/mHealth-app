/**
 * TypeScript interfaces for the Pre-Screener page.
 * @author Bin Lee
 */

import type { ScreenerData } from "@/lib/eligibility-engine"

export type MessageRole = "bot" | "user"

export interface ChatMessage {
  id: string
  role: MessageRole
  text: string
  timestamp: Date
}

export interface QuickReply {
  label: string
  value: string | number | boolean
  emoji?: string
}

export interface Step {
  id: string
  botMessage: string
  inputType: "quickreply" | "number" | "currency" | "done"
  quickReplies?: QuickReply[]
  placeholder?: string
  hint?: string
  min?: number
  max?: number
  dataKey: keyof ScreenerData | null
  next: string | ((value: string | number | boolean, data: Partial<ScreenerData>) => string)
}
