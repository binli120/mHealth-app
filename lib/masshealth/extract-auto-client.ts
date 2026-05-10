/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

export type {
  ExtractAutoPayload,
  ExtractAutoResponse,
  ExtractAutoMethod,
  ExtractAutoPdfType,
  ExtractAutoResult,
  ExtractAutoResultWorkflow,
  ExtractAutoResultStructured,
} from "./types"
import type { ExtractAutoPayload, ExtractAutoResponse } from "./types"

import {
  MASSHEALTH_FORMS_DEV_BASE_URL,
  MASSHEALTH_ANALYSIS_EXTRACT_AUTO_PATH,
} from "./constants"

function getMasshealthAnalysisBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, "")
  }

  if (process.env.NODE_ENV !== "production") {
    return MASSHEALTH_FORMS_DEV_BASE_URL
  }

  throw new Error(
    "Missing NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL. Set it to your MassHealth analysis service base URL.",
  )
}

function assertOkResponseShape(payload: unknown): asserts payload is ExtractAutoResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Extract auto response is not an object.")
  }

  const candidate = payload as Record<string, unknown>

  if (!candidate.scan || typeof candidate.scan !== "object") {
    throw new Error("Extract auto response is missing scan.")
  }

  const scan = candidate.scan as Record<string, unknown>
  if (typeof scan.pdf_type !== "string") {
    throw new Error("Extract auto response scan is missing pdf_type.")
  }

  if (typeof candidate.extraction_method !== "string") {
    throw new Error("Extract auto response is missing extraction_method.")
  }

  if (!candidate.result || typeof candidate.result !== "object") {
    throw new Error("Extract auto response is missing result.")
  }
}

export async function extractMasshealthAuto({
  userId,
  file,
  documentType = "aca3",
}: ExtractAutoPayload): Promise<ExtractAutoResponse> {
  const endpoint = `${getMasshealthAnalysisBaseUrl()}${MASSHEALTH_ANALYSIS_EXTRACT_AUTO_PATH}`
  const formData = new FormData()
  formData.append("file", file, file.name)
  formData.append("user_id", userId)
  formData.append("document_type", documentType)

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  })

  const payload = (await response.json().catch(() => ({}))) as unknown

  if (!response.ok) {
    // Server wraps error details under `detail` (FastAPI convention)
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? (payload as { detail?: unknown }).detail
        : payload

    const errorCode =
      detail && typeof detail === "object" && "error" in detail
        ? String((detail as { error?: unknown }).error || "")
        : ""

    const errorMessage =
      detail && typeof detail === "object" && "message" in detail
        ? String((detail as { message?: unknown }).message || "")
        : errorCode || `Extract auto request failed with status ${response.status}.`

    const err = new Error(errorMessage)
    // Attach the error code so callers can distinguish expected rejections
    // (e.g. "blank_template") from unexpected server errors.
    ;(err as Error & { code?: string }).code = errorCode
    throw err
  }

  assertOkResponseShape(payload)

  return payload
}
