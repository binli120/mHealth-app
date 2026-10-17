/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export type Saca2SaveStatusValue = "idle" | "saving" | "saved" | "error"

interface Saca2SaveStatusProps {
  status: Saca2SaveStatusValue
  onRetry: () => void
}

export function Saca2SaveStatus({ status, onRetry }: Saca2SaveStatusProps) {
  // Keep the clicked button mounted (disabled) while the retry is in flight so focus is not lost.
  const [retrying, setRetrying] = useState(false)
  const [prevStatus, setPrevStatus] = useState(status)
  if (prevStatus !== status) {
    setPrevStatus(status)
    if (prevStatus === "saving") setRetrying(false)
  }
  const showRetrying = retrying && status === "saving"

  const showButton = status === "error" || showRetrying

  return (
    <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
      <span className={`flex items-center gap-2 ${status === "error" ? "text-destructive" : ""}`}>
        {status === "saving" ? <span>Saving…</span> : null}
        {status === "saved" ? <span>All changes saved</span> : null}
        {status === "error" ? <span>Couldn&apos;t save your changes</span> : null}
        {showButton ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={status !== "error"}
            onClick={() => {
              setRetrying(true)
              onRetry()
            }}
          >
            {status === "error" ? "Retry" : "Retrying…"}
          </Button>
        ) : null}
      </span>
    </div>
  )
}
