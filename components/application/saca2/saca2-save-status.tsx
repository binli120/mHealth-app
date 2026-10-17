/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { Button } from "@/components/ui/button"

export type Saca2SaveStatusValue = "idle" | "saving" | "saved" | "error"

interface Saca2SaveStatusProps {
  status: Saca2SaveStatusValue
  onRetry: () => void
}

export function Saca2SaveStatus({ status, onRetry }: Saca2SaveStatusProps) {
  return (
    <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
      {status === "saving" ? <span>Saving…</span> : null}
      {status === "saved" ? <span>All changes saved</span> : null}
      {status === "error" ? (
        <span className="flex items-center gap-2 text-destructive">
          <span>Couldn&apos;t save your changes</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </span>
      ) : null}
    </div>
  )
}
