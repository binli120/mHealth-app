/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useCallback, useRef, useState } from "react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { DocumentUploadState } from "@/lib/types/common"

interface UseDocumentUploadOptions {
  /** API endpoint that accepts a multipart `file` field and returns `{ ok, extractedText }` */
  extractEndpoint: string
  /** Max allowed file size in bytes (default 10 MB) */
  maxBytes?: number
  /** Accepted MIME types (for validation message only — enforce with `accept` on the input) */
  acceptedMimeTypes?: readonly string[]
}

interface UseDocumentUploadResult {
  state: DocumentUploadState
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFile: (file: File) => Promise<void>
  clear: () => void
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * File-upload + server-extraction state machine.
 *
 * Manages the idle → extracting → ready/error lifecycle that is shared between
 * DenialInputForm and any other component that needs to upload a document and
 * extract its text via an API endpoint.
 *
 * @example
 * const { state, fileInputRef, handleFile, clear } = useDocumentUpload({
 *   extractEndpoint: "/api/appeals/extract-document",
 *   maxBytes: MAX_DOCUMENT_UPLOAD_BYTES,
 * })
 */
export function useDocumentUpload({
  extractEndpoint,
  maxBytes = DEFAULT_MAX_BYTES,
}: UseDocumentUploadOptions): UseDocumentUploadResult {
  const [state, setState] = useState<DocumentUploadState>({ status: "idle" })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      // Reset native input so the same file can be re-selected after clearing
      if (fileInputRef.current) fileInputRef.current.value = ""

      if (file.size > maxBytes) {
        setState({
          status: "error",
          fileName: file.name,
          message: `File exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit.`,
        })
        return
      }

      setState({ status: "extracting", fileName: file.name })

      try {
        const formData = new FormData()
        formData.append("file", file)

        const response = await authenticatedFetch(extractEndpoint, {
          method: "POST",
          body: formData,
        })

        const payload = (await response.json()) as
          | { ok: true; extractedText: string }
          | { ok: false; error: string }

        if (!payload.ok) {
          setState({ status: "error", fileName: file.name, message: payload.error })
          return
        }

        setState({
          status: "ready",
          fileName: file.name,
          extractedText: payload.extractedText,
        })
      } catch {
        setState({
          status: "error",
          fileName: file.name,
          message: "Upload failed. Please try again.",
        })
      }
    },
    [extractEndpoint, maxBytes],
  )

  const clear = useCallback(() => {
    setState({ status: "idle" })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  return { state, fileInputRef, handleFile, clear }
}
