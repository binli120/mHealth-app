import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { extractPdfJson } from "@/lib/pdf/extract-pdf-json"
import { logServerError } from "@/lib/server/logger"
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  ACCEPTED_DOCUMENT_MIME_TYPES,
  DEFAULT_OLLAMA_VISION_MODEL,
  MAX_DOCUMENT_UPLOAD_BYTES,
  ERROR_DOCUMENT_EXTRACT_FAILED,
  ERROR_DOCUMENT_INVALID_TYPE,
  ERROR_DOCUMENT_LOG_PREFIX,
  ERROR_DOCUMENT_MISSING,
  ERROR_DOCUMENT_TOO_LARGE,
} from "@/lib/appeals/constants"
import {
  DEFAULT_OLLAMA_BASE_URL,
  OLLAMA_CHAT_ENDPOINT,
  OLLAMA_TIMEOUT_MS,
} from "@/app/api/chat/masshealth/constants"

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

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== "string"
}

function isImageMimeType(mimeType: string, fileName: string): boolean {
  if ((ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return true
  // Fall back to extension when MIME type is absent or generic (e.g. application/octet-stream)
  if (!mimeType || mimeType === "application/octet-stream") {
    const lower = fileName.toLowerCase()
    return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp")
  }
  return false
}

function isAcceptedMimeType(mimeType: string, fileName: string): boolean {
  if ((ACCEPTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType)) return true
  // Fallback: check extension for ambiguous MIME types
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) return true
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return true
  if (lower.endsWith(".png") || lower.endsWith(".webp")) return true
  return false
}

/**
 * Call Ollama vision model to extract text content from a denial letter image.
 * Returns the extracted text, or empty string on failure (graceful degradation).
 */
async function extractTextFromImage(imageBase64: string, mimeType: string): Promise<string> {
  const model = getVisionModel()

  try {
    const response = await fetch(`${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
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
    if (uploaded.size === 0) {
      return NextResponse.json({ ok: false, error: ERROR_DOCUMENT_MISSING }, { status: 400 })
    }
    if (uploaded.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: ERROR_DOCUMENT_TOO_LARGE }, { status: 413 })
    }

    const mimeType = uploaded.type || ""
    if (!isAcceptedMimeType(mimeType, uploaded.name)) {
      return NextResponse.json({ ok: false, error: ERROR_DOCUMENT_INVALID_TYPE }, { status: 400 })
    }

    const bytes = await uploaded.arrayBuffer()

    let extractedText = ""

    if (isImageMimeType(mimeType, uploaded.name)) {
      // Convert image bytes to base64 and send to Ollama vision model
      const base64 = Buffer.from(bytes).toString("base64")
      extractedText = await extractTextFromImage(base64, mimeType)
    } else {
      // PDF: extract form fields and metadata via existing pdf-lib utility
      try {
        const pdfData = await extractPdfJson({
          bytes: new Uint8Array(bytes),
          fileName: uploaded.name || "denial-letter.pdf",
          fileSize: uploaded.size,
        })
        extractedText = formatPdfExtraction(pdfData)
      } catch {
        // pdf-lib couldn't parse — graceful fallback
        extractedText = ""
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
