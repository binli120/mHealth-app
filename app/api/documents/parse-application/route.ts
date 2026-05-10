/**
 * POST /api/documents/parse-application
 *
 * Accepts a PDF or image of a filled-out MassHealth application form and
 * returns a structured Partial<ApplicationFormData> JSON object.
 *
 * Security checks (before any extraction):
 *   0a. Magic-byte verification (via validateUpload)
 *   0b. PDF safety scan — rejects files with embedded JS, launch actions, or embedded files
 *   0c. Document relevance check — rejects PDFs whose text contains no MassHealth markers
 *
 * Extraction pipeline (in order, first success wins):
 *   1. Analysis service  — extractMasshealthAuto (if env var is configured)
 *   2. pdf-parse text    — regex-based ACA-3 extractor (no LLM required)
 *   3. Ollama text/LLM   — pdf-lib form fields + Ollama JSON extraction (PDFs only)
 *   4. Ollama vision     — OCR for images; structured JSON extraction for both
 *
 * Note: files are processed entirely in memory and are never persisted to storage.
 *
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { validateUpload } from "@/lib/uploads/validate"
import { checkPdfSafety } from "@/lib/uploads/check-pdf-safety"
import { extractPdfJson } from "@/lib/pdf/extract-pdf-json"
import { parseAca3Text } from "@/lib/pdf/parse-aca3-text"
import { extractMasshealthAuto } from "@/lib/masshealth/extract-auto-client"
import { logServerError, logServerInfo } from "@/lib/server/logger"
import type { ApplicationFormData } from "@/lib/redux/features/application-slice"

export const runtime = "nodejs"

// ── Types ─────────────────────────────────────────────────────────────────────

export type ParseApplicationErrorCode =
  | "not_masshealth_form"  // document does not appear to be a MassHealth application
  | "suspicious_content"   // PDF contains embedded JS, launch actions, or embedded files
  | "invalid_file"         // file failed format/size validation

export interface ParseApplicationResponse {
  ok: true
  formData: Partial<ApplicationFormData>
  fieldsFound: string[]
  source: "service" | "pdf-fields" | "llm" | "fallback"
}

export interface ParseApplicationErrorResponse {
  ok: false
  error: string
  errorCode?: ParseApplicationErrorCode
}

interface OllamaChatResponse {
  message?: { content?: string }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/+$/, "")
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2"
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "llava"
const OLLAMA_TIMEOUT_MS = 60_000

// ── Helpers ───────────────────────────────────────────────────────────────────

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== "string"
}

/** Fields in ApplicationFormData that we attempt to extract. */
const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  dob: "Date of birth (MM/DD/YYYY)",
  email: "Email address",
  phone: "Primary phone",
  otherPhone: "Alternate phone",
  address: "Street address",
  apartment: "Apartment / unit",
  city: "City",
  state: "State (2-letter code)",
  zip: "ZIP code",
  county: "County",
  citizenship: "Citizenship / immigration status",
  preferredSpokenLanguage: "Preferred spoken language",
  preferredWrittenLanguage: "Preferred written language",
}

function buildExtractionPrompt(documentText: string): string {
  const schema = Object.entries(FIELD_LABELS)
    .map(([k, v]) => `  "${k}": "${v} — empty string if not found"`)
    .join(",\n")

  return [
    "You are a data-extraction assistant. The following is text extracted from a MassHealth application form.",
    "Extract the applicant's information and return ONLY a valid JSON object with these exact keys.",
    "If a field is not present in the document, use an empty string \"\".",
    "Never invent or guess values. Return raw JSON only — no markdown, no explanation.",
    "",
    "Required JSON keys:",
    "{",
    schema,
    "}",
    "",
    "Document text:",
    documentText.slice(0, 6000),
  ].join("\n")
}

async function extractViaOllama(prompt: string, model: string, imageBase64?: string): Promise<string> {
  const message: { role: string; content: string; images?: string[] } = {
    role: "user",
    content: prompt,
  }
  if (imageBase64) message.images = [imageBase64]

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    body: JSON.stringify({ model, stream: false, options: { temperature: 0.0 }, messages: [message] }),
  })

  if (!res.ok) throw new Error(`Ollama responded ${res.status}`)
  const data = (await res.json()) as OllamaChatResponse
  return data.message?.content?.trim() ?? ""
}

function parseJsonFromLlm(raw: string): Record<string, string> {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) result[k] = v.trim()
    }
    return result
  } catch {
    return {}
  }
}

const MASSHEALTH_MARKERS = [
  "masshealth",
  "aca-3",
  "aca3",
  "massachusetts application for health",
  "eohhs",
  "executive office of health and human services",
  "commonhealth",
  "health safety net",
]

