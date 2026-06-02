/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { createCoverageRecord, listCoverageRecords } from "@/lib/db/insurance-history"

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const records = await listCoverageRecords(authResult.userId)
    return NextResponse.json({ ok: true, records })
  } catch (err) {
    console.error("[insurance-history/records GET]", err)
    return NextResponse.json({ ok: false, error: "Failed to load records" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = await request.json().catch(() => null)
    if (!body || typeof body.coverageYear !== "number" || !body.planName) {
      return NextResponse.json({ ok: false, error: "coverageYear and planName are required" }, { status: 400 })
    }

    const record = await createCoverageRecord({
      userId: authResult.userId,
      coverageYear: body.coverageYear,
      planName: body.planName,
      programCode: body.programCode ?? null,
      premiumMonthly: body.premiumMonthly ?? null,
      householdSize: body.householdSize ?? null,
      annualIncome: body.annualIncome ?? null,
      fplPercent: body.fplPercent ?? null,
      source: "self_reported",
      documentId: body.documentId ?? null,
      notes: body.notes ?? null,
    })
    return NextResponse.json({ ok: true, record }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique constraint")) {
      return NextResponse.json({ ok: false, error: "This plan is already recorded for that year." }, { status: 409 })
    }
    console.error("[insurance-history/records POST]", err)
    return NextResponse.json({ ok: false, error: "Failed to create record" }, { status: 500 })
  }
}
