/**
 * GET /api/masshealth/income-verification/:applicationId
 *
 * Return the full verification case: requirements, per-source decisions,
 * aggregate status, and the incomeVerified flag.
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import {
  getIncomeVerificationCase,
  userCanAccessApplication,
} from "@/lib/db/income-verification"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { applicationId } = await context.params

    if (!UUID_PATTERN.test(applicationId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId must be a valid UUID." },
        { status: 400 },
      )
    }

    const canAccess = await userCanAccessApplication(authResult.userId, applicationId)
    if (!canAccess) {
      return NextResponse.json(
        { ok: false, error: "Application not found or not accessible." },
        { status: 403 },
      )
    }

    const verificationCase = await getIncomeVerificationCase(applicationId)

    if (!verificationCase) {
      // No checklist built yet — return a safe default so callers don't need
      // to special-case a 404 for applications that haven't reached income step.
      return NextResponse.json({
        ok: true,
        applicationId,
        status: "pending_documents",
        incomeVerified: false,
        requiredSourceCount: 0,
        verifiedSourceCount: 0,
        decisionReason: null,
        requirements: [],
        decisions: [],
      })
    }

    return NextResponse.json({ ok: true, ...verificationCase })
  } catch (error) {
    logServerError("Failed to fetch income verification case", error, {
      module: "api/masshealth/income-verification/[applicationId]",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to fetch income verification case." },
      { status: 500 },
    )
  }
}
