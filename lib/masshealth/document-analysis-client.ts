/**
 * Client and validation helpers for the MassHealth image document analysis API.
 */

import "server-only"

import type { ApplicationDraftRecord } from "@/lib/db/application-drafts"
import { canAnalyzeImageDocument } from "@/lib/uploads/document-artifacts"

export type AnalyzableDocumentType = "driver_license" | "passport" | "paystub"

export interface DocumentAnalysisOutcome {
  analysisDocumentType: AnalyzableDocumentType | null
  status: "not_required" | "valid" | "invalid" | "error"
  documentStatus: "uploaded" | "pending_review" | "verified" | "rejected"
  summary: Record<string, unknown> | null
  certificate: Record<string, unknown> | null
  rawOutput: Record<string, unknown> | null
  error: string | null
}

interface AnalyzeDocumentParams {
  userId: string
  documentType?: string | null
  documentLabel?: string | null
  file: File
  backFile?: File | null
  mimeType: string
  draft: ApplicationDraftRecord | null
}

interface ExpectedApplicationData {
  firstName: string
  lastName: string
  dob: string
  incomeSources: Array<{ employer: string; amount: string; frequency: string }>
}

const ENDPOINTS: Record<AnalyzableDocumentType, string> = {
  driver_license: "/masshealth/driver-license/analyze",
  passport: "/masshealth/passport/analyze",
  paystub: "/masshealth/paystub/analyze",
}

function getAnalysisBaseUrl(): string {
  return (
    process.env.MASSHEALTH_IMAGE_ANALYSIS_BASE_URL ||
    process.env.MASSHEALTH_ANALYSIS_BASE_URL ||
    "http://localhost:8000"
  ).replace(/\/$/, "")
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function normalizeName(value: string | null | undefined): string {
  return normalizeText(value)
}

function normalizeDate(value: string | null | undefined): string {
  const raw = (value ?? "").trim()
  if (!raw) return ""
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!us) return raw

  const month = us[1].padStart(2, "0")
  const day = us[2].padStart(2, "0")
  let year = us[3]
  if (year.length === 2) {
    const currentYear = new Date().getFullYear() % 100
    const yearNumber = Number(year)
    year = String(yearNumber <= currentYear ? 2000 + yearNumber : 1900 + yearNumber)
  }
  return `${year}-${month}-${day}`
}

function detectDocumentType(documentType?: string | null, documentLabel?: string | null): AnalyzableDocumentType | null {
  const text = normalizeText(`${documentType ?? ""} ${documentLabel ?? ""}`)
  if (!text) return null

  if (/\b(driver|drivers|driving)\s+licen[sc]e\b/.test(text) || /\bdl\b/.test(text)) {
    return "driver_license"
  }
  if (text.includes("passport")) return "passport"
  if (text.includes("paystub") || text.includes("pay stub") || text.includes("proof of income")) {
    return "paystub"
  }
  return null
}

function readDraftFormData(draft: ApplicationDraftRecord | null): Record<string, unknown> {
  const state = draft?.draftState
  if (!state || typeof state !== "object") return {}
  const formAssistant = state.formAssistant
  if (formAssistant && typeof formAssistant === "object" && "formData" in formAssistant) {
    const formData = (formAssistant as { formData?: unknown }).formData
    return formData && typeof formData === "object" ? formData as Record<string, unknown> : {}
  }
  const formData = state.formData
  return formData && typeof formData === "object" ? formData as Record<string, unknown> : {}
}

function readExpectedData(draft: ApplicationDraftRecord | null): ExpectedApplicationData {
  const formData = readDraftFormData(draft)
  const incomeSources = Array.isArray(formData.incomeSources)
    ? formData.incomeSources
        .filter((source): source is Record<string, unknown> => Boolean(source && typeof source === "object"))
        .map((source) => ({
          employer: typeof source.employer === "string" ? source.employer : "",
          amount: typeof source.amount === "string" ? source.amount : "",
          frequency: typeof source.frequency === "string" ? source.frequency : "",
        }))
    : []

  return {
    firstName: typeof formData.firstName === "string" ? formData.firstName : "",
    lastName: typeof formData.lastName === "string" ? formData.lastName : "",
    dob: typeof formData.dob === "string" ? formData.dob : "",
    incomeSources,
  }
}

function hasFixtureInvalidIndicators(raw: Record<string, unknown>): boolean {
  const indicators = raw.fixture_indicators
  if (!indicators || typeof indicators !== "object") return false
  return Object.values(indicators).some((value) => value === true)
}

