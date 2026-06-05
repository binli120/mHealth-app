/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

// POST /api/auth/reset-mfa/confirm
// Called by the confirm page after it has exchanged the PKCE code for a session.
// Validates the Bearer token, unenrolls all TOTP factors for the user, then
// signs out the session so the user must log in fresh.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? ""
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  // Validate the token and retrieve the user.
  const serverClient = getSupabaseServerClient()
  const { data: { user }, error: userErr } = await serverClient.auth.getUser(accessToken)
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Invalid or expired token." }, { status: 401 })
  }

  // Use admin client to delete all TOTP factors for this user.
  const adminClient = getSupabaseAdminClient()
  const { data: factorData } = await adminClient.auth.admin.mfa.listFactors({ userId: user.id })
  const totpFactors = (factorData?.factors ?? []).filter((f) => f.factor_type === "totp")
  await Promise.all(
    totpFactors.map((f: { id: string }) =>
      adminClient.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id }),
    ),
  )

  // Sign out this session so the user must re-authenticate from scratch.
  await adminClient.auth.admin.signOut(accessToken)

  return NextResponse.json({ ok: true, removed: totpFactors.length })
}
