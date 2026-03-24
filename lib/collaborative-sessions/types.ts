/**
 * Collaborative Session — shared types
 * @author Bin Lee
 */

export type SessionStatus = "scheduled" | "active" | "ended" | "cancelled"
export type MessageType = "text" | "voice"

// ── DB row shapes (snake_case from pg) ───────────────────────────────────────

export interface SessionRow {
  id: string
  sw_user_id: string
  patient_user_id: string
  status: SessionStatus
  scheduled_at: Date | null
  started_at: Date | null
  ended_at: Date | null
  ended_by: string | null
  invite_message: string | null
  created_at: Date
  updated_at: Date
}

export interface SessionMessageRow {
  id: string
  session_id: string
  sender_id: string
  type: MessageType
  content: string | null
  storage_path: string | null
  duration_sec: number | null
  created_at: Date
}

// ── Client-facing shapes (camelCase) ─────────────────────────────────────────

export interface SessionSummary {
  id: string
  swUserId: string
  swName: string
  patientUserId: string
  patientName: string
  status: SessionStatus
  scheduledAt: string | null
  startedAt: string | null
  endedAt: string | null
  inviteMessage: string | null
  createdAt: string
}

export interface SessionMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  type: MessageType
  content: string | null
  storagePath: string | null
  /** Resolved client-side for voice messages */
  signedUrl: string | null
  durationSec: number | null
  createdAt: string
}

// ── Input types ──────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  swUserId: string
  patientUserId: string
  scheduledAt?: string | null
  inviteMessage?: string | null
}

export interface CreateMessageInput {
  sessionId: string
  senderId: string
  type: MessageType
  content?: string | null
  storagePath?: string | null
  durationSec?: number | null
}
