/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { searchApprovedSocialWorkers } from "@/lib/db/social-worker"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const { searchParams } = new URL(request.url)
  const email = (searchParams.get("email") ?? "").trim()

  if (email.length < 2) {
    return NextResponse.json({ ok: true, results: [] })
  }

  const results = await searchApprovedSocialWorkers(email)
  return NextResponse.json({ ok: true, results })
}
