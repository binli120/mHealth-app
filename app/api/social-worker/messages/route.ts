/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * GET /api/social-worker/messages
 * Returns all DM threads for the authenticated SW (one row per patient).
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getSwProfile } from "@/lib/db/social-worker"
import { getSwMessageThreads } from "@/lib/db/sw-messaging"
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

    const threads = await getSwMessageThreads(authResult.userId)
    return NextResponse.json({ ok: true, threads })
  } catch (error) {
    logServerError("GET /api/social-worker/messages failed", error, {
      module: "api/social-worker/messages",
    })
    return NextResponse.json({ ok: false, error: "Failed to load threads." }, { status: 500 })
  }
}
