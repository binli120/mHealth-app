/**
 * POST /api/masshealth/appeals/draft
 * Proxy → masshealth-analysis service: POST /masshealth/appeals/draft
 * Generates a full appeal letter via Gemma3. Typically takes 30–90 seconds.
 * @author Bin Lee
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError, logServerInfo } from "@/lib/server/logger"
import { reviewAppealLetterQuality } from "@/lib/agents/reflection/quality-gate"

export const runtime = "nodejs"

// Allow up to 120 s — the LLM generation can take 30–90 s on modest hardware
export const maxDuration = 120

const ANALYSIS_BASE = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL ?? "http://localhost:8000"

interface DraftResponseBody {
  letter_text?: unknown
  citations?: unknown
  reflection?: unknown
  [key: string]: unknown
}

function isMultipartRequest(request: Request): boolean {
  return (request.headers.get("Content-Type") ?? "").toLowerCase().includes("multipart/form-data")
}

function formatCitationContext(citations: unknown): string {
  if (!Array.isArray(citations)) return ""

  return citations
    .map((citation) => {
      if (!citation || typeof citation !== "object") return ""
      const item = citation as Record<string, unknown>
      const title = typeof item.title === "string" ? item.title : "Untitled source"
      const trustTier = typeof item.trust_tier === "string" ? item.trust_tier : "unknown"
      const excerpt = typeof item.excerpt === "string" ? item.excerpt : ""
      return [`Source: ${title}`, `Trust tier: ${trustTier}`, excerpt].filter(Boolean).join("\n")
    })
    .filter(Boolean)
    .join("\n\n")
}

async function reviewDraftResponseBody(responseBody: string): Promise<string> {
  try {
    const parsed = JSON.parse(responseBody) as DraftResponseBody
    if (typeof parsed.letter_text !== "string" || !parsed.letter_text.trim()) {
      return responseBody
    }

    const policyContext = formatCitationContext(parsed.citations)
    const qualityGate = await reviewAppealLetterQuality({
      appealLetter: parsed.letter_text,
      explanation: "",
      evidenceChecklist: [],
      policyContext,
    })

    return JSON.stringify({
      ...parsed,
      letter_text: qualityGate.finalText,
      reflection: qualityGate.review,
    })
  } catch {
    return responseBody
  }
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
      // Leave budget for the reflection quality gate before the 120 s route cap.
      signal: AbortSignal.timeout(95_000),
    })

    let responseBody = await upstream.text()
    if (upstream.ok) {
      responseBody = await reviewDraftResponseBody(responseBody)
    }
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
