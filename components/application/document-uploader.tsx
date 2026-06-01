/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Upload,
  Camera,
  X,
  FileText,
  CheckCircle2,
  BadgeCheck,
  Loader2,
  ZoomIn,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { toUserFacingError } from "@/lib/errors/user-facing"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadedDocument {
  id: string
  applicationId: string
  documentType: string | null
  requiredDocumentLabel: string | null
  fileName: string | null
  filePath: string | null
  thumbnailPath: string | null
  pdfPath: string | null
  fileSizeBytes: number | null
  mimeType: string | null
  documentStatus: string
  analysisDocumentType: string | null
  validationStatus: "not_required" | "pending" | "analyzing" | "valid" | "invalid" | "error"
  validationError: string | null
  validationSummary: Record<string, unknown> | null
  validationCertificate: Record<string, unknown> | null
  analyzedAt: string | null
  uploadedAt: string
  /** Time-limited signed URL for preview / download */
  signedUrl: string | null
  /** Time-limited signed URL for the derived storage thumbnail */
  thumbnailSignedUrl: string | null
  pdfSignedUrl: string | null
}

interface DocumentUploaderProps {
  /** Application this document belongs to — required for real storage */
  applicationId: string
  /** Logical document type stored in the DB, e.g. "paystub", "id" */
  documentType?: string
  /** Human-readable label shown in the UI, e.g. "MA Driver's License" */
  requiredDocumentLabel?: string
  title: string
  description: string
  /** File accept string — defaults to images + PDF */
  accept?: string
  /** Called after a successful upload with the full document record */
  onDocumentUpload?: (doc: UploadedDocument) => void
  /** Called after a successful delete */
  onDocumentRemove?: (documentId: string) => void
}

type UploadStatus = "idle" | "uploading" | "uploaded" | "error"
type ValidationStage = "saving" | "analyzing" | "validating"

const VALIDATION_STAGE_COPY: Record<ValidationStage, { label: string; progress: number }> = {
  saving: { label: "Saving document…", progress: 30 },
  analyzing: { label: "Analyzing document…", progress: 68 },
  validating: { label: "Validating application data…", progress: 92 },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when running in a mobile browser (phone / tablet). */
function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function getValidationStatusLabel(document: UploadedDocument | null): string {
  if (!document) return "Saving document…"
  switch (document.validationStatus) {
    case "valid":
      return "Document validated"
    case "invalid":
      return "Document validation failed"
    case "error":
      return "Document validation unavailable"
    case "pending":
    case "analyzing":
      return "Document validation in progress"
    default:
      return "Uploaded successfully"
  }
}

// ---------------------------------------------------------------------------
// QR Code Dialog (desktop → phone camera)
// ---------------------------------------------------------------------------

interface QrUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  documentType?: string
  requiredDocumentLabel?: string
  onCompleted: () => void
}

type QrDialogState = "creating" | "waiting" | "expired" | "error"

