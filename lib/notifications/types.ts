/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

// ── Notification types ─────────────────────────────────────────────────────────

export type NotificationType =
  | "status_change"
  | "document_request"
  | "renewal_reminder"
  | "deadline"
  | "general"
  | "session_invite"
  | "session_starting"
  | "sw_engagement_request"
  | "sw_engagement_accepted"
  | "sw_engagement_rejected"
  | "new_direct_message"

// DB row shape (snake_case from pg)
export interface NotificationRow {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  metadata: Record<string, unknown>
  read_at: Date | null
  email_sent_at: Date | null
  created_at: Date
}

// Client-facing shape (camelCase)
export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  metadata: Record<string, unknown>
  readAt: string | null
  emailSentAt: string | null
  createdAt: string
}

// Input for creating a notification
export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  metadata?: Record<string, unknown>
}

// Data needed to send an email alongside the in-app notification
export interface NotificationEmailData {
  recipientEmail: string
  recipientName: string
  templateHtml: string
  subject: string
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    metadata: row.metadata ?? {},
    readAt: row.read_at ? row.read_at.toISOString() : null,
    emailSentAt: row.email_sent_at ? row.email_sent_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  }
}

export { rowToNotification }
