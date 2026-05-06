/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * /upload/mobile/[token]
 *
 * Server component — validates the session token at render time (no client-side
 * fetch), then hands off to the MobileUploadCamera client component.
 *
 * Flow:
 *   1. Server reads token from URL, queries DB
 *   2. Invalid/expired → renders static "expired" page (no JS needed)
 *   3. Already completed → renders static "success" page (no JS needed)
 *   4. Pending → renders MobileUploadCamera for the interactive camera UI
 */

import { Camera, CheckCircle2, Clock } from "lucide-react"
import { getUploadSessionByToken } from "@/lib/db/mobile-upload-session"
import { MobileUploadCamera } from "./camera"

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function MobileUploadPage({ params }: PageProps) {
  const { token } = await params

  if (!token?.trim()) {
    return <ExpiredView />
  }

  let session
  try {
    session = await getUploadSessionByToken(token)
  } catch {
    return <ExpiredView />
  }

  if (!session || session.status === "expired") {
    return <ExpiredView />
  }

  if (session.status === "completed") {
    return <SuccessView />
  }

  // Pending — show the interactive camera upload UI
  return (
    <Shell documentLabel={session.requiredDocumentLabel}>
      <MobileUploadCamera
        token={token}
        documentLabel={session.requiredDocumentLabel}
        documentType={session.documentType}
      />
    </Shell>
  )
}

// ─── Static views (no JS required) ────────────────────────────────────────────

function Shell({
  documentLabel,
  children,
}: {
  documentLabel?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <span className="font-semibold">Document Upload</span>
        </div>
        {documentLabel && (
          <p className="mt-0.5 text-sm text-muted-foreground">{documentLabel}</p>
        )}
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {children}
      </main>
    </div>
  )
}

function ExpiredView() {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <Clock className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold">Link Expired</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          This upload link has expired or is no longer valid. Please go back to the
          desktop and click &ldquo;Use Camera&rdquo; again to get a new QR code.
        </p>
      </div>
    </Shell>
  )
}

function SuccessView() {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold">Already Uploaded</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          This document has already been uploaded. You can return to the desktop.
        </p>
      </div>
    </Shell>
  )
}
