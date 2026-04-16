/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * GET /api/social-worker/engagement-requests
 * Returns pending engagement requests directed at the authenticated SW.
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getSwProfile } from "@/lib/db/social-worker"
import { getSwPendingRequests } from "@/lib/db/sw-messaging"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const profile = await getSwProfile(authResult.userId)
    if (!profile || profile.status !== "approved") {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 })
    }

    const requests = await getSwPendingRequests(authResult.userId)
    return NextResponse.json({ ok: true, requests })
  } catch (error) {
    logServerError("GET /api/social-worker/engagement-requests failed", error, {
      module: "api/social-worker/engagement-requests",
    })
    return NextResponse.json({ ok: false, error: "Failed to load requests." }, { status: 500 })
  }
}
