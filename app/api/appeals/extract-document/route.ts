/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { createRequire } from "node:module"
import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { extractPdfJson } from "@/lib/pdf/extract-pdf-json"
import { logServerError } from "@/lib/server/logger"
import {
  DEFAULT_OLLAMA_VISION_MODEL,
  ERROR_DOCUMENT_EXTRACT_FAILED,
  ERROR_DOCUMENT_LOG_PREFIX,
  ERROR_DOCUMENT_MISSING,
} from "@/lib/appeals/constants"
import {
  DEFAULT_OLLAMA_BASE_URL,
  OLLAMA_CHAT_ENDPOINT,
} from "@/app/api/chat/masshealth/constants"
import { validateUpload } from "@/lib/uploads/validate"

// OCR models (deepseek-ocr, glm-ocr) are slower than chat models — allow extra time
const OCR_TIMEOUT_MS = 90_000
// Lazy CJS loader — do NOT call at module scope (pdfjs-dist crashes Turbopack build worker)
const _pdfRequire = createRequire(import.meta.url)

export const runtime = "nodejs"

interface OllamaResponsePayload {
  message?: { role?: string; content?: string }
}

function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "")
}

function getVisionModel(): string {
  return process.env.OLLAMA_VISION_MODEL || DEFAULT_OLLAMA_VISION_MODEL
}

/**
 * Returns true when pdf-parse extracted nothing useful — only page-separator
 * markers like "-- 1 of 6 --" that appear in scanned/image-based PDFs.
 */
function isScannedPdfText(text: string | null): boolean {
  if (!text) return true
  const stripped = text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").replace(/\s+/g, "")
  return stripped.length < 30
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== "string"
}

/**
 * Use pdf-parse v2 getImage() to pull embedded raster images from a scanned PDF,
 * then run OCR on each page image via Ollama.  Returns joined text or "" on failure.
 */
async function extractTextFromScannedPdf(bytes: ArrayBuffer): Promise<string> {
  try {
    type PDFParseCtor = new (opts: { data: Uint8Array; verbosity: number }) => {
      getImage(opts: { startPage: number; endPage: number }): Promise<{
        pages: Array<{ images: Array<{ dataUrl?: string }> }>
      }>
    }
    const { PDFParse } = _pdfRequire("pdf-parse") as { PDFParse: PDFParseCtor }
    const parser = new PDFParse({ data: new Uint8Array(bytes), verbosity: 0 })

    // Process first 2 pages — denial reason is almost always on page 1-2
    const imageResult = await parser.getImage({ startPage: 1, endPage: 2 })
    const parts: string[] = []

    for (const page of imageResult.pages ?? []) {
      for (const img of page.images ?? []) {
        const dataUrl = img.dataUrl
        if (!dataUrl) continue
        const b64 = dataUrl.replace(/^data:[^;]+;base64,/, "")
        const text = await extractTextFromImage(b64, "image/png")
        if (text.trim()) parts.push(text.trim())
      }
    }

    return parts.join("\n\n")
  } catch {
    return ""
  }
}

/**
 * Call Ollama vision/OCR model to extract text content from a denial letter image.
 * Returns the extracted text, or empty string on failure (graceful degradation).
 */
async function extractTextFromImage(imageBase64: string, mimeType: string): Promise<string> {
  const model = getVisionModel()

  try {
    const response = await fetch(`${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.1 },
        messages: [
          {
            role: "user",
            content:
              "This is a MassHealth denial letter or government document. " +
              "Extract all the text you can read from this image. " +
              "Include: the denial reason, any program names, dates, case numbers, and any instructions about appealing. " +
              "Return only the extracted text, no commentary.",
            images: [imageBase64],
          },
        ],
      }),
    })

    if (!response.ok) return ""

    const data = (await response.json()) as OllamaResponsePayload
    return data.message?.content?.trim() ?? ""
  } catch {
    // Vision model unavailable or unsupported — graceful degradation
    return ""
  }
}

/**
 * Format PDF extraction result as readable text for the appeal prompt.
 */
function formatPdfExtraction(
  pdfData: Awaited<ReturnType<typeof extractPdfJson>>,
): string {
  const parts: string[] = []

  if (pdfData.metadata.title) {
    parts.push(`Document title: ${pdfData.metadata.title}`)
  }
  if (pdfData.metadata.subject) {
    parts.push(`Subject: ${pdfData.metadata.subject}`)
  }
  if (pdfData.pageCount) {
    parts.push(`Pages: ${pdfData.pageCount}`)
  }
  if (pdfData.pageText) {
    parts.push("Document text:\n" + pdfData.pageText)
  }

  if (pdfData.formFields.length > 0) {
    const fieldLines = pdfData.formFields
      .filter((f) => f.value !== null && f.value !== "" && f.value !== false)
      .map((f) => `${f.name}: ${Array.isArray(f.value) ? f.value.join(", ") : String(f.value)}`)
    if (fieldLines.length > 0) {
      parts.push("Document fields:\n" + fieldLines.join("\n"))
    }
  }

  return parts.join("\n")
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const formData = await request.formData()
    const uploaded = formData.get("file")

    if (!isUploadedFile(uploaded)) {
      return NextResponse.json({ ok: false, error: ERROR_DOCUMENT_MISSING }, { status: 400 })
    }

    const validation = await validateUpload(uploaded, "vision")
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: validation.status })
    }

    const bytes = await uploaded.arrayBuffer()
    let extractedText = ""

    if (validation.mimeType !== "application/pdf") {
      // Convert image bytes to base64 and send to Ollama OCR model
      const base64 = Buffer.from(bytes).toString("base64")
      extractedText = await extractTextFromImage(base64, validation.mimeType)
    } else {
      // PDF: try text layer extraction first, then OCR for scanned PDFs
      try {
        const pdfData = await extractPdfJson({
          bytes: new Uint8Array(bytes),
          fileName: uploaded.name || "denial-letter.pdf",
          fileSize: uploaded.size,
        })
        const textLayerResult = formatPdfExtraction(pdfData)

        if (isScannedPdfText(pdfData.pageText)) {
          // Scanned/image-based PDF — fall back to OCR via embedded page images
          extractedText = await extractTextFromScannedPdf(bytes)
          // If OCR also fails, surface empty so the UI prompts manual paste
          if (!extractedText) extractedText = ""
        } else {
          extractedText = textLayerResult
        }
      } catch {
        // pdf-lib couldn't parse — try OCR as last resort
        extractedText = await extractTextFromScannedPdf(bytes)
      }
    }

    return NextResponse.json({ ok: true, extractedText }, { status: 200 })
  } catch (error) {
    logServerError(ERROR_DOCUMENT_LOG_PREFIX, error, {
      route: "/api/appeals/extract-document",
    })
    return NextResponse.json({ ok: false, error: ERROR_DOCUMENT_EXTRACT_FAILED }, { status: 500 })
  }
}
