/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, Camera, X, FileText, CheckCircle2, Loader2, ZoomIn, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

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
  fileSizeBytes: number | null
  mimeType: string | null
  documentStatus: string
  uploadedAt: string
  /** Time-limited signed URL for preview / download */
  signedUrl: string | null
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentUploader({
  applicationId,
  documentType,
  requiredDocumentLabel,
  title,
  description,
  accept = "image/*,application/pdf",
  onDocumentUpload,
  onDocumentRemove,
}: DocumentUploaderProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [document, setDocument] = useState<UploadedDocument | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

        // Find the most recent document matching this documentType (if specified)
        const match = documentType
          ? payload.documents.find((d) => d.documentType === documentType)
          : payload.documents[0]

        if (match) {
          setDocument(match)
          setUploadStatus("uploaded")
        }
      } catch {
        // Non-fatal — user can upload fresh
      }
    }

    void loadExistingDocument()
    return () => {
      cancelled = true
    }
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
          setErrorMessage(payload.error)
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
        setErrorMessage(payload.error ?? "Failed to remove document.")
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
    }
  }, [applicationId, document, onDocumentRemove])

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
      <div className="space-y-3">
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
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Use Camera
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Drag and drop or click to upload · PDF, JPG, PNG, WebP, HEIC (max 10 MB)
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: uploading / uploaded card
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept={accept} className="hidden" />

      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Preview / icon */}
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
              {document?.signedUrl && document.mimeType?.startsWith("image/") ? (
                <>
                  <Image
                    src={document.signedUrl}
                    alt={document.fileName ?? "document"}
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </div>
                )}
                {uploadStatus === "uploaded" && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Uploaded successfully
                    {document?.documentStatus === "verified" && " · Verified"}
                    {document?.documentStatus === "pending_review" && " · Pending review"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Download link */}
          {document?.signedUrl && (
            <div className="mt-3 border-t border-border pt-3">
              <a
                href={document.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                View / download
              </a>
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
