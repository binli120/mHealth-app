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

export const runtime = "nodejs"

// Allowed audio MIME types
const ALLOWED_MIME: Record<string, string> = {
  "audio/webm":  "webm",
  "audio/ogg":   "ogg",
  "audio/mpeg":  "mp3",
  "audio/mp4":   "mp4",
  "audio/wav":   "wav",
}

// Max 10 MB voice clip
const MAX_BYTES = 10 * 1024 * 1024

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

    const mimeType    = audioFile.type || "audio/webm"
    const ext         = ALLOWED_MIME[mimeType]
    if (!ext) {
      return NextResponse.json(
        { ok: false, error: `Unsupported audio type '${mimeType}'.` },
        { status: 415 },
      )
    }

    const durationSec = Number(formData?.get("durationSec") ?? 0) || null

    const arrayBuffer = await audioFile.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Audio file too large (max 10 MB)." }, { status: 413 })
    }

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
      mimeType,
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