function QrUploadDialog({
  open,
  onOpenChange,
  applicationId,
  documentType,
  requiredDocumentLabel,
  onCompleted,
}: QrUploadDialogProps) {
  const [dialogState, setDialogState] = useState<QrDialogState>("creating")
  const [mobileUrl, setMobileUrl] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  // Create session when dialog opens; reset state in cleanup when it closes
  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function createSession() {
      setDialogState("creating")
      try {
        const res = await authenticatedFetch(
          `/api/applications/${applicationId}/mobile-upload-session`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentType, requiredDocumentLabel }),
          },
        )
        const data = (await res.json()) as {
          ok: boolean
          token?: string
          mobileUrl?: string
          expiresAt?: string
          error?: string
        }

        if (cancelled) return

        if (!data.ok || !data.token || !data.mobileUrl) {
          setDialogState("error")
          return
        }

        setToken(data.token)
        setMobileUrl(data.mobileUrl)
        const exp = new Date(data.expiresAt ?? Date.now() + 15 * 60_000)
        setExpiresAt(exp)
        setDialogState("waiting")
      } catch {
        if (!cancelled) setDialogState("error")
      }
    }

    void createSession()

    return () => {
      cancelled = true
      clearTimers()
      // Reset dialog back to initial state so it's clean on next open
      setDialogState("creating")
      setMobileUrl(null)
      setToken(null)
      setExpiresAt(null)
      setSecondsLeft(null)
    }
  }, [open, applicationId, documentType, requiredDocumentLabel, clearTimers])

  // Poll for completion once we have a token
  useEffect(() => {
    if (dialogState !== "waiting" || !token) {
      clearTimers()
      return
    }

    // Countdown timer
    countdownRef.current = setInterval(() => {
      if (!expiresAt) return
      const secs = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000))
      setSecondsLeft(secs)
      if (secs <= 0) {
        clearTimers()
        setDialogState("expired")
      }
    }, 1000)

    // Poll session status every 3 s
    pollRef.current = setInterval(async () => {
      try {
        const res = await authenticatedFetch(
          `/api/applications/${applicationId}/mobile-upload-session?token=${encodeURIComponent(token)}`,
        )
        const data = (await res.json()) as { ok: boolean; status?: string }
        if (data.ok && data.status === "completed") {
          clearTimers()
          onOpenChange(false)
          onCompleted()
        } else if (data.ok && data.status === "expired") {
          clearTimers()
          setDialogState("expired")
        }
      } catch {
        // Non-fatal — keep polling
      }
    }, 3000)

    return clearTimers
  }, [dialogState, token, expiresAt, applicationId, clearTimers, onOpenChange, onCompleted])

  const qrSrc = mobileUrl
    ? `/api/identity/qrcode?url=${encodeURIComponent(mobileUrl)}`
    : null

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Use Mobile Camera
          </DialogTitle>
          <DialogDescription>
            Scan the QR code with your phone to take a photo of the document.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {dialogState === "creating" && (
            <div className="flex flex-col items-center gap-2 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Generating QR code…</p>
            </div>
          )}

          {dialogState === "waiting" && qrSrc && (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-white p-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt="QR code to open document upload on mobile"
                  width={220}
                  height={220}
                  className="block"
                />
              </div>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for photo…
              </div>

              {secondsLeft !== null && secondsLeft > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Expires in {formatTime(secondsLeft)}
                </div>
              )}

              <p className="text-center text-xs text-muted-foreground">
                Open your phone&rsquo;s camera app and point it at the QR code above.
              </p>
            </>
          )}

          {dialogState === "expired" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">QR code expired</p>
              <p className="text-xs text-muted-foreground">
                The link has expired. Generate a new QR code to try again.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setDialogState("creating")
                  setToken(null)
                  setMobileUrl(null)
                  // Re-trigger by toggling open — easier: just call onOpenChange(false) then true
                  onOpenChange(false)
                  setTimeout(() => onOpenChange(true), 50)
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generate New QR Code
              </Button>
            </div>
          )}

          {dialogState === "error" && (
            <div className="flex flex-col items-center gap-2 py-4 text-center text-sm text-destructive">
              <AlertCircle className="h-6 w-6" />
              Failed to create upload session. Please try again.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentUploader({
  applicationId,
  documentType,
  requiredDocumentLabel,
  title,
  description,
  accept = "image/*,.tif,.tiff,application/pdf",
  onDocumentUpload,
  onDocumentRemove,
}: DocumentUploaderProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [document, setDocument] = useState<UploadedDocument | null>(null)
  const [validationStage, setValidationStage] = useReducer((_prev: ValidationStage, next: ValidationStage) => next, "saving" as ValidationStage)
  const [isDragging, setIsDragging] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (uploadStatus !== "uploading") {
      setValidationStage("saving")
      return
    }

    setValidationStage("saving")
    const timers = [
      window.setTimeout(() => setValidationStage("analyzing"), 900),
      window.setTimeout(() => setValidationStage("validating"), 2400),
    ]

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [uploadStatus])

  // ---------------------------------------------------------------------------
  // On mount: load any previously uploaded document for this type
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function loadExistingDocument() {
      try {
        const res = await authenticatedFetch(
          `/api/applications/${applicationId}/documents`,
        )
        const payload = (await res.json()) as
          | { ok: true; documents: UploadedDocument[] }
          | { ok: false; error: string }

        if (!payload.ok || cancelled) return

        const match = documentType
          ? payload.documents.find((d) => d.documentType === documentType)
          : payload.documents[0]

        if (match) {
          setDocument(match)
          setUploadStatus("uploaded")
        }
      } catch {
        // Non-fatal
      }
    }

    void loadExistingDocument()
    return () => { cancelled = true }
  }, [applicationId, documentType])

  // ---------------------------------------------------------------------------
  // Upload handler
  // ---------------------------------------------------------------------------
  const handleFileSelect = useCallback(
    async (file: File) => {
      setUploadStatus("uploading")
      setErrorMessage(null)

      const formData = new FormData()
      formData.append("file", file)
      if (documentType) formData.append("documentType", documentType)
      if (requiredDocumentLabel) formData.append("requiredDocumentLabel", requiredDocumentLabel)

      try {
        const res = await authenticatedFetch(
          `/api/applications/${applicationId}/documents`,
          { method: "POST", body: formData },
        )

        const payload = (await res.json()) as
          | { ok: true; document: UploadedDocument }
          | { ok: false; error: string }

        if (!payload.ok) {
          setUploadStatus("error")
          setErrorMessage(toUserFacingError(payload.error, { fallback: "Upload failed. Please try again.", context: "upload" }))
          return
        }

        setDocument(payload.document)
        setUploadStatus("uploaded")
        onDocumentUpload?.(payload.document)
      } catch {
        setUploadStatus("error")
        setErrorMessage("Upload failed. Please try again.")
      }
    },
    [applicationId, documentType, requiredDocumentLabel, onDocumentUpload],
  )

  // ---------------------------------------------------------------------------
  // Reload document after mobile upload completes
  // ---------------------------------------------------------------------------
  const handleMobileUploadCompleted = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`/api/applications/${applicationId}/documents`)
      const payload = (await res.json()) as
        | { ok: true; documents: UploadedDocument[] }
        | { ok: false; error: string }

      if (!payload.ok) return

      const match = documentType
        ? payload.documents.find((d) => d.documentType === documentType)
        : payload.documents[0]

      if (match) {
        setDocument(match)
        setUploadStatus("uploaded")
        onDocumentUpload?.(match)
      }
    } catch {
      // Non-fatal — user can refresh
    }
  }, [applicationId, documentType, onDocumentUpload])

  // ---------------------------------------------------------------------------
  // Remove handler
  // ---------------------------------------------------------------------------
  const handleRemove = useCallback(async () => {
    if (!document) return
    setIsRemoving(true)

    try {
      const res = await authenticatedFetch(
        `/api/applications/${applicationId}/documents/${document.id}`,
        { method: "DELETE" },
      )
      const payload = (await res.json()) as { ok: boolean; error?: string }

      if (!payload.ok) {
        setErrorMessage(toUserFacingError(payload.error, "Failed to remove document."))
        setIsRemoving(false)
        return
      }

      const removedId = document.id
      setDocument(null)
      setUploadStatus("idle")
      setErrorMessage(null)
      onDocumentRemove?.(removedId)
    } catch {
      setErrorMessage("Failed to remove document. Please try again.")
    } finally {
      setIsRemoving(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (cameraInputRef.current) cameraInputRef.current.value = ""
    }
  }, [applicationId, document, onDocumentRemove])

  // ---------------------------------------------------------------------------
  // Camera button handler — mobile uses native capture, desktop shows QR
  // ---------------------------------------------------------------------------
  const handleCameraClick = useCallback(() => {
    if (isMobileBrowser()) {
      cameraInputRef.current?.click()
    } else {
      setQrDialogOpen(true)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Drag-and-drop helpers
  // ---------------------------------------------------------------------------
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFileSelect(file)
  }

  // ---------------------------------------------------------------------------
  // Render: drop zone
  // ---------------------------------------------------------------------------
  if (uploadStatus === "idle" || uploadStatus === "error") {
    return (
      <>
        <div className="space-y-3">
          {/* Browse files input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFileSelect(file)
            }}
          />
          {/* Mobile camera capture input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFileSelect(file)
            }}
          />

          <div
            className={cn(
              "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
            <h4 className="mt-3 font-medium text-foreground">{title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Browse Files
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={handleCameraClick}
              >
                <Camera className="h-4 w-4" />
                Use Camera
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Drag and drop or click to upload · PDF, JPG, PNG, WebP, TIFF, HEIC (max 10 MB)
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
          )}
        </div>

        {/* QR dialog for desktop camera flow */}
        <QrUploadDialog
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
          applicationId={applicationId}
          documentType={documentType}
          requiredDocumentLabel={requiredDocumentLabel}
          onCompleted={() => void handleMobileUploadCompleted()}
        />
      </>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: uploading / uploaded card
  // ---------------------------------------------------------------------------
  const previewUrl =
    document?.thumbnailSignedUrl ??
    (document?.mimeType?.startsWith("image/") ? document.signedUrl : null)
  const stage = VALIDATION_STAGE_COPY[validationStage]

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept={accept} className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" />

      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Preview / icon */}
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
              {previewUrl ? (
                <>
                  <Image
                    src={previewUrl}
                    alt={document?.fileName ?? "document"}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <button className="absolute inset-0 flex items-center justify-center bg-foreground/50 opacity-0 transition-opacity hover:opacity-100">
                    <ZoomIn className="h-6 w-6 text-background" />
                  </button>
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {document?.fileName ?? "Uploading…"}
                  </p>
                  {document?.fileSizeBytes != null && (
                    <p className="text-sm text-muted-foreground">
                      {(document.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                  {document?.requiredDocumentLabel && (
                    <p className="text-xs text-muted-foreground">{document.requiredDocumentLabel}</p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => void handleRemove()}
                  disabled={isRemoving || uploadStatus === "uploading"}
                  aria-label="Remove document"
                >
                  {isRemoving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Status badge */}
              <div className="mt-2">
                {uploadStatus === "uploading" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {stage.label}
                    </div>
                    <Progress value={stage.progress} className="h-2" />
                  </div>
                )}
                {uploadStatus === "uploaded" && (
                  <>
                    <div
                      className={cn(
                        "flex items-center gap-2 text-sm",
                        document?.validationStatus === "valid" && "text-success",
                        document?.validationStatus === "invalid" && "text-destructive",
                        document?.validationStatus === "error" && "text-amber-600",
                        (!document || document.validationStatus === "not_required") && "text-success",
                      )}
                    >
                      {document?.validationStatus === "valid" ? (
                        <BadgeCheck className="h-4 w-4" />
                      ) : document?.validationStatus === "invalid" || document?.validationStatus === "error" ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {getValidationStatusLabel(document)}
                    </div>
                    {document?.validationCertificate && (
                      <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        Validation certificate issued {document.analyzedAt ? new Date(document.analyzedAt).toLocaleString() : "now"}.
                      </div>
                    )}
                    {document?.validationError && (
                      <div className="mt-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {document.validationError}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Download link */}
          {(document?.signedUrl || document?.pdfSignedUrl) && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex gap-3">
                {document?.signedUrl && (
                  <a
                    href={document.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    View original
                  </a>
                )}
                {document?.pdfSignedUrl && (
                  <a
                    href={document.pdfSignedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    View PDF
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}
    </div>
  )
}
