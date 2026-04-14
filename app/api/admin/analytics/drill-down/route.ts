/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { getDrillDownRows } from "@/lib/db/admin-analytics"

export const runtime = "nodejs"

const VALID_TYPES = new Set(["apps-month", "apps-status", "users-month", "ai-month"])
const MAX_LIMIT = 50

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const { searchParams } = new URL(request.url)
  const type  = searchParams.get("type") ?? ""
  const value = searchParams.get("value") ?? ""
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)))

  if (!VALID_TYPES.has(type) || !value) {
    return NextResponse.json(
      { ok: false, error: "Invalid type or missing value" },
      { status: 400 },
    )
  }

  const result = await getDrillDownRows({ type, value, page, limit })
  return NextResponse.json({ ok: true, result })
}
