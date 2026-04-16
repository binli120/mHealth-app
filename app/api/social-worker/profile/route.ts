/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getSwProfile } from "@/lib/db/social-worker"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const profile = await getSwProfile(authResult.userId)
  return NextResponse.json({ ok: true, profile })
}
