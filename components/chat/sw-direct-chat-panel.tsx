/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * Patient-side 1:1 direct chat panel with their assigned social worker.
 * Supports text messages, voice recording, and image uploads.
 * Polls for new messages every 15 seconds.
 */

"use client"

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  ArrowLeft,
  File,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Play,
  SendHorizontal,
  Square,
  UserCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { useAutoScroll } from "@/hooks/use-auto-scroll"

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface SwDirectChatPanelProps {
  /** The other participant's user ID (SW when used by patient; patient when used by SW) */
  swUserId: string
  /** Display name shown in the chat header */
  swName: string
  /** Current authenticated user ID */
  currentUserId: string
  /** Label shown under the contact name in the header. Defaults to "Social Worker". */
  contactRole?: string
  /** Pre-populate messages from a parent cache to avoid loading flash on re-open. */
  initialMessages?: DirectMessage[]
  /** Called whenever the local message list changes so the parent can persist a cache. */
  onMessagesChange?: (messages: DirectMessage[]) => void
  onBack: () => void
  /** When false the built-in header (back button, name, role) is hidden.
   *  Use when the parent already renders its own navigation header. */
  showHeader?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function groupByDate(messages: DirectMessage[]): Array<{ date: string; messages: DirectMessage[] }> {
  const groups: Map<string, DirectMessage[]> = new Map()
  // Iterate chronologically (oldest first) — Map insertion order means the
  // oldest date group is first in the output → Yesterday at top, Today at bottom.
  for (const msg of messages) {
    const key = new Date(msg.createdAt).toDateString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(msg)
  }
  return Array.from(groups.entries()).map(([, msgs]) => ({
    date: msgs[0].createdAt,
    messages: msgs,
  }))
}

// ── Audio recording hook ──────────────────────────────────────────────────────

function useAudioRecorder() {
  const [recording, setRecording] = useState(false)
  const [durationSec, setDurationSec] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
      setDurationSec(0)
      timerRef.current = setInterval(() => setDurationSec((s) => s + 1), 1000)
    } catch {
      // Mic permission denied or unavailable
    }
  }, [])

  const stop = useCallback((): Promise<{ blob: Blob; durationSec: number } | null> => {
    return new Promise((resolve) => {
      const mr = mediaRef.current
      if (!mr) { resolve(null); return }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        mr.stream.getTracks().forEach((t) => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        const dur = durationSec
        setRecording(false)
        setDurationSec(0)
        mediaRef.current = null
        resolve({ blob, durationSec: dur })
      }
      mr.stop()
    })
  }, [durationSec])

  const cancel = useCallback(() => {
    const mr = mediaRef.current
    if (mr) {
      mr.stream.getTracks().forEach((t) => t.stop())
      mediaRef.current = null
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setDurationSec(0)
  }, [])

  return { recording, durationSec, start, stop, cancel }
}

// ── File helpers ──────────────────────────────────────────────────────────────

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF Document",
  doc: "Word Document", docx: "Word Document",
  xls: "Excel Spreadsheet", xlsx: "Excel Spreadsheet",
  ppt: "PowerPoint", pptx: "PowerPoint",
  txt: "Text File",
}

function getFileExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? ""
}

function getFileLabel(filename: string): string {
  return FILE_TYPE_LABELS[getFileExt(filename)] ?? "File"
}

function getFileIcon(filename: string, isOwn: boolean) {
  const ext = getFileExt(filename)
  const cls = `h-8 w-8 shrink-0 ${isOwn ? "text-primary-foreground/80" : "text-muted-foreground"}`
  if (["pdf", "doc", "docx", "txt"].includes(ext)) return <FileText className={cls} />
  return <File className={cls} />
}

