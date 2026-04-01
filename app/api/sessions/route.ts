/**
 * GET  /api/sessions  — list sessions for the authenticated user
 * POST /api/sessions  — social worker creates a session (sends invite notification)
 * @author Bin Lee
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { requireApprovedSocialWorker } from "@/lib/auth/require-social-worker"
import { createSession, listSessionsForUser } from "@/lib/collaborative-sessions/db"
import { notifySessionInvite } from "@/lib/notifications/service"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

// ── GET /api/sessions ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role") === "sw" ? "sw" : "patient"

    const sessions = await listSessionsForUser(authResult.userId, role)
    return NextResponse.json({ ok: true, sessions })
  } catch (error) {
    logServerError("GET /api/sessions failed", error, { module: "api/sessions" })
    return NextResponse.json({ ok: false, error: "Failed to fetch sessions." }, { status: 500 })
  }
}

// ── POST /api/sessions ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authResult = await requireApprovedSocialWorker(request)
    if (!authResult.ok) return authResult.response

    const body = (await request.json().catch(() => null)) as {
      patientUserId?: string
      scheduledAt?: string | null
      inviteMessage?: string | null
    } | null

    if (!body?.patientUserId) {
      return NextResponse.json(
        { ok: false, error: "patientUserId is required." },
        { status: 400 },
      )
    }

    const session = await createSession({
      swUserId: authResult.userId,
      patientUserId: body.patientUserId,
      scheduledAt: body.scheduledAt ?? null,
      inviteMessage: body.inviteMessage ?? null,
    })
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "An active patient relationship is required to create a session." },
        { status: 403 },
      )
    }

    // Fire-and-forget invite notification
    notifySessionInvite(
      body.patientUserId,
      session.id,
      session.swName,
      body.scheduledAt ?? null,
      body.inviteMessage ?? null,
    ).catch((err) =>
      logServerError("notifySessionInvite failed", err, { module: "api/sessions", sessionId: session.id }),
    )

    return NextResponse.json({ ok: true, session }, { status: 201 })
  } catch (error) {
    logServerError("POST /api/sessions failed", error, { module: "api/sessions" })
    return NextResponse.json({ ok: false, error: "Failed to create session." }, { status: 500 })
  }
}
