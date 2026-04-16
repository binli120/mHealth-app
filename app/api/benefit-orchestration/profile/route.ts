/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getFamilyProfile, upsertFamilyProfile } from "@/lib/db/benefit-orchestration"
import type { FamilyProfile } from "@/lib/benefit-orchestration/types"

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const profile = await getFamilyProfile(authResult.userId)
    if (!profile) {
      return NextResponse.json({ ok: true, profile: null })
    }

    return NextResponse.json({ ok: true, profile: profile.profileData, profileId: profile.id, updatedAt: profile.updatedAt })
  } catch (error) {
    const message =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "Failed to fetch family profile."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = (await request.json().catch(() => null)) as FamilyProfile | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Request body must be a valid FamilyProfile object." }, { status: 400 })
    }

    // Basic validation
    if (typeof body.age !== "number" || body.age < 0 || body.age > 120) {
      return NextResponse.json({ ok: false, error: "Invalid age in profile." }, { status: 400 })
    }
    if (!body.citizenshipStatus) {
      return NextResponse.json({ ok: false, error: "citizenshipStatus is required." }, { status: 400 })
    }

    const result = await upsertFamilyProfile(authResult.userId, body)
    return NextResponse.json({ ok: true, profileId: result.id })
  } catch (error) {
    const message =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "Failed to save family profile."
    const status = error instanceof Error && error.message.includes("not found") ? 404 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
