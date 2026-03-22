/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { requireApprovedSocialWorker } from "@/lib/auth/require-social-worker"
import { getPatientApplications } from "@/lib/db/social-worker"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const authResult = await requireApprovedSocialWorker(request)
  if (!authResult.ok) return authResult.response

  const { patientId } = await params
  const applications = await getPatientApplications(patientId, authResult.userId)
  return NextResponse.json({ ok: true, applications })
}
