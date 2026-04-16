/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * PATCH /api/messages/[userId]/[messageId]/transcription
 * Update the transcription and language for an existing voice message.
 *
 * Body: { transcription: string; transcriptionLang: string }
 * Response: { ok: true }
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { updateMessageTranscription } from "@/lib/db/sw-messaging"
import { getDbPool } from "@/lib/db/server"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

type Params = { params: Promise<{ userId: string; messageId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { userId: otherUserId, messageId } = await params

    // Verify the caller is a participant in this thread
    const pool = getDbPool()
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM public.sw_direct_messages
       WHERE id = $1::uuid
         AND (sw_user_id = $2::uuid OR patient_user_id = $2::uuid)
       LIMIT 1`,
      [messageId, authResult.userId],
    )
    if (!rows[0]) {
      return NextResponse.json({ ok: false, error: "Message not found." }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const transcription = typeof body?.transcription === "string" ? body.transcription.trim() : ""
    const transcriptionLang = typeof body?.transcriptionLang === "string" ? body.transcriptionLang.trim() : "en-US"

    if (!transcription) {
      return NextResponse.json({ ok: false, error: "transcription is required." }, { status: 400 })
    }

    await updateMessageTranscription(messageId, transcription, transcriptionLang)

    // Suppress unused variable warning — otherUserId not needed for auth but part of URL
    void otherUserId

    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError("PATCH /api/messages/[userId]/[messageId]/transcription failed", error, {
      module: "api/messages/[userId]/[messageId]/transcription",
    })
    return NextResponse.json({ ok: false, error: "Failed to update transcription." }, { status: 500 })
  }
}
