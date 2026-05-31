/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { deleteCoverageRecord, getCoverageRecord, updateCoverageRecord } from "@/lib/db/insurance-history"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 })
    }
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const record = await getCoverageRecord(params.id, authResult.userId)
    if (!record) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    if (record.source === "platform") {
      return NextResponse.json({ ok: false, error: "Platform records cannot be edited" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const updated = await updateCoverageRecord(params.id, authResult.userId, {
      planName: body.planName,
      programCode: body.programCode,
      premiumMonthly: body.premiumMonthly,
      householdSize: body.householdSize,
      annualIncome: body.annualIncome,
      fplPercent: body.fplPercent,
      notes: body.notes,
    })
    return NextResponse.json({ ok: true, record: updated })
  } catch (err) {
    console.error("[insurance-history/records PUT]", err)
    return NextResponse.json({ ok: false, error: "Failed to update record" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 })
    }
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const record = await getCoverageRecord(params.id, authResult.userId)
    if (!record) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    if (record.source === "platform") {
      return NextResponse.json({ ok: false, error: "Platform records cannot be deleted" }, { status: 403 })
    }

    await deleteCoverageRecord(params.id, authResult.userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[insurance-history/records DELETE]", err)
    return NextResponse.json({ ok: false, error: "Failed to delete record" }, { status: 500 })
  }
}
