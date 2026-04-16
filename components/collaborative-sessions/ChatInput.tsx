/**
 * ChatInput
 * Text area + send button + voice recorder.
 *
 * Voice recording:
 *   • Click the mic button → starts recording (red pulse ring appears)
 *   • Click the mic button again → stops recording and uploads via
 *     POST /api/sessions/[sessionId]/voice  (multipart formdata)
 *   • On success the returned SessionMessage is passed to onMessageSent
 *     so the caller can broadcast it to the realtime channel.
 *
 * Text:
 *   • Enter (without Shift) or the ➤ button sends the message via
 *     POST /api/sessions/[sessionId]/messages
 *   • Shift+Enter inserts a newline
 *
 * @author Bin Lee
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Send, Mic, MicOff, Loader2 } from "lucide-react"

import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { toUserFacingError } from "@/lib/errors/user-facing"
import type { SessionMessage } from "@/lib/collaborative-sessions/types"

interface Props {
  sessionId: string
  disabled?: boolean
  onMessageSent: (message: SessionMessage) => void
}

type RecordingState = "idle" | "recording" | "uploading"

export function ChatInput({ sessionId, disabled = false, onMessageSent }: Props) {
  const [text, setText]           = useState("")
  const [sending, setSending]     = useState(false)
  const [recState, setRecState]   = useState<RecordingState>("idle")
  const [recSeconds, setRecSeconds] = useState(0)
  const [error, setError]         = useState<string | null>(null)

  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const recorderRef   = useRef<MediaRecorder | null>(null)
  const chunksRef     = useRef<BlobPart[]>([])
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text])

  // ── Text send ───────────────────────────────────────────────────────────────

  const sendText = useCallback(async () => {
    const content = text.trim()
    if (!content || sending || disabled) return
    setSending(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = (await res.json()) as { ok: boolean; message?: SessionMessage; error?: string }
      if (!data.ok) {
        setError(toUserFacingError(data.error, "Failed to send message."))
        return
      }
      setText("")
      onMessageSent(data.message!)
    } catch (error) {
      setError(toUserFacingError(error, "Failed to send message."))
    } finally {
      setSending(false)
      // Re-focus so the user can keep typing
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [text, sending, disabled, sessionId, onMessageSent])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendText()
    }
  }

  // ── Voice recording ─────────────────────────────────────────────────────────

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg"

      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Stop all tracks to release the mic
        stream.getTracks().forEach((t) => t.stop())

        const blob      = new Blob(chunksRef.current, { type: mimeType })
        const duration  = recSeconds
        chunksRef.current = []
        setRecSeconds(0)

        await uploadVoice(blob, mimeType, duration)
      }

      recorder.start(200) // Collect data in 200ms chunks
      recorderRef.current = recorder
      setRecState("recording")

      // Tick counter
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000)
    } catch {
      setError("Microphone access denied or unavailable.")
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecState("uploading")
  }

  async function uploadVoice(blob: Blob, mimeType: string, durationSec: number) {
    setError(null)
    try {
      const form = new FormData()
      form.append("audio", blob, `voice.${mimeType.split("/")[1].split(";")[0]}`)
      form.append("durationSec", String(durationSec))

      const res = await authenticatedFetch(`/api/sessions/${sessionId}/voice`, {
        method: "POST",
        body: form,
      })
      const data = (await res.json()) as { ok: boolean; message?: SessionMessage; error?: string }
      if (!data.ok) {
        setError(toUserFacingError(data.error, "Failed to upload voice message."))
        return
      }
      onMessageSent(data.message!)
    } catch (error) {
      setError(toUserFacingError(error, "Failed to upload voice message."))
    } finally {
      setRecState("idle")
    }
  }

  function handleMicClick() {
    if (disabled) return
    if (recState === "idle")      { startRecording() }
    else if (recState === "recording") { stopRecording() }
    // "uploading" — button is disabled, do nothing
  }

  function formatRecSec(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const isRecording  = recState === "recording"
  const isUploading  = recState === "uploading"
  const inputDisabled = disabled || isRecording || isUploading || sending

  return (
    <div className="flex flex-col gap-1">
      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}

      {/* Recording status */}
      {isRecording && (
        <div className="flex items-center gap-2 text-xs text-red-500 px-1 animate-pulse">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          Recording… {formatRecSec(recSeconds)} — click mic to stop
        </div>
      )}
      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Uploading voice…
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 bg-white border border-gray-200 rounded-2xl px-3 py-2 shadow-sm">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={inputDisabled}
          placeholder={disabled ? "Session is not active" : "Type a message… (Enter to send)"}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none min-h-[24px] max-h-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Mic button */}
        <button
          onClick={handleMicClick}
          disabled={disabled || isUploading}
          title={isRecording ? "Stop recording" : "Record voice message"}
          className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors
            ${isRecording
              ? "bg-red-500 text-white animate-pulse"
              : "text-gray-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-40"
            }
          `}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Send button */}
        <button
          onClick={sendText}
          disabled={!text.trim() || inputDisabled}
          title="Send message"
          className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send   className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  )
}
