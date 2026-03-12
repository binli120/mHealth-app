// Types are defined in types.ts; re-exported here for backward compatibility.
export type { ExtractWorkflowPayload, ExtractWorkflowResponse } from "./types"
import type { ExtractWorkflowPayload, ExtractWorkflowResponse } from "./types"

import {
  MASSHEALTH_FORMS_DEV_BASE_URL,
  MASSHEALTH_FORMS_EXTRACT_PATH,
} from "./constants"

function getMasshealthFormsBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MASSHEALTH_FORMS_BASE_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, "")
  }

  if (process.env.NODE_ENV !== "production") {
    return MASSHEALTH_FORMS_DEV_BASE_URL
  }

  throw new Error(
    "Missing NEXT_PUBLIC_MASSHEALTH_FORMS_BASE_URL. Set it to your MassHealth forms service base URL.",
  )
}

function assertOkResponseShape(payload: unknown): asserts payload is ExtractWorkflowResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Extract workflow response is not an object.")
  }

  const candidate = payload as Record<string, unknown>
  if (typeof candidate.status !== "string") {
    throw new Error("Extract workflow response is missing status.")
  }

  if (typeof candidate.user_id !== "string") {
    throw new Error("Extract workflow response is missing user_id.")
  }

  if (typeof candidate.source_pdf !== "string") {
    throw new Error("Extract workflow response is missing source_pdf.")
  }

  if (!candidate.workflow_data || typeof candidate.workflow_data !== "object") {
    throw new Error("Extract workflow response is missing workflow_data.")
  }
}

export async function extractMasshealthWorkflow({
  userId,
  file,
}: ExtractWorkflowPayload): Promise<ExtractWorkflowResponse> {
  const endpoint = `${getMasshealthFormsBaseUrl()}${MASSHEALTH_FORMS_EXTRACT_PATH}`
  const formData = new FormData()
  formData.append("user_id", userId)
  formData.append("async_request", "false")
  formData.append("dpi", "300")
  formData.append("force_ocr", "false")
  formData.append("file", file, file.name)

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

    throw new Error(errorMessage || `Extract workflow request failed with status ${response.status}.`)
  }

  assertOkResponseShape(payload)

  if (payload.status.toLowerCase() !== "ok") {
    throw new Error(`Extract workflow response returned status "${payload.status}".`)
  }

  return payload
}
