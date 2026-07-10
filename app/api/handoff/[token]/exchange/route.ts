/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * POST /api/handoff/[token]/exchange — unauthenticated, single-use
 * Mobile device claims the token and receives the Supabase refresh token + context.
 */
import { NextResponse } from "next/server"
import { claimHandoffSession } from "@/lib/db/mobile-handoff-session"
import { logServerError } from "@/lib/server/logger"

interface RouteContext { params: Promise<{ token: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  const { token } = await params
  if (!token?.trim()) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 })
  }

  try {
    const session = await claimHandoffSession(token)
    if (!session) {
      return NextResponse.json({ ok: false, error: "Token already used or expired" }, { status: 409 })
    }
    return NextResponse.json({
      ok: true,
      refreshToken: session.decryptedRefreshToken,
      contextType: session.contextType,
      contextPayload: session.contextPayload,
    })
  } catch (err) {
    logServerError("Failed to exchange handoff token", err, { module: "handoff-exchange" })
    return NextResponse.json({ ok: false, error: "Exchange failed" }, { status: 500 })
  }
}
