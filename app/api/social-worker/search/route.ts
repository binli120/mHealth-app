/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { searchApprovedSocialWorkers } from "@/lib/db/social-worker"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const { searchParams } = new URL(request.url)
  // Support ?q= for name/company/email search; also keep legacy ?email= param
  const query = (searchParams.get("q") ?? searchParams.get("email") ?? "").trim()

  const results = await searchApprovedSocialWorkers(query)
  return NextResponse.json({ ok: true, results })
}
