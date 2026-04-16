/**
 * TypeScript types for the Social Worker Patient Conversation page.
 * @author Bin Lee
 */

export interface DirectMessage {
  id: string
  senderId: string
  senderName: string | null
  messageType: "text" | "voice" | "image"
  content: string | null
  storagePath: string | null
  signedUrl?: string | null
  durationSec: number | null
  readAt: string | null
  createdAt: string
}

export interface MessageBubbleProps {
  message: DirectMessage
  isOwn: boolean
}

export interface GroupedMessages {
  date: string
  messages: DirectMessage[]
}

export interface PageParams {
  params: Promise<{ patientId: string }>
}
