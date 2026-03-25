/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * SW conversation view — 1:1 direct chat between SW and a specific patient.
 */

"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Play,
  SendHorizontal,
  Square,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getSafeSupabaseSession } from "@/lib/supabase/client"
import { useAutoScroll } from "@/hooks/use-auto-scroll"

// ── Types ─────────────────────────────────────────────────────────────────────

interface DirectMessage {
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

type Params = { params: Promise<{ patientId: string }> }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatDateLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function groupByDate(msgs: DirectMessage[]) {
  const groups = new Map<string, DirectMessage[]>()
  for (const m of [...msgs].reverse()) {
    const key = new Date(m.createdAt).toDateString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }
  return Array.from(groups.values()).map((g) => ({ date: g[0].createdAt, messages: g }))
}

// ── Audio recorder ────────────────────────────────────────────────────────────

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
    } catch { /* mic unavailable */ }
  }, [])

  const stop = useCallback((): Promise<{ blob: Blob; durationSec: number } | null> => {
    return new Promise((resolve) => {
      const mr = mediaRef.current
      if (!mr) { resolve(null); return }
      const dur = durationSec
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        mr.stream.getTracks().forEach((t) => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        setRecording(false)
        setDurationSec(0)
        mediaRef.current = null
        resolve({ blob, durationSec: dur })
      }
      mr.stop()
    })
  }, [durationSec])

  const cancel = useCallback(() => {
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop())
    mediaRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setDurationSec(0)
  }, [])

  return { recording, durationSec, start, stop, cancel }
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, isOwn }: { message: DirectMessage; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlayVoice = () => {
    if (!message.signedUrl) return
    if (playing) { audioRef.current?.pause(); setPlaying(false); return }
    if (!audioRef.current) {
      audioRef.current = new Audio(message.signedUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    void audioRef.current.play()
    setPlaying(true)
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={[
        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
        isOwn ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      ].join(" ")}>
        {!isOwn && message.senderName && (
          <p className="mb-1 text-xs font-semibold opacity-70">{message.senderName}</p>
        )}
        {message.messageType === "text" && (
          <p className="whitespace-pre-wrap break-words leading-5">{message.content}</p>
        )}
        {message.messageType === "voice" && (
          <button type="button" onClick={handlePlayVoice} className="flex items-center gap-2">
            {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span className="text-xs">Voice {message.durationSec ? `(${message.durationSec}s)` : ""}</span>
          </button>
        )}
        {message.messageType === "image" && message.signedUrl && (
          <a href={message.signedUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={message.signedUrl} alt="Shared image" className="max-h-48 max-w-full rounded-lg object-cover" />
          </a>
        )}
        <p className="mt-1 text-right text-[10px] opacity-60">
          {formatTime(message.createdAt)}
          {isOwn && message.readAt && " ✓"}
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SwPatientConversationPage({ params }: Params) {
  const [patientId, setPatientId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [patientName, setPatientName] = useState<string | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useAutoScroll([messages, loading])
  const { recording, durationSec, start: startRec, stop: stopRec, cancel: cancelRec } = useAudioRecorder()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Resolve params and session
  useEffect(() => {
    void params.then(({ patientId: pid }) => setPatientId(pid))
    void getSafeSupabaseSession().then(({ session }) => setCurrentUserId(session?.user?.id ?? null))
  }, [params])

  const fetchMessages = useCallback(async (pid: string) => {
    try {
      const res = await authenticatedFetch(`/api/messages/${pid}`)
      const data = await res.json()
      if (data.ok) {
        const msgs = (data.messages as DirectMessage[]).slice().reverse()
        setMessages(msgs)
        if (msgs[0]?.senderName && msgs[0]?.senderId !== currentUserId) {
          setPatientName(msgs[0].senderName)
        }
      }
    } catch { /* non-critical */ }
  }, [currentUserId])

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    void fetchMessages(patientId).finally(() => setLoading(false))
    pollRef.current = setInterval(() => void fetchMessages(patientId), 15_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [patientId, fetchMessages])

  // Resolve patient name from patients API if not in messages
  useEffect(() => {
    if (patientName || !patientId) return
    void authenticatedFetch(`/api/social-worker/patients/${patientId}/profile`)
      .then((r) => r.json())
      .then((d) => {
        if (d.first_name || d.last_name) {
          setPatientName([d.first_name, d.last_name].filter(Boolean).join(" "))
        }
      })
      .catch(() => {})
  }, [patientId, patientName])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content || sending || !patientId) return
    setSending(true)
    setDraft("")
    try {
      const res = await authenticatedFetch(`/api/messages/${patientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (data.ok) setMessages((prev) => [...prev, data.message as DirectMessage])
    } finally {
      setSending(false)
    }
  }

  const handleVoiceSend = async () => {
    if (!patientId) return
    const result = await stopRec()
    if (!result || result.blob.size === 0) return
    setSending(true)
    try {
      const form = new FormData()
      form.append("file", result.blob, "voice.webm")
      form.append("type", "voice")
      form.append("durationSec", String(result.durationSec))
      const res = await authenticatedFetch(`/api/messages/${patientId}/upload`, { method: "POST", body: form })
      const data = await res.json()
      if (data.ok) setMessages((prev) => [...prev, data.message as DirectMessage])
    } finally {
      setSending(false)
    }
  }

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !patientId) return
    event.target.value = ""
    setSending(true)
    try {
      const form = new FormData()
      form.append("file", file, file.name)
      form.append("type", "image")
      const res = await authenticatedFetch(`/api/messages/${patientId}/upload`, { method: "POST", body: form })
      const data = await res.json()
      if (data.ok) setMessages((prev) => [...prev, data.message as DirectMessage])
    } finally {
      setSending(false)
    }
  }

  const grouped = groupByDate(messages)
  const displayName = patientName ?? "Patient"

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button asChild size="icon-sm" variant="ghost">
          <Link href="/social-worker/messages"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold">{displayName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" /> Patient
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 px-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">Start the conversation</p>
            <p className="text-xs">Send {displayName} a message to get started.</p>
          </div>
        ) : (
          <div className="space-y-4 py-3">
            {grouped.map(({ date, messages: groupMsgs }) => (
              <div key={date} className="space-y-2">
                <p className="text-center text-xs text-muted-foreground">{formatDateLabel(date)}</p>
                {groupMsgs.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === currentUserId} />
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
          <Button type="button" size="sm" variant="destructive" className="ml-auto h-7 text-xs"
            onClick={() => void handleVoiceSend()} disabled={sending}>
            <Square className="h-3 w-3" /> Send
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelRec}>
            Cancel
          </Button>
        </div>
      )}

      {/* Input bar */}
      {!recording && (
        <form onSubmit={(e) => void handleSubmit(e)} className="border-t px-3 py-2">
          <div className="flex items-center gap-1.5">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => void handleImageChange(e)} />
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Attach image"
              disabled={sending} onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${displayName}…`} disabled={sending} className="flex-1 text-sm" />
            {draft.trim() ? (
              <Button type="submit" size="icon-sm" disabled={sending} aria-label="Send">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              </Button>
            ) : (
              <Button type="button" size="icon-sm" variant="outline" aria-label="Record voice"
                disabled={sending} onClick={() => void startRec()}>
                <Mic className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

// Named import used inline above
function MessageSquare(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
