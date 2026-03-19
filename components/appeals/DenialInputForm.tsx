/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ACCEPTED_DOCUMENT_MIME_TYPES,
  APPEAL_DENIAL_REASONS,
  APPEAL_DETAILS_MAX_LENGTH,
  MAX_DOCUMENT_UPLOAD_BYTES,
} from "@/lib/appeals/constants"
import { getAppealAssistantCopy } from "@/lib/appeals/copy"
import type { AppealRequest, DenialReasonId } from "@/lib/appeals/types"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { useDocumentUpload } from "@/hooks/use-document-upload"

interface DenialInputFormProps {
  onSubmit: (request: AppealRequest) => void
  isLoading: boolean
  language?: SupportedLanguage
}

const ACCEPTED_MIME_STRING = [...ACCEPTED_DOCUMENT_MIME_TYPES].join(",")


export function DenialInputForm({ onSubmit, isLoading, language = "en" }: DenialInputFormProps) {
  const copy = getAppealAssistantCopy(language)
  const [denialReasonId, setDenialReasonId] = useState<DenialReasonId | "">("")
  const [denialDetails, setDenialDetails] = useState("")
  const { state: documentState, fileInputRef, handleFile, clear: handleClearDocument } = useDocumentUpload({
    extractEndpoint: "/api/appeals/extract-document",
    maxBytes: MAX_DOCUMENT_UPLOAD_BYTES,
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void handleFile(file)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!denialReasonId) return

    const documentText =
      documentState.status === "ready" && documentState.extractedText
        ? documentState.extractedText
        : undefined

    onSubmit({ denialReasonId, denialDetails, documentText })
  }

  const isExtracting = documentState.status === "extracting"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{copy.formTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Denial reason */}
          <div className="space-y-2">
            <Label htmlFor="denial-reason" className="text-sm font-medium text-gray-700">
              {copy.denialReason} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={denialReasonId}
              onValueChange={(v) => setDenialReasonId(v as DenialReasonId)}
            >
              <SelectTrigger id="denial-reason" className="w-full">
                <SelectValue placeholder={copy.denialReasonPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {APPEAL_DENIAL_REASONS.map((reason) => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Document upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              {copy.uploadLetter}{" "}
              <span className="font-normal text-muted-foreground">({copy.optional})</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              {copy.uploadHelp}
            </p>

            {/* Idle — show upload button */}
            {documentState.status === "idle" && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_MIME_STRING}
                  className="sr-only"
                  id="denial-letter-upload"
                  onChange={handleFileChange}
                  disabled={isLoading}
                />
                <Label
                  htmlFor="denial-letter-upload"
                  className={
                    "flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed " +
                    "border-gray-200 px-4 py-3 text-sm text-muted-foreground " +
                    "transition-colors hover:border-primary/50 hover:text-foreground " +
                    (isLoading ? "pointer-events-none opacity-50" : "")
                  }
                >
                  <Paperclip className="h-4 w-4 shrink-0" />
                  {copy.attachLetter}
                </Label>
              </div>
            )}

            {/* Extracting */}
            {documentState.status === "extracting" && (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-700">
                    {documentState.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">{copy.extracting}</p>
                </div>
              </div>
            )}

            {/* Ready — extraction succeeded */}
            {documentState.status === "ready" && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-emerald-800">
                      {documentState.fileName}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearDocument}
                      className="shrink-0 text-emerald-600 hover:text-emerald-800"
                      aria-label={copy.removeDocument}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {documentState.extractedText ? (
                    <p className="text-xs text-emerald-700">
                      {copy.uploadSuccess}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">
                      {copy.uploadEmpty}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {documentState.status === "error" && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-destructive">
                      {documentState.fileName}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearDocument}
                      className="shrink-0 text-destructive/70 hover:text-destructive"
                      aria-label={copy.dismissError}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-destructive/80">{documentState.message}</p>
                </div>
              </div>
            )}

            {/* Icon prompt for non-idle states where upload button is hidden */}
            {documentState.status !== "idle" && documentState.status !== "extracting" && (
              <button
                type="button"
                onClick={handleClearDocument}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <FileText className="h-3.5 w-3.5" />
                {copy.replaceFile}
              </button>
            )}
          </div>

          {/* Additional details */}
          <div className="space-y-2">
            <Label htmlFor="denial-details" className="text-sm font-medium text-gray-700">
              {copy.additionalDetails}{" "}
              <span className="font-normal text-muted-foreground">({copy.optional})</span>
            </Label>
            <Textarea
              id="denial-details"
              placeholder={copy.additionalDetailsPlaceholder}
              value={denialDetails}
              onChange={(e) =>
                setDenialDetails(e.target.value.slice(0, APPEAL_DETAILS_MAX_LENGTH))
              }
              rows={3}
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">
              {denialDetails.length} / {APPEAL_DETAILS_MAX_LENGTH}
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!denialReasonId || isLoading || isExtracting}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {copy.analyzing}
              </>
            ) : (
              copy.analyzeMyDenial
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
