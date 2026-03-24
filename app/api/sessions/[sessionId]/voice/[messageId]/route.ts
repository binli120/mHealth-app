/**
 * GET /api/sessions/[sessionId]/voice/[messageId]
 * Returns a fresh 1-hour signed URL for a voice message.
 * @author Bin Lee
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getSession } from "@/lib/collaborative-sessions/db"
import { logServerError } from "@/lib/server/logger"
import { getDbPool } from "@/lib/db/server"
import { getSignedDocumentUrl } from "@/lib/supabase/storage"

export const runtime = "nodejs"

type Params = { params: Promise<{ sessionId: string; messageId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { sessionId, messageId } = await params

    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
    }

    const isParticipant =
      session.swUserId === authResult.userId ||
      session.patientUserId === authResult.userId
    if (!isParticipant) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 })
    }

    // Fetch storage path for this message
    const pool = getDbPool()
    const { rows } = await pool.query<{ storage_path: string | null }>(
      "SELECT storage_path FROM session_messages WHERE id = $1 AND session_id = $2 AND type = 'voice' LIMIT 1",
      [messageId, sessionId],
    )
    const storagePath = rows[0]?.storage_path
    if (!storagePath) {
      return NextResponse.json(
        { ok: false, error: "Voice message not found." },
        { status: 404 },
      )
    }

    const signedUrl = await getSignedDocumentUrl({ storagePath })
    return NextResponse.json({ ok: true, signedUrl })
  } catch (error) {
    logServerError("GET /api/sessions/[sessionId]/voice/[messageId] failed", error, {
      module: "api/sessions/voice/[messageId]",
    })
    return NextResponse.json({ ok: false, error: "Failed to generate signed URL." }, { status: 500 })
  }
}
