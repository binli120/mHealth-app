/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * POST /api/handoff/[token]/complete — authenticated (mobile has session from exchange)
 */
import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { completeHandoffSession } from "@/lib/db/mobile-handoff-session"
import { logServerError } from "@/lib/server/logger"

interface RouteContext { params: Promise<{ token: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { token } = await params
  let body: { progressSummary?: Record<string, unknown> }
  try { body = await request.json() } catch { body = {} }

  try {
    await completeHandoffSession(token, auth.userId, body.progressSummary ?? {})
    return NextResponse.json({ ok: true })
  } catch (err) {
    logServerError("Failed to complete handoff session", err, { module: "handoff-complete" })
    return NextResponse.json({ ok: false, error: "Complete failed" }, { status: 500 })
  }
}
