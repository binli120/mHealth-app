/**
 * POST /api/reviewer/income-verification/:applicationId/decision
 *
 * Reviewer override for a single income source decision.
 * After recording the decision, recomputes the aggregate case so
 * incomeVerified is immediately consistent.
 *
 * Body JSON:
 *   memberId        string  (UUID)
 *   sourceType      IncomeSourceType
 *   status          IncomeVerificationStatus
 *   matchedAmount   number | null
 *   matchedFrequency string | null
 *   reasonCode      string
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import {
  upsertVerificationDecision,
  recomputeVerificationCase,
} from "@/lib/db/income-verification"
import type { IncomeSourceType, IncomeVerificationStatus } from "@/lib/masshealth/types"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VALID_STATUSES = new Set<IncomeVerificationStatus>([
  "verified",
  "needs_clarification",
  "needs_additional_document",
  "manual_review",
  "attested_pending_review",
  "pending",
])

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

    let body: {
      memberId:        string
      sourceType:      string
      status:          string
      matchedAmount:   number | null
      matchedFrequency: string | null
      reasonCode:      string
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: "Request body must be valid JSON." },
        { status: 400 },
      )
    }

    if (!UUID_PATTERN.test(body.memberId ?? "")) {
      return NextResponse.json(
        { ok: false, error: "memberId must be a valid UUID." },
        { status: 400 },
      )
    }

    if (!VALID_STATUSES.has(body.status as IncomeVerificationStatus)) {
      return NextResponse.json(
        { ok: false, error: `status "${body.status}" is not a valid IncomeVerificationStatus.` },
        { status: 400 },
      )
    }

    await upsertVerificationDecision({
      applicationId,
      memberId:        body.memberId,
      sourceType:      body.sourceType as IncomeSourceType,
      status:          body.status as IncomeVerificationStatus,
      matchedAmount:   body.matchedAmount ?? null,
      matchedFrequency: body.matchedFrequency ?? null,
      reviewerId:      authResult.userId,
      reasonCode:      body.reasonCode ?? "reviewer_override",
    })

    // Immediately recompute so incomeVerified is up to date
    const updatedCase = await recomputeVerificationCase(applicationId)

    return NextResponse.json({ ok: true, case: updatedCase })
  } catch (error) {
    logServerError("Failed to record reviewer income decision", error, {
      module: "api/reviewer/income-verification/[applicationId]/decision",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to record decision." },
      { status: 500 },
    )
  }
}
