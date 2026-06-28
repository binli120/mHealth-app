/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Full-screen voice recorder for the voice_message handoff context.
 * Mirrors the recording logic in app/social-worker/messages/[patientId]/page.tsx.
 */
"use client"

import { useCallback, useRef, useState } from "react"
import { Mic, MicOff, Play, RotateCcw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

type RecordState = "idle" | "recording" | "review" | "sending" | "sent"

interface MobileVoiceRecorderProps {
  patientId: string
  conversationId: string
  onSaveAndExit: (progressSummary: Record<string, unknown>) => void
}

export function MobileVoiceRecorder({ patientId, conversationId, onSaveAndExit }: MobileVoiceRecorderProps) {
  const [recordState, setRecordState] = useState<RecordState>("idle")
  const [transcription, setTranscription] = useState("")
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []

      // Optional live transcription (SpeechRecognition not in all TS lib targets)
      type AnySR = { continuous: boolean; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; start: () => void }
      type SRCtor = new () => AnySR
      const win = window as Window & { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
      const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition
      if (SR) {
        const rec = new SR()
        rec.continuous = true
        rec.interimResults = true
        rec.onresult = (e) => {
          const text = Array.from(e.results).map(r => r[0].transcript).join(" ")
          setTranscription(text)
        }
        rec.onerror = () => { /* ignore */ }
        rec.start()
      }

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        blobRef.current = new Blob(chunksRef.current, { type: "audio/webm" })
        setRecordState("review")
      }
      mr.start()
      setRecordState("recording")
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      setError("Could not access microphone. Please allow microphone permission and try again.")
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    mediaRecorderRef.current?.stop()
  }, [])

  const playReview = useCallback(() => {
    if (!blobRef.current) return
    audioRef.current?.pause()
    audioRef.current = new Audio(URL.createObjectURL(blobRef.current))
    void audioRef.current.play()
  }, [])

  const reset = useCallback(() => {
    setRecordState("idle")
    setSeconds(0)
    setTranscription("")
    blobRef.current = null
  }, [])

  const sendVoice = useCallback(async () => {
    if (!blobRef.current) return
    setRecordState("sending")
    const form = new FormData()
    form.append("file", blobRef.current, "voice.webm")
    form.append("type", "voice")
    form.append("transcription", transcription)
    form.append("conversationId", conversationId)
    try {
      await authenticatedFetch(`/api/messages/${patientId}/upload`, {
        method: "POST",
        body: form,
      })
      setRecordState("sent")
      onSaveAndExit({ sent: true, transcription })
    } catch {
      setError("Failed to send. Please try again.")
      setRecordState("review")
    }
  }, [transcription, conversationId, patientId, onSaveAndExit])

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0")
  const ss = String(seconds % 60).padStart(2, "0")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      {error && <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}

      {(recordState === "idle" || recordState === "recording") && (
        <>
          {recordState === "recording" && (
            <p className={cn("font-mono text-2xl font-bold", "text-destructive")}>{mm}:{ss}</p>
          )}
          <button
            onClick={recordState === "idle" ? startRecording : stopRecording}
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-full border-4 transition-colors",
              recordState === "recording"
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-primary bg-primary/10 text-primary",
            )}
            aria-label={recordState === "idle" ? "Start recording" : "Stop recording"}
          >
            {recordState === "idle" ? <Mic className="h-10 w-10" /> : <MicOff className="h-10 w-10" />}
          </button>
          <p className="text-sm text-muted-foreground">
            {recordState === "idle" ? "Tap to record" : "Tap to stop"}
          </p>
          {transcription && <p className="max-w-xs text-center text-sm text-muted-foreground">{transcription}</p>}
        </>
      )}

      {recordState === "review" && (
        <>
          <p className="text-sm font-medium">Review your recording</p>
          {transcription && (
            <p className="max-w-xs rounded-md bg-secondary p-3 text-sm">{transcription}</p>
          )}
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={playReview}><Play className="mr-1.5 h-4 w-4" />Play</Button>
            <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="mr-1.5 h-4 w-4" />Re-record</Button>
            <Button size="sm" onClick={sendVoice}><Send className="mr-1.5 h-4 w-4" />Send</Button>
          </div>
        </>
      )}

      {recordState === "sending" && <p className="text-sm text-muted-foreground">Sending…</p>}
    </div>
  )
}
