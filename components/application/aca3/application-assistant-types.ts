/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Canonical type definitions for the application-assistant sub-modules.
 */

import type { ApplicationFormData } from "@/lib/redux/features/application-slice"

// ── Message types ─────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant"

export interface BaseMessage {
  id: string
  role: MessageRole
  content: string
}

export interface TextMessage extends BaseMessage {
  type: "text"
}

export interface UploadPromptMessage extends BaseMessage {
  type: "upload_prompt"
  docTypes: Array<{ type: string; label: string; description: string }>
}

export type AssistantMessage = TextMessage | UploadPromptMessage

// ── API / chat types ──────────────────────────────────────────────────────────

export interface ApiChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface QuickReply {
  label: string
  value: string
}

// ── Draft state ───────────────────────────────────────────────────────────────

export interface AssistantDraftState {
  mode: "form_assistant"
  updatedAt: string
  formData: Partial<ApplicationFormData>
  messages: AssistantMessage[]
  noHouseholdMembers: boolean
  noIncome: boolean
}

// ── Component props ───────────────────────────────────────────────────────────

export interface ApplicationAssistantProps {
  applicationId?: string
  actingForPatientId?: string
  /** Structured form data pre-parsed from an uploaded document. When provided
   *  these fields are applied directly to the Redux store and the assistant
   *  skips to asking only about missing or uncertain fields. */
  prefillFormData?: Partial<ApplicationFormData>
  onSwitchToWizard?: () => void
}
