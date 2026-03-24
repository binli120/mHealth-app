/**
 * GET   /api/sessions/[sessionId]  — fetch session details
 * PATCH /api/sessions/[sessionId]  — update session status
 *   Patient: scheduled → cancelled  (decline)
 *   SW:      scheduled → active     (start) | active → ended
 * @author Bin Lee
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getSession, updateSessionStatus, deleteSession } from "@/lib/collaborative-sessions/db"
import type { SessionStatus } from "@/lib/collaborative-sessions/types"
import { notifySessionStarting } from "@/lib/notifications/service"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

type Params = { params: Promise<{ sessionId: string }> }

// ── GET /api/sessions/[sessionId] ─────────────────────────────────────────────

export async function GET(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { sessionId } = await params
    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
    }

    // Only participants can read
    if (
      session.swUserId !== authResult.userId &&
      session.patientUserId !== authResult.userId
    ) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 })
    }

    return NextResponse.json({ ok: true, session })
  } catch (error) {
    logServerError("GET /api/sessions/[sessionId] failed", error, { module: "api/sessions/[sessionId]" })
    return NextResponse.json({ ok: false, error: "Failed to fetch session." }, { status: 500 })
  }
}

// ── PATCH /api/sessions/[sessionId] ──────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<
  "sw" | "patient",
  Partial<Record<SessionStatus, SessionStatus[]>>
> = {
  sw:      { scheduled: ["active", "cancelled"], active: ["ended"] },
  patient: { scheduled: ["cancelled"] },
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { sessionId } = await params
    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
    }

    const isSW      = session.swUserId      === authResult.userId
    const isPatient = session.patientUserId === authResult.userId
    if (!isSW && !isPatient) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as { status?: string } | null
    const newStatus = body?.status as SessionStatus | undefined

    if (!newStatus) {
      return NextResponse.json({ ok: false, error: "status is required." }, { status: 400 })
    }

    const role     = isSW ? "sw" : "patient"
    const allowed  = ALLOWED_TRANSITIONS[role][session.status] ?? []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { ok: false, error: `Transition from '${session.status}' to '${newStatus}' is not allowed for your role.` },
        { status: 422 },
      )
    }

    const updated = await updateSessionStatus(
      sessionId,
      newStatus,
      newStatus === "ended" ? authResult.userId : undefined,
    )

    // Notify patient when SW starts the session
    if (newStatus === "active" && isSW) {
      notifySessionStarting(session.patientUserId, sessionId, session.swName).catch((err) =>
        logServerError("notifySessionStarting failed", err, { module: "api/sessions/[sessionId]", sessionId }),
      )
    }

    return NextResponse.json({ ok: true, session: updated })
  } catch (error) {
    logServerError("PATCH /api/sessions/[sessionId] failed", error, { module: "api/sessions/[sessionId]" })
    return NextResponse.json({ ok: false, error: "Failed to update session." }, { status: 500 })
  }
}

// ── DELETE /api/sessions/[sessionId] ─────────────────────────────────────────
// SW only — removes ended or cancelled sessions from their list.

export async function DELETE(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { sessionId } = await params
    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
    }

    // Only the SW who owns the session may delete it
    if (session.swUserId !== authResult.userId) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 })
    }

    // Only allow deleting sessions that are no longer active
    if (session.status === "active" || session.status === "scheduled") {
      return NextResponse.json(
        { ok: false, error: "Cannot delete an active or scheduled session. End it first." },
        { status: 422 },
      )
    }

    await deleteSession(sessionId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError("DELETE /api/sessions/[sessionId] failed", error, { module: "api/sessions/[sessionId]" })
    return NextResponse.json({ ok: false, error: "Failed to delete session." }, { status: 500 })
  }
}
