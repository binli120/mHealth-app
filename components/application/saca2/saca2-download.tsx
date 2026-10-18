/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

interface Saca2DownloadProps {
  applicationId: string
  /** The `buildSaca2Snapshot` shape ({ schemaVersion, data, ... }). Sent once to the fill route; never stored or logged. */
  wizardState: object
  actingForPatientId?: string
}

const FILL_URL = "/api/forms/saca2/fill"
const FILE_NAME = "SACA-2-application.pdf"

const SIGNATURE_NOTE = "Print, sign, and date the form yourself — signatures and consents are never filled in for you."
const RATE_LIMIT_MESSAGE = "Too many downloads, try again in a few minutes."
const FIT_MESSAGE =
  "Some answers could not be placed on the form. Please review the long lists (IRS years, Supplement B people, or Supplement D jobs) and try again, or contact support."
const RETRY_MESSAGE = "We couldn’t prepare your PDF. Please try again."

function messageForStatus(status: number): string {
  if (status === 429) return RATE_LIMIT_MESSAGE
  if (status === 422) return FIT_MESSAGE
  return RETRY_MESSAGE
}

function saveBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = FILE_NAME
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Let the browser start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function Saca2Download({ applicationId, wizardState, actingForPatientId }: Saca2DownloadProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const handleDownload = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (actingForPatientId) headers["X-Acting-For-Patient"] = actingForPatientId
      const response = await authenticatedFetch(FILL_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ applicationId, wizardState }),
      })
      if (!response.ok) {
        setError(messageForStatus(response.status))
        return
      }
      saveBlob(await response.blob())
    } catch {
      setError(RETRY_MESSAGE)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={() => void handleDownload()} disabled={pending}>
        {pending ? "Preparing your PDF…" : "Download your filled SACA-2 (PDF)"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p role="note" className="text-sm text-muted-foreground">
        {SIGNATURE_NOTE}
      </p>
    </div>
  )
}
