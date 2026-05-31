/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

const ANALYSIS_PDF_TIMEOUT_MS = 90_000
const ANALYSIS_FILL_ACA3_PATH = "/masshealth/fill/aca3"

const fillRequestSchema = z.object({
  applicationId: z.string().trim().optional(),
  workflowData: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

function getAnalysisBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL ||
    process.env.NEXT_PUBLIC_MASSHEALTH_FORMS_BASE_URL ||
    "http://localhost:8000"
  ).replace(/\/+$/, "")
}

async function readUpstreamError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null) as unknown
    if (payload && typeof payload === "object") {
      const detail = "detail" in payload ? (payload as { detail?: unknown }).detail : payload
      if (typeof detail === "string") return detail
      if (detail && typeof detail === "object" && "message" in detail) {
        const message = (detail as { message?: unknown }).message
        if (typeof message === "string") return message
      }
    }
  }

  const text = await response.text().catch(() => "")
  return text.trim() || `MassHealth analysis PDF generation failed with status ${response.status}.`
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const body = await request.json()
    const payload = fillRequestSchema.parse(body)
    const workflowData = payload.workflowData ?? body

    if (!workflowData || typeof workflowData !== "object" || Array.isArray(workflowData)) {
      return NextResponse.json(
        { error: "Invalid ACA workflow payload." },
        { status: 422 },
      )
    }

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), ANALYSIS_PDF_TIMEOUT_MS)

    try {
      const upstream = await fetch(`${getAnalysisBaseUrl()}${ANALYSIS_FILL_ACA3_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.MASSHEALTH_API_TOKEN
            ? { Authorization: `Bearer ${process.env.MASSHEALTH_API_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          user_id: authResult.userId,
          document_type: "ACA-3",
          workflow_data: workflowData,
        }),
        signal: abortController.signal,
      })

      if (!upstream.ok) {
        const message = await readUpstreamError(upstream)
        return NextResponse.json({ error: message }, { status: upstream.status })
      }

      const pdfBytes = await upstream.arrayBuffer()
      const filename = `ACA-3-0325-filled-${new Date().toISOString().slice(0, 10)}.pdf`

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": upstream.headers.get("content-disposition") ?? `attachment; filename=\"${filename}\"`,
          "Cache-Control": "no-store",
        },
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    logServerError("Failed to generate ACA PDF", error, {
      route: "/api/forms/aca-3-0325/fill",
      method: "POST",
    })

    const isValidationError = error instanceof z.ZodError
    const isTimeout = error instanceof Error && error.name === "AbortError"

    return NextResponse.json(
      {
        error: isValidationError
          ? "Invalid ACA workflow payload."
          : isTimeout
            ? "MassHealth analysis PDF generation timed out."
            : "Unable to generate filled ACA PDF",
      },
      {
        status: isValidationError ? 422 : isTimeout ? 504 : 500,
      },
    )
  }
}
