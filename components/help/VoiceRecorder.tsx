'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VoiceRecorderProps {
  onRecorded: (file: File | null) => void
}

export function VoiceRecorder({ onRecorded }: VoiceRecorderProps) {
  const [state, setState]         = useState<'idle' | 'recording' | 'done'>('idle')
  const [audioUrl, setAudioUrl]   = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Stop the microphone if the component unmounts while recording
  useEffect(() => {
    return () => {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        mediaRef.current.stop()
      }
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRef.current  = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size > 10 * 1024 * 1024) {
          setError('Recording exceeds 10 MB limit.')
          setState('idle')
          onRecorded(null)
          return
        }
        const file = new File([blob], 'voice.webm', { type: 'audio/webm' })
        const url  = URL.createObjectURL(blob)
        setAudioUrl(url)
        setState('done')
        onRecorded(file)
      }

      recorder.start()
      setState('recording')
    } catch {
      setError('Microphone access denied.')
    }
  }, [onRecorded])

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop()
  }, [])

  const clearRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setState('idle')
    onRecorded(null)
  }, [audioUrl, onRecorded])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {state === 'idle' && (
          <Button type="button" variant="outline" size="sm" onClick={startRecording}>
            <Mic className="mr-2 h-4 w-4" /> Record voice
          </Button>
        )}
        {state === 'recording' && (
          <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
            <Square className="mr-2 h-4 w-4" /> Stop recording
          </Button>
        )}
        {state === 'done' && audioUrl && (
          <>
            <audio controls src={audioUrl} className="h-8 flex-1" />
            <Button type="button" variant="ghost" size="icon" onClick={clearRecording} aria-label="Remove recording">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
