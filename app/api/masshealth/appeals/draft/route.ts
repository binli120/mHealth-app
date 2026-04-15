/**
 * POST /api/masshealth/appeals/draft
 * Proxy → masshealth-analysis service: POST /masshealth/appeals/draft
 * Generates a full appeal letter via Gemma3. Typically takes 30–90 seconds.
 * @author Bin Lee
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError, logServerInfo } from "@/lib/server/logger"

export const runtime = "nodejs"

// Allow up to 120 s — the LLM generation can take 30–90 s on modest hardware
export const maxDuration = 120

const ANALYSIS_BASE = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL ?? "http://localhost:8000"

function isMultipartRequest(request: Request): boolean {
  return (request.headers.get("Content-Type") ?? "").toLowerCase().includes("multipart/form-data")
}

async function buildUpstreamRequest(request: Request): Promise<{
  body: BodyInit
  headers: Record<string, string>
}> {
  if (!isMultipartRequest(request)) {
    return {
      body:    await request.text(),
      headers: { "Content-Type": "application/json" },
    }
  }

  const incomingFormData = await request.formData()
  const upstreamFormData = new FormData()

  for (const [key, value] of incomingFormData.entries()) {
    if (typeof value === "string") {
      upstreamFormData.append(key, value)
    } else {
      upstreamFormData.append(key, value, value.name)
    }
  }

  return {
    body:    upstreamFormData,
    headers: {},
  }
}

export async function POST(request: Request) {
  const start = Date.now()
  logServerInfo("masshealth.appeals.draft.start", { route: "/api/masshealth/appeals/draft" })

  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  try {
    const upstreamRequest = await buildUpstreamRequest(request)
    const upstream = await fetch(`${ANALYSIS_BASE}/masshealth/appeals/draft`, {
      method:  "POST",
      headers: {
        ...upstreamRequest.headers,
        "user-id": authResult.userId,
      },
      body: upstreamRequest.body,
      // Generous timeout — Gemma3 on CPU can be slow
      signal: AbortSignal.timeout(115_000),
    })

    const responseBody = await upstream.text()
    logServerInfo("masshealth.appeals.draft.done", { status: upstream.status, ms: Date.now() - start })
    return new NextResponse(responseBody, {
      status:  upstream.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    logServerError("masshealth.appeals.draft.error", err, { timeout: isTimeout, ms: Date.now() - start })
    return NextResponse.json(
      {
        ok:    false,
        error: isTimeout
          ? "Letter generation timed out — the model is under heavy load. Please try again."
          : "Appeal draft service unavailable",
      },
      { status: isTimeout ? 504 : 503 },
    )
  }
}
