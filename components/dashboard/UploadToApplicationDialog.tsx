/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { ParseApplicationErrorResponse, ParseApplicationResponse } from "@/app/api/documents/parse-application/route"
import type { ApplicationFormData } from "@/lib/redux/features/application-slice"

const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/tiff"
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const PREFILL_KEY_PREFIX = "form-doc-prefill-"

type UploadState =
  | { status: "idle" }
  | { status: "extracting"; fileName: string }
  | { status: "ready"; fileName: string; formData: Partial<ApplicationFormData>; fieldsFound: string[] }
  | { status: "error"; fileName: string; message: string; hint?: string }

function storeAndGetKey(formData: Partial<ApplicationFormData>): string {
  const key = `${PREFILL_KEY_PREFIX}${crypto.randomUUID()}`
  try {
    sessionStorage.setItem(key, JSON.stringify(formData))
  } catch {
    // sessionStorage full or unavailable — proceed without prefill
  }
  return key
}

interface UploadToApplicationDialogProps {
  children: React.ReactNode
}

export function UploadToApplicationDialog({ children }: UploadToApplicationDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<UploadState>({ status: "idle" })
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setState({ status: "idle" })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) {
      setState({ status: "error", fileName: file.name, message: "File exceeds 10 MB limit." })
      return
    }

    setState({ status: "extracting", fileName: file.name })

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await authenticatedFetch("/api/documents/parse-application", {
        method: "POST",
        body: formData,
      })

      const payload = (await res.json()) as ParseApplicationResponse | ParseApplicationErrorResponse

      if (!payload.ok) {
        const err = payload as ParseApplicationErrorResponse
        let message = err.error || "Could not read the document. Please try another file."
        let hint: string | undefined

        if (err.errorCode === "not_masshealth_form") {
          message = "This doesn't look like a MassHealth application."
          hint = "Please upload your ACA-3 or other MassHealth form. You can still start your application without a document."
        } else if (err.errorCode === "suspicious_content") {
          message = "This file was rejected for security reasons."
          hint = "Please upload a valid MassHealth PDF. If this is unexpected, try downloading a fresh copy of the form."
        }

        setState({ status: "error", fileName: file.name, message, hint })
        return
      }

      const parsed = payload as ParseApplicationResponse
      setState({ status: "ready", fileName: file.name, formData: parsed.formData, fieldsFound: parsed.fieldsFound })
    } catch {
      setState({
        status: "error",
        fileName: file.name,
        message: "Upload failed. Please check your connection and try again.",
      })
    }
  }, [])

  const handleStartApplication = useCallback(() => {
    if (state.status !== "ready") return
    const key = storeAndGetKey(state.formData)
    setOpen(false)
    router.push(`/application/new?prefillKey=${encodeURIComponent(key)}`)
  }, [state, router])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }, [handleFile])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }, [reset])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload a Form
          </DialogTitle>
          <DialogDescription>
            Upload a PDF or photo of a filled-out MassHealth form. We&apos;ll extract the
            information and use it to pre-fill your application.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />

          {/* Idle / drop zone */}
          {state.status === "idle" && (
            <div
              className={cn(
                "cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click() }}
              aria-label="Click or drag a file to upload"
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">
                Drop your file here, or click to browse
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                PDF, JPG, PNG, WebP, HEIC — max 10 MB
              </p>
            </div>
          )}

          {/* Extracting */}
          {state.status === "extracting" && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="font-medium text-foreground">Reading your document…</p>
                <p className="mt-1 text-sm text-muted-foreground truncate max-w-xs">{state.fileName}</p>
              </div>
            </div>
          )}

          {/* Ready */}
          {state.status === "ready" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">Document ready</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{state.fileName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {state.status === "ready" && state.fieldsFound.length > 0
                      ? `Found ${state.fieldsFound.length} field${state.fieldsFound.length === 1 ? "" : "s"}. Compass will pre-fill them and ask about the rest.`
                      : "We read your document. Start your application and Compass will guide you through the fields."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleStartApplication}>
                  Start Application
                </Button>
                <Button variant="outline" onClick={reset}>
                  Upload Different File
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {state.status === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">{state.message}</p>
                  {state.hint && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{state.hint}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={reset}>
                  Try Again
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpen(false)
                    router.push("/application/new")
                  }}
                >
                  Start Without Upload
                </Button>
              </div>
            </div>
          )}

          {/* Footer hint when idle */}
          {state.status === "idle" && (
            <p className="text-center text-xs text-muted-foreground">
              Your document is processed securely and never stored permanently.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