function validateIdentity(raw: Record<string, unknown>, expected: ExpectedApplicationData): string[] {
  const errors: string[] = []
  const expectedFullName = normalizeName(`${expected.firstName} ${expected.lastName}`)
  const expectedDob = normalizeDate(expected.dob)

  const passport = raw.passport && typeof raw.passport === "object" ? raw.passport as Record<string, unknown> : null
  const mrz = raw.mrz && typeof raw.mrz === "object" ? raw.mrz as Record<string, unknown> : null
  const mrzParsed = mrz?.parsed && typeof mrz.parsed === "object" ? mrz.parsed as Record<string, unknown> : null
  const license = raw.license && typeof raw.license === "object" ? raw.license as Record<string, unknown> : null

  const extractedName = normalizeName(
    license?.name as string |
    undefined ?? `${passport?.given_names ?? mrzParsed?.given_names ?? ""} ${passport?.surname ?? mrzParsed?.surname ?? ""}`,
  )
  const extractedDob = normalizeDate(
    (license?.date_of_birth ?? passport?.date_of_birth ?? mrzParsed?.date_of_birth) as string | undefined,
  )

  if (expectedFullName && extractedName && !expectedFullName.split(" ").every((part) => extractedName.includes(part))) {
    errors.push("Document name does not match the applicant name entered in the application.")
  }
  if (expectedDob && extractedDob && expectedDob !== extractedDob) {
    errors.push("Document date of birth does not match the application date of birth.")
  }
  if (hasFixtureInvalidIndicators(raw)) {
    errors.push("Document analysis flagged sample, fictional, test, or invalid machine-readable indicators.")
  }

  return errors
}

function validatePaystub(raw: Record<string, unknown>, expected: ExpectedApplicationData): string[] {
  const errors: string[] = []
  const employer = raw.employer && typeof raw.employer === "object" ? raw.employer as Record<string, unknown> : null
  const employee = raw.employee && typeof raw.employee === "object" ? raw.employee as Record<string, unknown> : null
  const payData = raw.pay_data && typeof raw.pay_data === "object" ? raw.pay_data as Record<string, unknown> : null
  const currentAmount = payData?.current_payment_amount

  const extractedEmployee = normalizeName(employee?.name as string | undefined)
  const expectedName = normalizeName(`${expected.firstName} ${expected.lastName}`)
  if (expectedName && extractedEmployee && !expectedName.split(" ").every((part) => extractedEmployee.includes(part))) {
    errors.push("Paystub employee name does not match the applicant name entered in the application.")
  }

  const expectedEmployers = expected.incomeSources.map((source) => normalizeText(source.employer)).filter(Boolean)
  const extractedEmployer = normalizeText(employer?.name as string | undefined)
  if (expectedEmployers.length > 0 && extractedEmployer && !expectedEmployers.some((name) => extractedEmployer.includes(name) || name.includes(extractedEmployer))) {
    errors.push("Paystub employer does not match the employer entered in the application.")
  }

  if (typeof currentAmount !== "number" || currentAmount <= 0) {
    errors.push("Paystub analysis could not identify a positive current payment amount.")
  }

  return errors
}

async function callAnalysisApi(params: AnalyzeDocumentParams & { analysisType: AnalyzableDocumentType }): Promise<Record<string, unknown>> {
  const formData = new FormData()
  formData.set("file", params.file)
  if (params.backFile) formData.set("back_file", params.backFile)
  formData.set("user_id", params.userId)
  formData.set("document_type", params.analysisType)

  const response = await fetch(`${getAnalysisBaseUrl()}${ENDPOINTS[params.analysisType]}`, {
    method: "POST",
    body: formData,
  })
  const body = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : `Document analysis failed with HTTP ${response.status}.`
    throw new Error(detail)
  }
  return body ?? {}
}

export async function analyzeAndValidateDocument(params: AnalyzeDocumentParams): Promise<DocumentAnalysisOutcome> {
  const analysisType = detectDocumentType(params.documentType, params.documentLabel)
  if (!analysisType) {
    return {
      analysisDocumentType: null,
      status: "not_required",
      documentStatus: "uploaded",
      summary: null,
      certificate: null,
      rawOutput: null,
      error: null,
    }
  }

  if (!canAnalyzeImageDocument(params.mimeType)) {
    return {
      analysisDocumentType: analysisType,
      status: "error",
      documentStatus: "pending_review",
      summary: null,
      certificate: null,
      rawOutput: null,
      error: "This document type requires image analysis. Upload a PNG, JPG, TIFF, or WebP image for automatic validation.",
    }
  }

  try {
    const raw = await callAnalysisApi({ ...params, analysisType })
    const expected = readExpectedData(params.draft)
    const errors = analysisType === "paystub"
      ? validatePaystub(raw, expected)
      : validateIdentity(raw, expected)
    const warnings = Array.isArray(raw.warnings) ? raw.warnings : []
    const valid = errors.length === 0
    const certificate = valid
      ? {
          issuedAt: new Date().toISOString(),
          documentType: analysisType,
          verifiedFields: analysisType === "paystub" ? ["employee", "employer", "pay"] : ["name", "date_of_birth"],
          warnings,
        }
      : null

    return {
      analysisDocumentType: analysisType,
      status: valid ? "valid" : "invalid",
      documentStatus: valid ? "verified" : "rejected",
      summary: {
        analysisType,
        elapsedMs: raw.elapsed_ms ?? null,
        extractionMethod: raw.extraction_method ?? null,
        errors,
        warnings,
      },
      certificate,
      rawOutput: raw,
      error: errors[0] ?? null,
    }
  } catch (error) {
    return {
      analysisDocumentType: analysisType,
      status: "error",
      documentStatus: "pending_review",
      summary: null,
      certificate: null,
      rawOutput: null,
      error: error instanceof Error ? error.message : "Document analysis failed.",
    }
  }
}
