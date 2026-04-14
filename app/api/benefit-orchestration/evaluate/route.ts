/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { upsertFamilyProfile, saveStackResult } from "@/lib/db/benefit-orchestration"
import { evaluateBenefitStack } from "@/lib/benefit-orchestration"
import type { FamilyProfile } from "@/lib/benefit-orchestration/types"

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = (await request.json().catch(() => null)) as FamilyProfile | null
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Request body must be a valid FamilyProfile object." },
        { status: 400 }
      )
    }

    // Basic validation
    if (typeof body.age !== "number" || body.age < 0 || body.age > 120) {
      return NextResponse.json({ ok: false, error: "Invalid age in profile." }, { status: 400 })
    }
    if (!body.citizenshipStatus) {
      return NextResponse.json({ ok: false, error: "citizenshipStatus is required." }, { status: 400 })
    }
    if (!Array.isArray(body.householdMembers)) {
      return NextResponse.json({ ok: false, error: "householdMembers must be an array." }, { status: 400 })
    }

    // 1. Save/update the family profile
    const profileResult = await upsertFamilyProfile(authResult.userId, body)

    // 2. Run the orchestrator (pure synchronous rule engine — fast)
    const stack = evaluateBenefitStack(body)
    stack.profileId = profileResult.id

    // 3. Persist the stack result for history / auditability
    const stackResult = await saveStackResult(profileResult.id, stack)

    return NextResponse.json({
      ok: true,
      profileId: profileResult.id,
      stackResultId: stackResult.id,
      stack,
    })
  } catch (error) {
    const message =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "Failed to evaluate benefit stack."
    const status = error instanceof Error && error.message.includes("not found") ? 404 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
