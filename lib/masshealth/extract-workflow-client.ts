export interface ExtractWorkflowPayload {
  userId: string
  file: File
}

export interface ExtractWorkflowResponse {
  status: string
  user_id: string
  source_pdf: string
  application?: string
  detected_form_variant?: string
  workflow_json_path?: string
  workflow_data: Record<string, unknown>
  extraction?: {
    engine?: string
    extraction_method?: string
    page_count_processed?: number
    warnings?: string[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

const DEFAULT_DEV_BASE_URL = "http://localhost:8000"
const EXTRACT_WORKFLOW_PATH = "/masshealth/forms/extract-workflow"

function getMasshealthFormsBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MASSHEALTH_FORMS_BASE_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, "")
  }

  if (process.env.NODE_ENV !== "production") {
    return DEFAULT_DEV_BASE_URL
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
  const endpoint = `${getMasshealthFormsBaseUrl()}${EXTRACT_WORKFLOW_PATH}`
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
