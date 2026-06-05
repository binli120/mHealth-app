/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * POST /api/masshealth/benefit-policy-updates
 * Body: { benefitNames: string[], includeUnchanged?: boolean }
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  fetchBenefitPolicyUpdatesFromAnalysisService,
  fetchBenefitPolicyUpdatesFromLocalPython,
  type BenefitPolicyUpdatesRequest,
} from "@/lib/masshealth/benefit-policy-updates-client"
import { logServerError, logServerInfo } from "@/lib/server/logger"

export const runtime = "nodejs"

const ANALYSIS_BASE = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL ?? "http://localhost:8000"
const MASSHEALTH_API_TOKEN = process.env.MASSHEALTH_API_TOKEN ?? ""

export async function POST(request: Request) {
  const start = Date.now()
  logServerInfo("masshealth.benefitPolicyUpdates.start", {
    route: "/api/masshealth/benefit-policy-updates",
  })

  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const body = (await request.json().catch(() => null)) as Partial<BenefitPolicyUpdatesRequest> | null
  const validationError = validateRequestBody(body)
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 })
  }

  const payload: BenefitPolicyUpdatesRequest = {
    benefitNames: body!.benefitNames!.map((value) => value.trim()).filter(Boolean),
    includeUnchanged: body!.includeUnchanged === true,
  }

  try {
    const upstream = await fetchBenefitPolicyUpdatesFromAnalysisService(payload, {
      baseUrl: ANALYSIS_BASE,
      apiToken: MASSHEALTH_API_TOKEN,
      userId: authResult.userId,
    })
    logServerInfo("masshealth.benefitPolicyUpdates.done", {
      source: upstream.source,
      findings: upstream.findings.length,
      ms: Date.now() - start,
    })
    return NextResponse.json(upstream)
  } catch (error) {
    logServerError("masshealth.benefitPolicyUpdates.upstreamError", error, { ms: Date.now() - start })
  }

  try {
    const fallback = await fetchBenefitPolicyUpdatesFromLocalPython(payload)
    logServerInfo("masshealth.benefitPolicyUpdates.fallbackDone", {
      findings: fallback.findings.length,
      ms: Date.now() - start,
    })
    return NextResponse.json(fallback)
  } catch (error) {
    logServerError("masshealth.benefitPolicyUpdates.fallbackError", error, { ms: Date.now() - start })
    return NextResponse.json(
      { ok: false, error: "Failed to fetch MassHealth benefit policy updates." },
      { status: 502 },
    )
  }
}

function validateRequestBody(body: Partial<BenefitPolicyUpdatesRequest> | null): string | null {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object."
  }
  if (!Array.isArray(body.benefitNames)) {
    return "benefitNames must be an array of benefit names."
  }
  const benefitNames = body.benefitNames
  if (benefitNames.length === 0) {
    return "benefitNames must include at least one benefit name."
  }
  if (benefitNames.length > 20) {
    return "benefitNames cannot contain more than 20 values."
  }
  if (benefitNames.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    return "Each benefit name must be a non-empty string."
  }
  if (benefitNames.some((value) => value.length > 120)) {
    return "Benefit names must be 120 characters or fewer."
  }
  if (body.includeUnchanged !== undefined && typeof body.includeUnchanged !== "boolean") {
    return "includeUnchanged must be a boolean when provided."
  }
  return null
}
