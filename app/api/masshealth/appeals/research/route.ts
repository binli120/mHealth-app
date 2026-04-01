/**
 * POST /api/masshealth/appeals/research
 * Proxy → masshealth-analysis service: POST /masshealth/appeals/research
 * Returns matched categories, evidence checklist, argument themes, and top sources.
 * @author Bin Lee
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError, logServerInfo } from "@/lib/server/logger"

export const runtime = "nodejs"

const ANALYSIS_BASE = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL ?? "http://localhost:8000"

export async function POST(request: Request) {
  const start = Date.now()
  logServerInfo("masshealth.appeals.research.start", { route: "/api/masshealth/appeals/research" })

  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const body = await request.text()

  try {
    const upstream = await fetch(`${ANALYSIS_BASE}/masshealth/appeals/research`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "user-id":      authResult.userId,
      },
      body,
    })

    const responseBody = await upstream.text()
    logServerInfo("masshealth.appeals.research.done", { status: upstream.status, ms: Date.now() - start })
    return new NextResponse(responseBody, {
      status:  upstream.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    logServerError("masshealth.appeals.research.error", err, { ms: Date.now() - start })
    return NextResponse.json(
      { ok: false, error: "Appeal research service unavailable" },
      { status: 503 },
    )
  }
}
