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

export async function POST(request: Request) {
  const start = Date.now()
  logServerInfo("masshealth.appeals.draft.start", { route: "/api/masshealth/appeals/draft" })

  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const body = await request.text()

  try {
    const upstream = await fetch(`${ANALYSIS_BASE}/masshealth/appeals/draft`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "user-id":      authResult.userId,
      },
      body,
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
