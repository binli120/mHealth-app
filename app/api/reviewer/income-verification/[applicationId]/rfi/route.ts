/**
 * POST /api/reviewer/income-verification/:applicationId/rfi
 *
 * Issue a Request for Information with a tailored missing-proof checklist.
 * Stores the RFI event and updates the case status to rfi_sent.
 *
 * Body JSON:
 *   reasonCode    string        — short machine-readable code
 *   requestedDocs IncomeDocType[] — precise list of missing documents
 *   notes         string | null — optional reviewer note for the applicant
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import { insertRfiEvent, recomputeVerificationCase } from "@/lib/db/income-verification"
import { getDbPool } from "@/lib/db/server"
import type { IncomeDocType } from "@/lib/masshealth/types"

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

    let body: {
      reasonCode:    string
      requestedDocs: string[]
      notes?:        string | null
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: "Request body must be valid JSON." },
        { status: 400 },
      )
    }

    if (!body.reasonCode || typeof body.reasonCode !== "string") {
      return NextResponse.json(
        { ok: false, error: "reasonCode is required." },
        { status: 400 },
      )
    }

    if (!Array.isArray(body.requestedDocs) || body.requestedDocs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "requestedDocs must be a non-empty array." },
        { status: 400 },
      )
    }

    const rfiEvent = await insertRfiEvent({
      applicationId,
      reasonCode:    body.reasonCode,
      requestedDocs: body.requestedDocs as IncomeDocType[],
      createdBy:     authResult.userId,
    })

    // Push case status to rfi_sent
    const pool = getDbPool()
    await pool.query(
      `UPDATE public.income_verification_cases
       SET status = 'rfi_sent', updated_at = NOW()
       WHERE application_id = $1::uuid`,
      [applicationId],
    )

    const updatedCase = await recomputeVerificationCase(applicationId)

    return NextResponse.json({ ok: true, rfiEvent, case: updatedCase })
  } catch (error) {
    logServerError("Failed to issue income RFI", error, {
      module: "api/reviewer/income-verification/[applicationId]/rfi",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to issue RFI." },
      { status: 500 },
    )
  }
}