/** Returns true when the extracted text looks like a MassHealth document. */
function isMasshealthDocument(text: string): boolean {
  const lower = text.toLowerCase()
  return MASSHEALTH_MARKERS.some((m) => lower.includes(m))
}

function buildFormDataFromRecord(record: Record<string, string>): {
  formData: Partial<ApplicationFormData>
  fieldsFound: string[]
} {
  const formData: Partial<ApplicationFormData> = {}
  const fieldsFound: string[] = []

  const allowed = new Set(Object.keys(FIELD_LABELS))
  for (const [k, v] of Object.entries(record)) {
    if (!allowed.has(k) || !v) continue
    const key = k as keyof ApplicationFormData
    ;(formData as Record<string, unknown>)[key] = v
    fieldsFound.push(k)
  }

  return { formData, fieldsFound }
}

/** Map ACA-3 workflow_data fields to ApplicationFormData. */
function mapWorkflowData(data: Record<string, unknown>): {
  formData: Partial<ApplicationFormData>
  fieldsFound: string[]
} {
  const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
  const n = (v: unknown): string => (typeof v === "number" ? String(v) : s(v))

  const record: Record<string, string> = {
    firstName: s(data.firstName ?? data.first_name),
    lastName: s(data.lastName ?? data.last_name),
    dob: s(data.dateOfBirth ?? data.date_of_birth ?? data.dob),
    email: s(data.email),
    phone: s(data.phone),
    otherPhone: s(data.otherPhone ?? data.other_phone),
    address: s(data.streetAddress ?? data.street_address ?? data.address),
    apartment: s(data.apartment),
    city: s(data.city),
    state: s(data.state),
    zip: s(data.zipCode ?? data.zip_code ?? data.zip),
    county: s(data.county),
    citizenship: s(data.citizenship),
    preferredSpokenLanguage: s(data.preferredSpokenLanguage ?? data.preferred_spoken_language),
    preferredWrittenLanguage: s(data.preferredWrittenLanguage ?? data.preferred_written_language),
  }

  // Normalize monthly income into an income source hint (stored separately in the store,
  // but we surface it so the assistant knows to skip asking)
  const monthlyIncome = n(data.monthlyIncome ?? data.monthly_income)
  const employerName = s(data.employerName ?? data.employer_name)
  if (monthlyIncome || employerName) {
    record["_incomeHint"] = `${employerName ? employerName + " " : ""}${monthlyIncome ? "$" + monthlyIncome + "/mo" : ""}`.trim()
  }

  return buildFormDataFromRecord(record)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const formData = await request.formData()
    const uploaded = formData.get("file")

    if (!isUploadedFile(uploaded)) {
      return NextResponse.json({ ok: false, error: "Missing file upload." }, { status: 400 })
    }

    const validation = await validateUpload(uploaded, "vision")
    if (!validation.ok) {
      return NextResponse.json<ParseApplicationErrorResponse>(
        { ok: false, error: validation.error, errorCode: "invalid_file" },
        { status: validation.status },
      )
    }

    const bytes = await uploaded.arrayBuffer()
    const isPdf = validation.mimeType === "application/pdf"

    // ── Security: PDF structure scan ──────────────────────────────────────────
    if (isPdf) {
      const safety = checkPdfSafety(new Uint8Array(bytes))
      if (!safety.safe) {
        logServerInfo("parse-application.rejected-suspicious", { userId: authResult.userId, reason: safety.reason })
        return NextResponse.json<ParseApplicationErrorResponse>(
          {
            ok: false,
            error: "This file was rejected for security reasons. Please upload a valid MassHealth form.",
            errorCode: "suspicious_content",
          },
          { status: 422 },
        )
      }
    }

    logServerInfo("parse-application.request", {
      userId: authResult.userId,
      mimeType: validation.mimeType,
      fileSize: uploaded.size,
    })

    // ── Path 1: Analysis service (if configured) ───────────────────────────
    const analysisBaseUrl = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL?.trim()
    if (analysisBaseUrl) {
      try {
        const file = new File([bytes], uploaded.name, { type: validation.mimeType })
        const serviceResult = await extractMasshealthAuto({
          userId: authResult.userId,
          file,
          documentType: "aca3",
        })

        const workflowData =
          (serviceResult.result as { workflow_data?: Record<string, unknown> }).workflow_data ??
          (serviceResult.result as Record<string, unknown>)

        const { formData: extractedFormData, fieldsFound } = mapWorkflowData(
          workflowData as Record<string, unknown>,
        )

        if (fieldsFound.length > 0) {
          logServerInfo("parse-application.service-success", { userId: authResult.userId, fieldsFound })
          return NextResponse.json<ParseApplicationResponse>({
            ok: true,
            formData: extractedFormData,
            fieldsFound,
            source: "service",
          })
        }
      } catch (err) {
        const code = (err as { code?: string }).code
        if (code && code !== "blank_template") {
          // Log unexpected errors (not the expected "no interactive widgets" rejection)
          logServerError("parse-application.service-error", err, { route: "/api/documents/parse-application" })
        }
        // Fall through to regex / Ollama extraction
      }
    }

    // ── Path 2: pdf-parse text + regex ACA-3 extractor (no LLM needed) ─────
    if (isPdf) {
      try {
        const pdfData = await extractPdfJson({
          bytes: new Uint8Array(bytes),
          fileName: uploaded.name,
          fileSize: uploaded.size,
        })

        if (pdfData.pageText) {
          // ── Relevance check ───────────────────────────────────────────────
          // We have enough text to judge whether this is a MassHealth document.
          // If no markers are found the PDF is almost certainly unrelated.
          if (!isMasshealthDocument(pdfData.pageText)) {
            logServerInfo("parse-application.rejected-irrelevant", { userId: authResult.userId })
            return NextResponse.json<ParseApplicationErrorResponse>(
              {
                ok: false,
                error: "This doesn't look like a MassHealth application. Please upload your ACA-3 or other MassHealth form.",
                errorCode: "not_masshealth_form",
              },
              { status: 422 },
            )
          }

          const { formData: extractedFormData, fieldsFound } = parseAca3Text(pdfData.pageText)

          if (fieldsFound.length >= 2) {
            logServerInfo("parse-application.regex-success", { userId: authResult.userId, fieldsFound })
            return NextResponse.json<ParseApplicationResponse>({
              ok: true,
              formData: extractedFormData,
              fieldsFound,
              source: "pdf-fields",
            })
          }

          // Regex found too little — try Ollama on the extracted text as a better prompt
          const filledFields = pdfData.formFields.filter(
            (f) => f.value !== null && f.value !== "" && f.value !== false,
          )
          const fieldLines = filledFields
            .map((f) => `${f.name}: ${Array.isArray(f.value) ? f.value.join(", ") : String(f.value)}`)
            .join("\n")
          const documentText = [fieldLines, pdfData.pageText].filter(Boolean).join("\n\n")

          try {
            const prompt = buildExtractionPrompt(documentText)
            const raw = await extractViaOllama(prompt, OLLAMA_MODEL)
            const record = parseJsonFromLlm(raw)
            const { formData: llmFormData, fieldsFound: llmFields } = buildFormDataFromRecord(record)
            if (llmFields.length > 0) {
              logServerInfo("parse-application.pdf-llm-success", { userId: authResult.userId, fieldsFound: llmFields })
              return NextResponse.json<ParseApplicationResponse>({
                ok: true,
                formData: llmFormData,
                fieldsFound: llmFields,
                source: "llm",
              })
            }
          } catch {
            // Ollama unavailable — fall through to vision path
          }
        }
      } catch (err) {
        logServerError("parse-application.pdf-extract-error", err, { route: "/api/documents/parse-application" })
      }
    }

    // ── Path 3: Ollama vision (images or scanned PDFs) ────────────────────
    try {
      const base64 = Buffer.from(bytes).toString("base64")
      const model = isPdf ? OLLAMA_MODEL : OLLAMA_VISION_MODEL

      // For images, ask the vision model to first describe what it sees, then extract fields
      const ocrPrompt = isPdf
        ? buildExtractionPrompt("(No text could be extracted from this PDF — analyze the document structure.)")
        : [
            "This is a photo or scan of a MassHealth application form.",
            "First, read all the text you can see. Then extract the applicant's information.",
            "Return ONLY a valid JSON object with these keys (empty string if not found):",
            JSON.stringify(Object.fromEntries(Object.keys(FIELD_LABELS).map((k) => [k, ""])), null, 2),
          ].join("\n")

      const raw = await extractViaOllama(ocrPrompt, model, isPdf ? undefined : base64)
      const record = parseJsonFromLlm(raw)
      const { formData: extractedFormData, fieldsFound } = buildFormDataFromRecord(record)

      logServerInfo("parse-application.vision-success", { userId: authResult.userId, fieldsFound })
      return NextResponse.json<ParseApplicationResponse>({
        ok: true,
        formData: extractedFormData,
        fieldsFound,
        source: "llm",
      })
    } catch {
      // All paths failed — return empty formData so the assistant starts fresh
    }

    logServerInfo("parse-application.all-paths-failed", { userId: authResult.userId })
    return NextResponse.json<ParseApplicationResponse>({
      ok: true,
      formData: {},
      fieldsFound: [],
      source: "fallback",
    })
  } catch (error) {
    logServerError("parse-application.error", error, { route: "/api/documents/parse-application" })
    return NextResponse.json({ ok: false, error: "Failed to parse document." }, { status: 500 })
  }
}
