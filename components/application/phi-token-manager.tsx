"use client"

import { useCallback, useRef, useState } from "react"
import { CheckCircle2, Copy, Download, FileKey2, ShieldCheck, Upload, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { type PhiToken, serializeToken } from "@/lib/phi-token/token"

// ─── Export dialog ────────────────────────────────────────────────────────────

interface PhiTokenExportDialogProps {
  token: PhiToken
  applicationId: string
  onDismiss: () => void
}

export function PhiTokenExportDialog({
  token,
  applicationId,
  onDismiss,
}: PhiTokenExportDialogProps) {
  const [copied, setCopied] = useState(false)
  const tokenString = serializeToken(token)

  const handleDownload = useCallback(() => {
    const blob = new Blob([tokenString], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `healthcompass-draft-${applicationId.slice(0, 8)}.token`
    a.click()
    URL.revokeObjectURL(url)
  }, [tokenString, applicationId])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(tokenString)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }, [tokenString])

  return (
    <Dialog open onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="max-w-md">
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileKey2 className="h-5 w-5 text-blue-600 shrink-0" />
            Save your progress
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Your workflow progress is saved on our server. To protect your privacy, personal
            information — SSN, date of birth, address, household details — is stored{" "}
            <strong>only in this file</strong>, never on our servers. Keep it safe to resume later.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-amber-50 border-amber-200">
          <ShieldCheck className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-800 text-sm ml-2">
            Without this file you will need to re-enter personal information when you return.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2 mt-1">
          <Button onClick={handleDownload} className="w-full gap-2">
            <Download className="h-4 w-4" />
            Download resume file (.token)
          </Button>

          <Button variant="outline" onClick={handleCopy} className="w-full gap-2">
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Copied to clipboard
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy resume code
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={onDismiss}
            className="text-xs text-muted-foreground w-full"
          >
            Skip for now (I&apos;ll re-enter my info later)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Import panel ─────────────────────────────────────────────────────────────

interface PhiTokenImportPanelProps {
  onImport: (tokenString: string) => Promise<void>
  error?: string | null
  isLoading?: boolean
  className?: string
}

export function PhiTokenImportPanel({
  onImport,
  error,
  isLoading,
  className,
}: PhiTokenImportPanelProps) {
  const [tokenInput, setTokenInput] = useState("")
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const readFileAndImport = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = (e.target?.result as string | null ?? "").trim()
        setTokenInput(text)
        void onImport(text)
      }
      reader.readAsText(file)
    },
    [onImport],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) readFileAndImport(file)
    },
    [readFileAndImport],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) readFileAndImport(file)
      // reset so the same file can be re-selected
      e.target.value = ""
    },
    [readFileAndImport],
  )

  const handleSubmitPaste = useCallback(() => {
    const trimmed = tokenInput.trim()
    if (trimmed) void onImport(trimmed)
  }, [tokenInput, onImport])

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload resume file"
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click()
        }}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">
          {dragging ? "Release to upload" : "Drop your resume file here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">or click to browse (.token files)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".token,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-border" />
        <span>or paste your resume code</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Textarea
        placeholder="Paste your resume code here…"
        value={tokenInput}
        onChange={(e) => setTokenInput(e.target.value)}
        className="font-mono text-xs h-24 resize-none"
        aria-label="Resume code"
      />

      <Button
        onClick={handleSubmitPaste}
        disabled={!tokenInput.trim() || isLoading}
        className="w-full"
      >
        {isLoading ? "Restoring…" : "Restore my application"}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
