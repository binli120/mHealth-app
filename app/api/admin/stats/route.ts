/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { getAdminStats } from "@/lib/db/admin"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const stats = await getAdminStats()
  return NextResponse.json({ ok: true, stats })
}
