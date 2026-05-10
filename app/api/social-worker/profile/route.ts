/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getSwProfile, setSwAcceptingPatients } from "@/lib/db/social-worker"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const profile = await getSwProfile(authResult.userId)
  return NextResponse.json({ ok: true, profile })
}

export async function PATCH(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).accepting_patients !== "boolean"
  ) {
    return NextResponse.json(
      { ok: false, error: "accepting_patients (boolean) is required" },
      { status: 400 },
    )
  }

  const { accepting_patients } = body as { accepting_patients: boolean }

  // Verify the caller is an approved SW before allowing the toggle.
  const profile = await getSwProfile(authResult.userId)
  if (!profile || profile.status !== "approved") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  await setSwAcceptingPatients(authResult.userId, accepting_patients)
  return NextResponse.json({ ok: true, accepting_patients })
}
