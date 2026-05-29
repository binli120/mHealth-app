/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * CompassIcon avatar and MessageBubble sub-component for the application assistant.
 */

"use client"

import { User, UserRound, Volume2, VolumeX } from "lucide-react"
import { DocumentUploader } from "@/components/application/document-uploader"
import type { AssistantMessage } from "./application-assistant-types"

// ── CompassIcon ───────────────────────────────────────────────────────────────

export function CompassIcon({ className }: { className?: string }) {
  return <UserRound className={className} aria-hidden="true" />
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

export function MessageBubble({
  message,
  applicationId,
  onSpeak,
  isSpeaking,
}: {
  message: AssistantMessage
  applicationId: string
  onSpeak?: (text: string) => void
  isSpeaking?: boolean
}) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-2">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
      </div>
    )
  }

  if (message.type === "upload_prompt") {
    return (
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <CompassIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">
            {message.content}
          </div>
          <div className="space-y-2">
            {message.docTypes.map((doc) => (
              <DocumentUploader
                key={doc.type}
                applicationId={applicationId}
                documentType={doc.type}
                requiredDocumentLabel={doc.label}
                title={doc.label}
                description={doc.description}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Standard assistant text message
  return (
    <div className="group flex items-start gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <CompassIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="relative max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed">
        {message.content}
        {onSpeak && message.content && (
          <button
            type="button"
            aria-label={isSpeaking ? "Stop reading" : "Read aloud"}
            onClick={() => onSpeak(message.content)}
            className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
          >
            {isSpeaking
              ? <VolumeX className="h-3 w-3" />
              : <Volume2 className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  )
}
