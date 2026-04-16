/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { getAnalyticsData } from "@/lib/db/admin-analytics"

export const runtime = "nodejs"

const VALID_MONTHS = new Set([3, 6, 12])

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const { searchParams } = new URL(request.url)
  const rawMonths = parseInt(searchParams.get("months") ?? "12", 10)
  const months = VALID_MONTHS.has(rawMonths) ? rawMonths : 12

  try {
    const data = await getAnalyticsData(months)
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error("[admin/analytics] failed to load analytics data", err)
    return NextResponse.json({ ok: false, error: "Failed to load analytics" }, { status: 500 })
  }
}
