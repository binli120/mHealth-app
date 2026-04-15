/**
 * TypeScript types for the Social Worker Messages page.
 * @author Bin Lee
 */

export interface MessageThread {
  patientUserId: string
  patientName: string | null
  patientEmail: string
  lastMessageAt: string | null
  lastMessageContent: string | null
  unreadCount: number
}

export type Tab = "requests" | "messages"
