/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * GET /api/masshealth/appeals/categories
 * Proxy → masshealth-analysis service: GET /masshealth/appeals/categories
 * Returns the 8 denial-reason taxonomy entries used to populate the dropdown.
 * @author: Bin Lee
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { FALLBACK_APPEAL_CATEGORIES } from "@/lib/masshealth/appeal-categories"
import { logServerError, logServerInfo } from "@/lib/server/logger"

export const runtime = "nodejs"

const ANALYSIS_BASE = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL ?? "http://localhost:8000"

function fallbackCategoriesResponse() {
  return NextResponse.json({
    ok: true,
    categories: FALLBACK_APPEAL_CATEGORIES,
    degraded: true,
    warning: "Using built-in appeal categories while the analysis service is unavailable.",
  })
}

export async function GET(request: Request) {
  const start = Date.now()
  logServerInfo("masshealth.appeals.categories.start", { route: "/api/masshealth/appeals/categories" })

  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  try {
    const upstream = await fetch(`${ANALYSIS_BASE}/masshealth/appeals/categories`, {
      method: "GET",
      headers: { "user-id": authResult.userId },
    })

    const body = await upstream.text()
    logServerInfo("masshealth.appeals.categories.done", { status: upstream.status, ms: Date.now() - start })

    if (!upstream.ok) {
      logServerInfo("masshealth.appeals.categories.fallback", {
        status: upstream.status,
        ms: Date.now() - start,
      })
      return fallbackCategoriesResponse()
    }

    return new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    logServerError("masshealth.appeals.categories.error", err, { ms: Date.now() - start })
    return fallbackCategoriesResponse()
  }
}
