/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  getPatientSocialWorkers,
  grantSocialWorkerAccess,
  revokeSocialWorkerAccess,
  searchApprovedSocialWorkers,
} from "@/lib/db/social-worker"
import { getDbPool } from "@/lib/db/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const socialWorkers = await getPatientSocialWorkers(authResult.userId)
  return NextResponse.json({ ok: true, socialWorkers })
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const body = (await request.json().catch(() => ({}))) as {
    socialWorkerEmail?: string
  }

  if (!body.socialWorkerEmail?.trim()) {
    return NextResponse.json({ ok: false, error: "socialWorkerEmail required" }, { status: 400 })
  }

  const results = await searchApprovedSocialWorkers(body.socialWorkerEmail.trim())
  const sw = results.find(
    (r) => r.email.toLowerCase() === body.socialWorkerEmail!.toLowerCase().trim(),
  )

  if (!sw) {
    return NextResponse.json(
      { ok: false, error: "No approved social worker found with that email." },
      { status: 404 },
    )
  }

  await grantSocialWorkerAccess(authResult.userId, sw.user_id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const body = (await request.json().catch(() => ({}))) as {
    socialWorkerId?: string
  }

  if (!body.socialWorkerId) {
    return NextResponse.json({ ok: false, error: "socialWorkerId required" }, { status: 400 })
  }

  // Verify the SW user exists
  const pool = getDbPool()
  const check = await pool.query<{ id: string }>(
    `SELECT id FROM public.users WHERE id = $1::uuid`,
    [body.socialWorkerId],
  )

  if (!check.rows[0]) {
    return NextResponse.json({ ok: false, error: "Social worker not found" }, { status: 404 })
  }

  await revokeSocialWorkerAccess(authResult.userId, body.socialWorkerId)
  return NextResponse.json({ ok: true })
}
