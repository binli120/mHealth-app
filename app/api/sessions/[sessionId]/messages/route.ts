/**
 * GET  /api/sessions/[sessionId]/messages  — paginated message history
 * POST /api/sessions/[sessionId]/messages  — send a text message
 * @author Bin Lee
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { createMessage, getSession, listMessages } from "@/lib/collaborative-sessions/db"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

type Params = { params: Promise<{ sessionId: string }> }

// ── participant guard ─────────────────────────────────────────────────────────

async function requireParticipant(request: Request, sessionId: string) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return { ok: false as const, response: authResult.response }

  const session = await getSession(sessionId)
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 }),
    }
  }

  const isParticipant =
    session.swUserId === authResult.userId ||
    session.patientUserId === authResult.userId

  if (!isParticipant) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 }),
    }
  }

  return { ok: true as const, userId: authResult.userId, session }
}

// ── GET /api/sessions/[sessionId]/messages ────────────────────────────────────

export async function GET(request: Request, { params }: Params) {
  try {
    const { sessionId } = await params
    const guard = await requireParticipant(request, sessionId)
    if (!guard.ok) return guard.response

    const { searchParams } = new URL(request.url)
    const limit    = Math.min(Number(searchParams.get("limit") ?? 50), 100)
    const beforeId = searchParams.get("beforeId") ?? undefined

    const messages = await listMessages(sessionId, limit, beforeId)
    return NextResponse.json({ ok: true, messages })
  } catch (error) {
    logServerError("GET /api/sessions/[sessionId]/messages failed", error, { module: "api/sessions/messages" })
    return NextResponse.json({ ok: false, error: "Failed to fetch messages." }, { status: 500 })
  }
}

// ── POST /api/sessions/[sessionId]/messages ───────────────────────────────────

export async function POST(request: Request, { params }: Params) {
  try {
    const { sessionId } = await params
    const guard = await requireParticipant(request, sessionId)
    if (!guard.ok) return guard.response

    if (guard.session.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "Messages can only be sent in an active session." },
        { status: 422 },
      )
    }

    const body = (await request.json().catch(() => null)) as { content?: string } | null
    if (!body?.content?.trim()) {
      return NextResponse.json({ ok: false, error: "content is required." }, { status: 400 })
    }

    const message = await createMessage({
      sessionId,
      senderId: guard.userId,
      type: "text",
      content: body.content.trim(),
    })

    return NextResponse.json({ ok: true, message }, { status: 201 })
  } catch (error) {
    logServerError("POST /api/sessions/[sessionId]/messages failed", error, { module: "api/sessions/messages" })
    return NextResponse.json({ ok: false, error: "Failed to send message." }, { status: 500 })
  }
}
