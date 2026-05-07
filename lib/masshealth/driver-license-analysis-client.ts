/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import {
  MASSHEALTH_FORMS_DEV_BASE_URL,
  MASSHEALTH_DRIVER_LICENSE_ANALYSIS_PATH,
} from "@/lib/masshealth/constants"
import { isDriverLicenseDocument } from "@/lib/uploads/document-requirements"

export interface DriverLicenseAnalysisPayload {
  userId: string
  frontFile: File
  backFile: File
}

export interface DriverLicenseAnalysisResult {
  valid: boolean
  issuingState: string | null
  documentType: string | null
  confidence: number | null
  reason: string | null
  raw: unknown
}

function getMasshealthAnalysisBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, "")

  if (process.env.NODE_ENV !== "production") return MASSHEALTH_FORMS_DEV_BASE_URL

  throw new Error(
    "Missing NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL. Set it to your MassHealth analysis service base URL.",
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return null
}

function firstBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") return value
  }
  return null
}

function normalizeState(value: string | null): string | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase()
  if (normalized === "MASSACHUSETTS") return "MA"
  return normalized.length === 2 ? normalized : normalized
}

function isMassachusetts(value: string | null): boolean {
  return normalizeState(value) === "MA"
}

export function parseDriverLicenseAnalysisResponse(payload: unknown): DriverLicenseAnalysisResult {
  const root = asRecord(payload)
  const result = asRecord(root.result)
  const license = asRecord(root.license)
  const document = asRecord(root.document)

  const issuingState = normalizeState(
    firstString(
      root.issuing_state,
      root.issuingState,
      root.state,
      result.issuing_state,
      result.issuingState,
      result.state,
      license.issuing_state,
      license.issuingState,
      document.issuing_state,
      document.issuingState,
    ),
  )

  const documentType = firstString(
    root.document_type,
    root.documentType,
    root.type,
    result.document_type,
    result.documentType,
    document.document_type,
    document.documentType,
  )

  const explicitValid = firstBoolean(
    root.valid_ma_driver_license,
    root.is_valid_ma_driver_license,
    root.isMassachusettsDriverLicense,
    root.is_massachusetts_driver_license,
    root.is_valid,
    root.valid,
    root.ok,
    result.valid_ma_driver_license,
    result.is_valid_ma_driver_license,
    result.is_valid,
    result.valid,
  )

  const valid =
    explicitValid ??
    (isMassachusetts(issuingState) && isDriverLicenseDocument(documentType, "driver license"))

  return {
    valid,
    issuingState,
    documentType,
    confidence: firstNumber(root.confidence, result.confidence, document.confidence),
    reason: firstString(root.reason, root.error, result.reason, result.error),
    raw: payload,
  }
}

export function isValidMassachusettsDriverLicense(result: DriverLicenseAnalysisResult): boolean {
  if (!result.valid) return false
  if (result.issuingState && !isMassachusetts(result.issuingState)) return false
  if (result.documentType && !isDriverLicenseDocument(result.documentType, "driver license")) return false
  return true
}

export async function analyzeMassachusettsDriverLicenseImages({
  userId,
  frontFile,
  backFile,
}: DriverLicenseAnalysisPayload): Promise<DriverLicenseAnalysisResult> {
  const endpoint = `${getMasshealthAnalysisBaseUrl()}${MASSHEALTH_DRIVER_LICENSE_ANALYSIS_PATH}`
  const formData = new FormData()
  formData.append("front", frontFile, frontFile.name)
  formData.append("back", backFile, backFile.name)
  formData.append("user_id", userId)
  formData.append("expected_state", "MA")
  formData.append("document_type", "driver_license")

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  })

  const payload = (await response.json().catch(() => ({}))) as unknown

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error || "")
        : ""

    throw new Error(
      errorMessage || `Driver license analysis failed with status ${response.status}.`,
    )
  }

  return parseDriverLicenseAnalysisResponse(payload)
}

