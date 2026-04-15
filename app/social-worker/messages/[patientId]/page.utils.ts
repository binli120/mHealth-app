/**
 * Utilities for the Social Worker Patient Conversation page.
 * @author Bin Lee
 */

import { useCallback, useRef, useState } from "react"
import type { DirectMessage, GroupedMessages } from "./page.types"

export function formatConversationDateLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

export function groupMessagesByDate(messages: DirectMessage[]): GroupedMessages[] {
  const groups = new Map<string, DirectMessage[]>()
  for (const message of [...messages].reverse()) {
    const key = new Date(message.createdAt).toDateString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(message)
  }
  return Array.from(groups.values()).map((group) => ({ date: group[0].createdAt, messages: group }))
}

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false)
  const [durationSec, setDurationSec] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      chunksRef.current = []
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      mediaRecorder.start()
      mediaRef.current = mediaRecorder
      setRecording(true)
      setDurationSec(0)
      timerRef.current = setInterval(() => setDurationSec((seconds) => seconds + 1), 1000)
    } catch {
      // Ignore unavailable microphones.
    }
  }, [])

  const stop = useCallback((): Promise<{ blob: Blob; durationSec: number } | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRef.current
      if (!mediaRecorder) {
        resolve(null)
        return
      }

      const currentDuration = durationSec
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        mediaRecorder.stream.getTracks().forEach((track) => track.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        setRecording(false)
        setDurationSec(0)
        mediaRef.current = null
        resolve({ blob, durationSec: currentDuration })
      }
      mediaRecorder.stop()
    })
  }, [durationSec])

  const cancel = useCallback(() => {
    mediaRef.current?.stream.getTracks().forEach((track) => track.stop())
    mediaRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setDurationSec(0)
  }, [])

  return { recording, durationSec, start, stop, cancel }
}