// MIME types that should be sent as "file" type (not "image")
const FILE_MIME_TYPES: Record<string, true> = {
  "application/pdf": true,
  "application/msword": true,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  "application/vnd.ms-excel": true,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
  "application/vnd.ms-powerpoint": true,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
  "text/plain": true,
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
}: {
  message: DirectMessage
  isOwn: boolean
}) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlayVoice = () => {
    if (!message.signedUrl) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(message.signedUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    void audioRef.current.play()
    setPlaying(true)
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      {/* Column wrapper — holds the label, bubble, and own-timestamp stacked */}
      <div className={`flex max-w-[85%] flex-col ${isOwn ? "items-end" : "items-start"}`}>

        {/* Other party: "Name · timestamp" sits ABOVE the bubble, outside it */}
        {!isOwn && message.senderName && (
          <div className="mb-0.5 flex items-center gap-1 px-1">
            <span className="text-xs font-semibold text-muted-foreground">{message.senderName}</span>
            <span className="text-[10px] text-muted-foreground/50">·</span>
            <span className="text-[10px] text-muted-foreground/70">{formatTime(message.createdAt)}</span>
          </div>
        )}

        {/* The bubble — pure content, no metadata inside */}
        <div
          className={[
            "rounded-2xl shadow-sm",
            // Images and files use tighter padding; text uses standard padding
            message.messageType === "text" || message.messageType === "voice"
              ? "px-3 py-1.5 text-sm"
              : "overflow-hidden p-0",
            isOwn
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          ].join(" ")}
        >
          {message.messageType === "text" && (
            <p className="whitespace-pre-wrap break-words leading-snug">{message.content}</p>
          )}

          {message.messageType === "voice" && (
            <button
              type="button"
              onClick={handlePlayVoice}
              className="flex items-center gap-2 rounded-lg"
            >
              {playing ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="text-xs">
                Voice {message.durationSec ? `(${message.durationSec}s)` : ""}
              </span>
            </button>
          )}

          {/* Image — thumbnail, click opens full image in new tab */}
          {message.messageType === "image" && message.signedUrl && (
            <a
              href={message.signedUrl}
              target="_blank"
              rel="noreferrer"
              title="Click to view full image"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.signedUrl}
                alt="Shared image"
                className="max-h-48 max-w-[220px] rounded-2xl object-cover transition-opacity hover:opacity-90"
              />
            </a>
          )}
          {message.messageType === "image" && !message.signedUrl && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm opacity-50">
              <ImageIcon className="h-4 w-4" />
              <span>Image unavailable</span>
            </div>
          )}

          {/* File — icon + filename, click to download/open */}
          {message.messageType === "file" && (
            <a
              href={message.signedUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-3 py-2 transition-opacity hover:opacity-80"
            >
              {getFileIcon(message.content ?? "", isOwn)}
              <div className="min-w-0">
                <p className="max-w-[160px] truncate text-xs font-medium leading-tight">
                  {message.content ?? "Document"}
                </p>
                <p className="text-[10px] opacity-60">
                  {getFileLabel(message.content ?? "")}
                </p>
              </div>
            </a>
          )}
        </div>

        {/* Own messages: timestamp + read receipt sits BELOW the bubble, outside it */}
        {isOwn && (
          <p className="mt-0.5 px-1 text-right text-[10px] text-muted-foreground/70">
            {formatTime(message.createdAt)}
            {message.readAt && " ✓"}
          </p>
        )}

      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SwDirectChatPanel({
  swUserId,
  swName,
  currentUserId,
  contactRole = "Social Worker",
  initialMessages,
  onMessagesChange,
  onBack,
  showHeader = true,
}: SwDirectChatPanelProps) {
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages ?? [])
  // Only show the loading spinner when we have no cached messages to display
  const [loading, setLoading] = useState(!initialMessages?.length)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useAutoScroll([messages, loading])
  const { recording, durationSec, start: startRecording, stop: stopRecording, cancel: cancelRecording } = useAudioRecorder()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onMessagesChangeRef = useRef(onMessagesChange)
  onMessagesChangeRef.current = onMessagesChange

  // Notify parent cache after every messages change.
  // Must be a useEffect — calling parent setState inside a child setState
  // updater violates React's rule against setState-during-render.
  useEffect(() => {
    onMessagesChangeRef.current?.(messages)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // Wrapper that updates local state (parent is notified by the effect above)
  const setMessagesAndNotify = useCallback((updater: DirectMessage[] | ((prev: DirectMessage[]) => DirectMessage[])) => {
    setMessages(updater)
  }, [])

  // ── Fetch messages ──────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`/api/messages/${swUserId}`)
      const data = await res.json()
      if (data.ok) {
        // API returns newest-first; reverse to chronological
        const incoming = (data.messages as DirectMessage[]).slice().reverse()
        setMessagesAndNotify((prev) => {
          // If new messages arrived from the other person, signal the notification bell
          const prevNewest = prev.at(-1)?.id
          const nextNewest = incoming.at(-1)?.id
          if (nextNewest && nextNewest !== prevNewest && incoming.at(-1)?.senderId !== currentUserId) {
            window.dispatchEvent(new CustomEvent("notification:refresh"))
          }
          return incoming
        })
      }
    } catch {
      // non-critical on poll
    }
  }, [swUserId, currentUserId, setMessagesAndNotify])

  useEffect(() => {
    // If we have cached messages, refresh silently (no spinner).
    // Otherwise show the loading state.
    const hasCached = (initialMessages?.length ?? 0) > 0
    if (!hasCached) setLoading(true)
    void fetchMessages().finally(() => setLoading(false))

    // Poll every 15 seconds for new messages
    pollRef.current = setInterval(() => void fetchMessages(), 15_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMessages])

  // ── Send text ───────────────────────────────────────────────────────────────

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setDraft("")
    try {
      const res = await authenticatedFetch(`/api/messages/${swUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessagesAndNotify((prev) => [
          ...prev,
          { ...data.message, senderName: null } as DirectMessage,
        ])
      }
    } finally {
      setSending(false)
    }
  }

  // ── Voice recording ─────────────────────────────────────────────────────────

  const handleVoiceSend = async () => {
    const result = await stopRecording()
    if (!result || result.blob.size === 0) return

    setSending(true)
    try {
      const form = new FormData()
      form.append("file", result.blob, "voice.webm")
      form.append("type", "voice")
      form.append("durationSec", String(result.durationSec))

      const res = await authenticatedFetch(`/api/messages/${swUserId}/upload`, {
        method: "POST",
        body: form,
      })
      const data = await res.json()
      if (data.ok) {
        setMessagesAndNotify((prev) => [...prev, data.message as DirectMessage])
      }
    } finally {
      setSending(false)
    }
  }

  // ── File / Image upload ─────────────────────────────────────────────────────

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ""

    // Auto-detect upload type: "file" for documents, "image" for pictures
    const uploadType: "image" | "file" = FILE_MIME_TYPES[file.type] ? "file" : "image"

    setSending(true)
    try {
      const form = new FormData()
      form.append("file", file, file.name)
      form.append("type", uploadType)

      const res = await authenticatedFetch(`/api/messages/${swUserId}/upload`, {
        method: "POST",
        body: form,
      })
      const data = await res.json()
      if (data.ok) {
        setMessagesAndNotify((prev) => [...prev, data.message as DirectMessage])
      }
    } finally {
      setSending(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const grouped = groupByDate(messages)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Chat header — hidden when parent provides its own navigation */}
      {showHeader && (
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Button type="button" size="icon-sm" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {swName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{swName}</p>
            <p className="text-xs text-muted-foreground">{contactRole}</p>
          </div>
          <Badge variant="secondary" className="gap-1 text-xs">
            <UserCheck className="h-3 w-3" />
            Connected
          </Badge>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <UserCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="font-medium">Say hello to {swName}!</p>
            <p className="mt-1 text-xs">Your messages are private and secure.</p>
          </div>
        ) : (
          <div className="space-y-4 py-3">
            {grouped.map(({ date, messages: groupMsgs }) => (
              <div key={date} className="space-y-2">
                <p className="text-center text-xs text-muted-foreground">{formatDate(date)}</p>
                {groupMsgs.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === currentUserId}
                  />
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Recording indicator */}
      {recording && (
        <div className="flex items-center gap-2 border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="animate-pulse">●</span>
          Recording… {durationSec}s
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="ml-auto h-7 text-xs"
            onClick={() => void handleVoiceSend()}
            disabled={sending}
          >
            <Square className="h-3 w-3" /> Send
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={cancelRecording}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Input bar */}
      {!recording && (
        <form onSubmit={(e) => void handleSubmit(e)} className="border-t px-3 py-2">
          <div className="flex items-center gap-1.5">
            {/* File / image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Attach file or image"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Text input */}
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message your social worker…"
              disabled={sending}
              className="flex-1 text-sm"
            />

            {/* Voice / Send */}
            {draft.trim() ? (
              <Button
                type="submit"
                size="icon-sm"
                disabled={sending}
                aria-label="Send message"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Record voice message"
                disabled={sending}
                onClick={() => void startRecording()}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      )}

      {/* Image icon for empty draft when recording is unavailable */}
      <div className="flex justify-center pb-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-[10px] text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || recording}
        >
          <Paperclip className="h-3 w-3" /> Attach file or image
        </Button>
      </div>
    </div>
  )
}
