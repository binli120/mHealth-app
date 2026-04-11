/**
 * POST /api/masshealth/income-verification/:applicationId/recompute
 *
 * Idempotent recompute: re-aggregate all existing decisions into the case row.
 * Safe to call any time a document is uploaded, an extraction completes, or a
 * reviewer decision changes.  Returns the updated verification case.
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import {
  recomputeVerificationCase,
  userCanAccessApplication,
} from "@/lib/db/income-verification"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

export async function POST(request: Request, context: RouteContext) {
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

    const updatedCase = await recomputeVerificationCase(applicationId)

    if (!updatedCase) {
      return NextResponse.json(
        { ok: false, error: "No income checklist found. Submit /checklist first." },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, ...updatedCase })
  } catch (error) {
    logServerError("Failed to recompute income verification case", error, {
      module: "api/masshealth/income-verification/[applicationId]/recompute",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to recompute income verification case." },
      { status: 500 },
    )
  }
}
