/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * GET /api/admin/phi-audit
 *
 * Returns a paginated list of PHI access audit log entries.
 * Only accessible to admins (requireAdmin guard).
 *
 * Query parameters:
 *   userId  — filter to a specific user (optional)
 *   limit   — page size (default: 50, max: 200)
 *   offset  — pagination offset (default: 0)
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logServerError } from "@/lib/server/logger"
import { getPhiAuditLogs } from "@/lib/db/phi-audit"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") ?? undefined
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200)
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0)

    const page = await getPhiAuditLogs({ userId, limit, offset })

    return NextResponse.json({ ok: true, ...page })
  } catch (error) {
    logServerError("admin/phi-audit.GET", error)
    return NextResponse.json(
      { ok: false, error: "Unable to retrieve PHI audit log." },
      { status: 500 },
    )
  }
}
