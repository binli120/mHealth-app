/**
 * POST /api/sessions/[sessionId]/voice
 * Receives a multipart audio blob, uploads it to Supabase Storage,
 * inserts a voice message row, and returns the new message.
 *
 * Storage path: sessions/{sessionId}/voice/{messageId}.{ext}
 * @author Bin Lee
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { createMessage, getSession } from "@/lib/collaborative-sessions/db"
import { logServerError } from "@/lib/server/logger"
import { getSignedDocumentUrl, uploadToStorage } from "@/lib/supabase/storage"
import { validateUpload } from "@/lib/uploads/validate"

export const runtime = "nodejs"

const EXT_MAP: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3",
  "audio/mp4": "mp4", "audio/wav": "wav",
}

type Params = { params: Promise<{ sessionId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { sessionId } = await params
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
    if (session.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "Voice messages can only be sent in an active session." },
        { status: 422 },
      )
    }

    const formData = await request.formData().catch(() => null)
    const audioFile = formData?.get("audio")
    if (!(audioFile instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "Multipart field 'audio' (Blob) is required." },
        { status: 400 },
      )
    }

    const validation = await validateUpload(audioFile, "session-voice")
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: validation.status })
    }

    const ext = EXT_MAP[validation.mimeType] ?? "webm"
    const durationSec = Number(formData?.get("durationSec") ?? 0) || null
    const arrayBuffer = await audioFile.arrayBuffer()

    // Create the DB row first to get a stable ID for the storage path
    const message = await createMessage({
      sessionId,
      senderId: authResult.userId,
      type: "voice",
      durationSec,
    })

    const storagePath = `sessions/${sessionId}/voice/${message.id}.${ext}`

    await uploadToStorage({
      fileBuffer: Buffer.from(arrayBuffer),
      mimeType: validation.mimeType,
      storagePath,
      upsert: false,
    })

    // Backfill storage_path on the message row
    const { getDbPool } = await import("@/lib/db/server")
    const pool = getDbPool()
    await pool.query(
      "UPDATE session_messages SET storage_path = $1 WHERE id = $2",
      [storagePath, message.id],
    )

    const signedUrl = await getSignedDocumentUrl({ storagePath })

    return NextResponse.json(
      { ok: true, message: { ...message, storagePath, signedUrl } },
      { status: 201 },
    )
  } catch (error) {
    logServerError("POST /api/sessions/[sessionId]/voice failed", error, { module: "api/sessions/voice" })
    return NextResponse.json({ ok: false, error: "Failed to upload voice message." }, { status: 500 })
  }
}
