"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Smartphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { HandoffState } from "./use-handoff"

interface HandoffWaitOverlayProps {
  state: HandoffState
  mobileUrl: string | null
  expiresAt: Date | null
  onCancel: () => void
  contextLabel?: string // e.g. "Intake Chat"
}

function useCountdown(expiresAt: Date | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : 0,
  )
  useEffect(() => {
    if (!expiresAt) return
    const id = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return secondsLeft
}

export function HandoffWaitOverlay({ state, mobileUrl, expiresAt, onCancel, contextLabel = "Task" }: HandoffWaitOverlayProps) {
  const secondsLeft = useCountdown(expiresAt)
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0")
  const ss = String(secondsLeft % 60).padStart(2, "0")
  const qrUrl = mobileUrl ? `/api/identity/qrcode?url=${encodeURIComponent(mobileUrl)}` : null

  if (state === "idle" || state === "creating" || state === "error") return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border bg-card p-8 shadow-lg">
        {/* Cancel */}
        {state !== "completed" && (
          <button
            onClick={onCancel}
            className="absolute right-3 top-3 rounded-sm opacity-70 hover:opacity-100"
            aria-label="Cancel mobile handoff"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {state === "waiting_scan" && qrUrl && (
          <>
            <p className="text-center text-sm font-medium">Scan with your phone to continue</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR code to open on mobile" className="h-48 w-48 rounded-md border" />
            <p className={cn("font-mono text-sm", secondsLeft < 60 ? "text-destructive" : "text-muted-foreground")}>
              Expires in {mm}:{ss}
            </p>
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          </>
        )}

        {state === "in_progress" && (
          <>
            <div className="relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <Smartphone className="h-10 w-10 text-primary" />
            </div>
            <p className="text-center text-sm font-medium">{contextLabel} is in progress on your phone</p>
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          </>
        )}

        {state === "completed" && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-center text-sm font-medium">Done! Your progress has been saved.</p>
          </>
        )}
      </div>
    </div>
  )
}
