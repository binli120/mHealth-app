/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireApprovedSocialWorker } from "@/lib/auth/require-social-worker"
import { getSwPatients } from "@/lib/db/social-worker"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireApprovedSocialWorker(request)
  if (!authResult.ok) return authResult.response

  const patients = await getSwPatients(authResult.userId)
  return NextResponse.json({ ok: true, patients })
}
