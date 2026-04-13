/**
 * POST /api/masshealth/income-verification/checklist
 *
 * Build (or refresh) the per-member, per-source evidence checklist for an
 * application immediately after income capture during intake.
 *
 * This is idempotent: calling it again with updated household data refreshes
 * the requirements without losing existing decisions.
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import {
  upsertIncomeChecklist,
  userCanAccessApplication,
} from "@/lib/db/income-verification"
import type { IncomeChecklistRequest, IncomeChecklistResponse } from "@/lib/masshealth/types"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    let body: IncomeChecklistRequest
    try {
      body = (await request.json()) as IncomeChecklistRequest
    } catch {
      return NextResponse.json(
        { ok: false, error: "Request body must be valid JSON." },
        { status: 400 },
      )
    }

    const { applicationId, householdMembers } = body

    if (!applicationId || !UUID_PATTERN.test(applicationId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId must be a valid UUID." },
        { status: 400 },
      )
    }

    if (!Array.isArray(householdMembers) || householdMembers.length === 0) {
      return NextResponse.json(
        { ok: false, error: "householdMembers must be a non-empty array." },
        { status: 400 },
      )
    }

    // Validate each member has the required shape
    for (const m of householdMembers) {
      if (!m.memberId || !UUID_PATTERN.test(m.memberId)) {
        return NextResponse.json(
          { ok: false, error: `memberId "${m.memberId}" must be a valid UUID.` },
          { status: 400 },
        )
      }
    }

    const canAccess = await userCanAccessApplication(authResult.userId, applicationId)
    if (!canAccess) {
      return NextResponse.json(
        { ok: false, error: "Application not found or not accessible." },
        { status: 403 },
      )
    }

    const requirements = await upsertIncomeChecklist({ applicationId, householdMembers })

    const response: IncomeChecklistResponse = {
      applicationId,
      requirements,
      caseStatus: "pending_documents",
    }

    return NextResponse.json({ ok: true, ...response }, { status: 200 })
  } catch (error) {
    logServerError("Failed to build income checklist", error, {
      module: "api/masshealth/income-verification/checklist",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to build income checklist." },
      { status: 500 },
    )
  }
}
