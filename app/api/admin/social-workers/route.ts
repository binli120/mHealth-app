/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { listSocialWorkers, updateSocialWorkerStatus } from "@/lib/db/admin"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? undefined
  const status = searchParams.get("status") ?? undefined
  const companyId = searchParams.get("companyId") ?? undefined
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100)
  const offset = parseInt(searchParams.get("offset") ?? "0", 10)

  const data = await listSocialWorkers({ search, status, companyId, limit, offset })
  return NextResponse.json({ ok: true, ...data })
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const body = (await request.json().catch(() => ({}))) as {
    profileId?: string
    action?: "approve" | "reject"
    rejectionNote?: string
  }

  if (!body.profileId || !body.action) {
    return NextResponse.json({ ok: false, error: "profileId and action required" }, { status: 400 })
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ ok: false, error: "action must be approve or reject" }, { status: 400 })
  }

  await updateSocialWorkerStatus(
    body.profileId,
    body.action === "approve" ? "approved" : "rejected",
    authResult.userId,
    body.rejectionNote,
  )

  return NextResponse.json({ ok: true })
}
