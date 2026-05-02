/**
 * POST /api/masshealth/income-verification/extract
 *
 * LLM/OCR extraction for a single income document.
 * Produces a strict IncomeExtractionResult JSON; the deterministic engine
 * (not this route) decides whether proof is legally sufficient.
 *
 * After extraction, writes the result to income_document_extractions and
 * triggers a recompute of the verification case.
 *
 * Body: multipart/form-data
 *   file            — binary (JPEG, PNG, WebP, HEIC, PDF) required
 *   documentId      — UUID of the income_documents row required
 *   applicationId   — UUID required
 *   memberId        — UUID required
 *   docTypeClaimed  — IncomeDocType claimed by the applicant required
 *   memberName      — string for person-match context required
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import { extractPdfJson } from "@/lib/pdf/extract-pdf-json"
import { upsertDocumentExtraction, recomputeVerificationCase } from "@/lib/db/income-verification"
import {
  DEFAULT_OLLAMA_BASE_URL,
  OLLAMA_CHAT_ENDPOINT,
  OLLAMA_TIMEOUT_MS,
} from "@/app/api/chat/masshealth/constants"
import type { IncomeExtractionResult, IncomeDocType } from "@/lib/masshealth/types"
import { validateUpload } from "@/lib/uploads/validate"

export const runtime = "nodejs"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MODEL_VERSION = process.env.OLLAMA_VISION_MODEL || "llama3.2-vision"

function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "")
}

// ── Extraction prompt ─────────────────────────────────────────────────────────
// Narrow, role-bound prompt.  Hard rules at the bottom prevent the model from
// inferring eligibility.

function buildExtractionPrompt(docTypeClaimed: string, memberName: string): string {
  return `You are an income proof extractor for MassHealth eligibility review.
Your ONLY job is to extract structured fields from the document image or text.

Context:
  - Claimed document type: ${docTypeClaimed}
  - Household member name: ${memberName}

Output ONLY valid JSON matching this schema (no markdown, no prose):
{
  "doc_type": string | null,
  "issuer": string | null,
  "person_name": string | null,
  "employer_name": string | null,
  "date_range_start": "YYYY-MM-DD" | null,
  "date_range_end": "YYYY-MM-DD" | null,
  "gross_amount": number | null,
  "net_amount": number | null,
  "frequency": "weekly"|"biweekly"|"semimonthly"|"monthly"|"annual" | null,
  "income_source_type": string | null,
  "confidence": number between 0 and 1,
  "needs_manual_review": boolean,
  "reasons": string[]
}

Hard rules:
- If the document is unreadable, set confidence below 0.3 and list the reason.
- If the person name on the document does not match "${memberName}", set needs_manual_review to true and explain in reasons.
- If any date or amount field is ambiguous, leave it null — do not guess.
- Do NOT calculate eligibility or income thresholds.
- Do NOT infer amounts from partial data.
- doc_type must be one of: pay_stub, employer_statement, tax_return, w2, form_1099,
  profit_loss_statement, self_employment_form, unemployment_letter,
  social_security_letter, pension_statement, rental_agreement,
  interest_statement, zero_income_affidavit, attestation_form, or null.`
}

// ── Ollama vision call ────────────────────────────────────────────────────────

async function extractViaVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const url = `${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL_VERSION,
      stream: false,
      messages: [
        {
          role: "user",
          content: prompt,
          images: [imageBase64],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama vision call failed: ${response.status}`)
  }

  const payload = (await response.json()) as { message?: { content?: string } }
  return payload.message?.content ?? ""
}

// ── JSON parsing with fallback ────────────────────────────────────────────────

function parseExtractionJson(raw: string): IncomeExtractionResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return failedExtraction("Model returned no JSON block.")
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return {
      docType:         (parsed.doc_type as IncomeDocType | null) ?? null,
      issuer:          (parsed.issuer as string | null) ?? null,
      personName:      (parsed.person_name as string | null) ?? null,
      employerName:    (parsed.employer_name as string | null) ?? null,
      dateRangeStart:  (parsed.date_range_start as string | null) ?? null,
      dateRangeEnd:    (parsed.date_range_end as string | null) ?? null,
      grossAmount:     parsed.gross_amount != null ? Number(parsed.gross_amount) : null,
      netAmount:       parsed.net_amount != null ? Number(parsed.net_amount) : null,
      frequency:       (parsed.frequency as IncomeExtractionResult["frequency"]) ?? null,
      incomeSourceType: (parsed.income_source_type as IncomeExtractionResult["incomeSourceType"]) ?? null,
      confidence:      Math.min(1, Math.max(0, Number(parsed.confidence ?? 0))),
      needsManualReview: Boolean(parsed.needs_manual_review),
      reasons:         Array.isArray(parsed.reasons) ? (parsed.reasons as string[]) : [],
    }
  } catch {
    return failedExtraction("Failed to parse model JSON output.")
  }
}

function failedExtraction(reason: string): IncomeExtractionResult {
  return {
    docType: null,
    issuer: null,
    personName: null,
    employerName: null,
    dateRangeStart: null,
    dateRangeEnd: null,
    grossAmount: null,
    netAmount: null,
    frequency: null,
    incomeSourceType: null,
    confidence: 0,
    needsManualReview: true,
    reasons: [reason],
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { ok: false, error: "Request body must be multipart/form-data." },
        { status: 400 },
      )
    }

    const documentId     = (formData.get("documentId") as string | null) ?? ""
    const applicationId  = (formData.get("applicationId") as string | null) ?? ""
    const memberId       = (formData.get("memberId") as string | null) ?? ""
    const docTypeClaimed = (formData.get("docTypeClaimed") as string | null) ?? ""
    const memberName     = (formData.get("memberName") as string | null) ?? ""
    const fileEntry      = formData.get("file")

    for (const [field, value] of [["documentId", documentId], ["applicationId", applicationId], ["memberId", memberId]] as const) {
      if (!UUID_PATTERN.test(value)) {
        return NextResponse.json(
          { ok: false, error: `${field} must be a valid UUID.` },
          { status: 400 },
        )
      }
    }

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "A valid file (JPEG, PNG, WebP, HEIC, PDF) is required." },
        { status: 400 },
      )
    }

    const validation = await validateUpload(fileEntry, "document")
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: validation.status })
    }

    const prompt = buildExtractionPrompt(docTypeClaimed, memberName)
    let extraction: IncomeExtractionResult

    if (validation.mimeType === "application/pdf") {
      // PDF path: extract text fields, then build minimal extraction result
      const arrayBuffer = await fileEntry.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      let pdfText = ""
      try {
        const pdfData = await extractPdfJson({ bytes: new Uint8Array(buffer), fileName: fileEntry.name, fileSize: fileEntry.size })
        pdfText = JSON.stringify(pdfData)
      } catch {
        pdfText = ""
      }

      // Send text to Ollama as a text message (no image)
      const url = `${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`
      const textPrompt = `${prompt}\n\nDocument text/fields:\n${pdfText.slice(0, 8000)}`
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
        body: JSON.stringify({
          model: MODEL_VERSION,
          stream: false,
          messages: [{ role: "user", content: textPrompt }],
        }),
      })

      if (!resp.ok) throw new Error(`Ollama text call failed: ${resp.status}`)
      const payload = (await resp.json()) as { message?: { content?: string } }
      extraction = parseExtractionJson(payload.message?.content ?? "")
    } else {
      // Image path: base64 encode and use vision model
      const arrayBuffer = await fileEntry.arrayBuffer()
      const imageBase64 = Buffer.from(arrayBuffer).toString("base64")
      const rawOutput = await extractViaVision(imageBase64, validation.mimeType, prompt)
      extraction = parseExtractionJson(rawOutput)
    }

    // Persist extraction and trigger recompute
    await upsertDocumentExtraction({
      documentId,
      ...extraction,
      modelVersion: MODEL_VERSION,
    })

    await recomputeVerificationCase(applicationId)

    return NextResponse.json({ ok: true, extraction })
  } catch (error) {
    logServerError("Failed to extract income document", error, {
      module: "api/masshealth/income-verification/extract",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to extract income document." },
      { status: 500 },
    )
  }
}
