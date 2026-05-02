/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * POST /api/agents/vision
 *
 * Document extraction agent — accepts a PDF or image upload and returns the
 * extracted text for use in the Appeal agent.
 *
 * Supported inputs:
 *   • PDF  → extract via pdf-lib (form fields + page text + metadata)
 *   • Image (JPEG / PNG / WebP) → OCR via Ollama vision model (llava / bakllava)
 *
 * This route is a peer of /api/agents/appeal — clients upload the denial
 * letter here first, then pass the extracted `documentText` to the appeal agent.
 *
 * Migrated from: /api/appeals/extract-document
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { extractPdfJson } from "@/lib/pdf/extract-pdf-json"
import { logServerError, logServerInfo } from "@/lib/server/logger"
import {
  DEFAULT_OLLAMA_VISION_MODEL,
  ERROR_DOCUMENT_EXTRACT_FAILED,
  ERROR_DOCUMENT_LOG_PREFIX,
  ERROR_DOCUMENT_MISSING,
} from "@/lib/appeals/constants"
import {
  DEFAULT_OLLAMA_BASE_URL,
  OLLAMA_CHAT_ENDPOINT,
  OLLAMA_TIMEOUT_MS,
} from "@/app/api/chat/masshealth/constants"
import { validateUpload } from "@/lib/uploads/validate"

export const runtime = "nodejs"

const AGENT = "vision"

// ── Types ─────────────────────────────────────────────────────────────────────

interface OllamaResponsePayload {
  message?: { role?: string; content?: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "")
}

function getVisionModel(): string {
  return process.env.OLLAMA_VISION_MODEL || DEFAULT_OLLAMA_VISION_MODEL
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== "string"
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
function formatPdfExtraction(pdfData: Awaited<ReturnType<typeof extractPdfJson>>): string {
  const parts: string[] = []

  if (pdfData.metadata.title) parts.push(`Document title: ${pdfData.metadata.title}`)
  if (pdfData.metadata.subject) parts.push(`Subject: ${pdfData.metadata.subject}`)
  if (pdfData.pageCount) parts.push(`Pages: ${pdfData.pageCount}`)
  if (pdfData.pageText) parts.push("Document text:\n" + pdfData.pageText)

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

// ── Route handler ─────────────────────────────────────────────────────────────

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

    logServerInfo(`${AGENT}.request`, {
      userId: authResult.userId,
      mimeType: validation.mimeType,
      fileName: uploaded.name,
      fileSize: uploaded.size,
    })

    const bytes = await uploaded.arrayBuffer()
    let extractedText = ""

    if (validation.mimeType !== "application/pdf") {
      const base64 = Buffer.from(bytes).toString("base64")
      extractedText = await extractTextFromImage(base64, validation.mimeType)
    } else {
      try {
        const pdfData = await extractPdfJson({
          bytes: new Uint8Array(bytes),
          fileName: uploaded.name || "denial-letter.pdf",
          fileSize: uploaded.size,
        })
        extractedText = formatPdfExtraction(pdfData)
      } catch {
        extractedText = ""
      }
    }

    logServerInfo(`${AGENT}.done`, {
      userId: authResult.userId,
      extractedLength: extractedText.length,
    })

    return NextResponse.json({ ok: true, extractedText }, { status: 200 })
  } catch (error) {
    logServerError(ERROR_DOCUMENT_LOG_PREFIX, error, { route: "/api/agents/vision" })
    return NextResponse.json({ ok: false, error: ERROR_DOCUMENT_EXTRACT_FAILED }, { status: 500 })
  }
}
