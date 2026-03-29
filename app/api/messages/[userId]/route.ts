/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * Direct messages between the authenticated user and another user (identified by [userId]).
 *
 * GET  /api/messages/[userId]           — fetch message history (newest first)
 * POST /api/messages/[userId]           — send a text message
 *
 * The thread is keyed by (sw_user_id, patient_user_id).
 * The route resolves which role each participant has from the access table.
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getPatientSocialWorkers } from "@/lib/db/social-worker"
import {
  getDirectMessages,
  markThreadRead,
  sendDirectMessage,
} from "@/lib/db/sw-messaging"
import { notifyNewDirectMessage } from "@/lib/notifications/service"
import { logServerError } from "@/lib/server/logger"
import { getSignedDocumentUrl } from "@/lib/supabase/storage"
import { getDbPool } from "@/lib/db/server"

export const runtime = "nodejs"

type Params = { params: Promise<{ userId: string }> }

/** Resolve (swUserId, patientUserId) from the two participant IDs. */
async function resolveThreadParticipants(
  userA: string,
  userB: string,
): Promise<{ swUserId: string; patientUserId: string } | null> {
  const pool = getDbPool()
  // Check if userA is a SW with access to userB (patient)
  const { rows } = await pool.query<{ is_active: boolean }>(
    `SELECT is_active FROM public.patient_social_worker_access
     WHERE social_worker_user_id = $1::uuid AND patient_user_id = $2::uuid AND is_active = true
     LIMIT 1`,
    [userA, userB],
  )
  if (rows[0]?.is_active) return { swUserId: userA, patientUserId: userB }

  // Check reverse: userB is SW, userA is patient
  const { rows: rows2 } = await pool.query<{ is_active: boolean }>(
    `SELECT is_active FROM public.patient_social_worker_access
     WHERE social_worker_user_id = $1::uuid AND patient_user_id = $2::uuid AND is_active = true
     LIMIT 1`,
    [userB, userA],
  )
  if (rows2[0]?.is_active) return { swUserId: userB, patientUserId: userA }

  return null
}

export async function GET(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { userId: otherUserId } = await params
    const { searchParams } = new URL(request.url)
    const before = searchParams.get("before") ?? undefined
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100)

    const thread = await resolveThreadParticipants(authResult.userId, otherUserId)
    if (!thread) {
      return NextResponse.json(
        { ok: false, error: "No active SW-patient relationship found." },
        { status: 403 },
      )
    }

    const messages = await getDirectMessages({
      swUserId: thread.swUserId,
      patientUserId: thread.patientUserId,
      before,
      limit,
    })

    // Generate signed URLs for media messages (image, voice, file)
    const messagesWithUrls = await Promise.all(
      messages.map(async (msg) => {
        if (!msg.storagePath) return msg
        try {
          const signedUrl = await getSignedDocumentUrl({ storagePath: msg.storagePath })
          return { ...msg, signedUrl }
        } catch {
          return msg
        }
      }),
    )

    // Mark incoming messages as read
    void markThreadRead(thread.swUserId, thread.patientUserId, authResult.userId)

    return NextResponse.json({ ok: true, messages: messagesWithUrls })
  } catch (error) {
    logServerError("GET /api/messages/[userId] failed", error, { module: "api/messages/[userId]" })
    return NextResponse.json({ ok: false, error: "Failed to load messages." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { userId: otherUserId } = await params

    const thread = await resolveThreadParticipants(authResult.userId, otherUserId)
    if (!thread) {
      return NextResponse.json(
        { ok: false, error: "No active SW-patient relationship found." },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => null)
    const content = typeof body?.content === "string" ? body.content.trim() : ""
    if (!content) {
      return NextResponse.json({ ok: false, error: "content is required." }, { status: 400 })
    }

    const message = await sendDirectMessage({
      swUserId: thread.swUserId,
      patientUserId: thread.patientUserId,
      senderId: authResult.userId,
      content,
    })

    // Notify the recipient (fire-and-forget)
    const isSenderSw = authResult.userId === thread.swUserId
    void (async () => {
      try {
        // Resolve sender name — check social_worker_profiles first (for SW senders),
        // then fall back to applicants (for patient senders).
        const pool = getDbPool()
        const { rows } = await pool.query<{ first_name: string | null; last_name: string | null }>(
          `SELECT first_name, last_name FROM public.social_worker_profiles WHERE user_id = $1::uuid
           UNION ALL
           SELECT first_name, last_name FROM public.applicants WHERE user_id = $1::uuid
           LIMIT 1`,
          [authResult.userId],
        )
        const senderName =
          [rows[0]?.first_name, rows[0]?.last_name].filter(Boolean).join(" ") || null

        await notifyNewDirectMessage(
          otherUserId,
          senderName ?? (isSenderSw ? "Your social worker" : "Your patient"),
          message.id,
          isSenderSw,
          authResult.userId,
        )
      } catch {
        // Non-critical
      }
    })()

    return NextResponse.json({ ok: true, message }, { status: 201 })
  } catch (error) {
    logServerError("POST /api/messages/[userId] failed", error, { module: "api/messages/[userId]" })
    return NextResponse.json({ ok: false, error: "Failed to send message." }, { status: 500 })
  }
}
