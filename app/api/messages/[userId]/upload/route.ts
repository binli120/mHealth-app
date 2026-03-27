/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * POST /api/messages/[userId]/upload
 * Upload a voice recording or image to a direct message thread.
 *
 * Multipart fields:
 *   file    — Blob (audio or image)
 *   type    — "voice" | "image"
 *   durationSec (optional, voice only)
 *
 * Storage paths:
 *   dm/voice/{senderId}/{messageId}.{ext}
 *   dm/images/{senderId}/{messageId}.{ext}
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  createMediaMessagePlaceholder,
  setMessageStoragePath,
} from "@/lib/db/sw-messaging"
import { notifyNewDirectMessage } from "@/lib/notifications/service"
import { logServerError } from "@/lib/server/logger"
import { getSignedDocumentUrl, uploadToStorage } from "@/lib/supabase/storage"
import { getDbPool } from "@/lib/db/server"

export const runtime = "nodejs"

const ALLOWED_AUDIO: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "mp4",
  "audio/wav": "wav",
}

const ALLOWED_IMAGE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
}

const ALLOWED_FILE: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024   // 10 MB
const MAX_IMAGE_BYTES = 20 * 1024 * 1024   // 20 MB
const MAX_FILE_BYTES  = 25 * 1024 * 1024   // 25 MB

type Params = { params: Promise<{ userId: string }> }

async function resolveThread(
  userA: string,
  userB: string,
): Promise<{ swUserId: string; patientUserId: string } | null> {
  const pool = getDbPool()
  const { rows } = await pool.query<{ is_active: boolean }>(
    `SELECT is_active FROM public.patient_social_worker_access
     WHERE social_worker_user_id = $1::uuid AND patient_user_id = $2::uuid AND is_active = true
     LIMIT 1`,
    [userA, userB],
  )
  if (rows[0]?.is_active) return { swUserId: userA, patientUserId: userB }

  const { rows: rows2 } = await pool.query<{ is_active: boolean }>(
    `SELECT is_active FROM public.patient_social_worker_access
     WHERE social_worker_user_id = $1::uuid AND patient_user_id = $2::uuid AND is_active = true
     LIMIT 1`,
    [userB, userA],
  )
  if (rows2[0]?.is_active) return { swUserId: userB, patientUserId: userA }

  return null
}

export async function POST(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { userId: otherUserId } = await params

    const thread = await resolveThread(authResult.userId, otherUserId)
    if (!thread) {
      return NextResponse.json(
        { ok: false, error: "No active SW-patient relationship found." },
        { status: 403 },
      )
    }

    const formData = await request.formData().catch(() => null)
    const fileBlob = formData?.get("file")
    const messageType = formData?.get("type")

    if (!(fileBlob instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "Multipart field 'file' (Blob) is required." },
        { status: 400 },
      )
    }
    if (messageType !== "voice" && messageType !== "image" && messageType !== "file") {
      return NextResponse.json(
        { ok: false, error: "Field 'type' must be 'voice', 'image', or 'file'." },
        { status: 400 },
      )
    }

    const mimeType = fileBlob.type || (messageType === "voice" ? "audio/webm" : "application/octet-stream")
    const allowedMap =
      messageType === "voice" ? ALLOWED_AUDIO :
      messageType === "image" ? ALLOWED_IMAGE :
      ALLOWED_FILE
    const ext = allowedMap[mimeType]
    if (!ext) {
      return NextResponse.json(
        { ok: false, error: `Unsupported file type '${mimeType}'.` },
        { status: 415 },
      )
    }

    const maxBytes =
      messageType === "voice" ? MAX_AUDIO_BYTES :
      messageType === "image" ? MAX_IMAGE_BYTES :
      MAX_FILE_BYTES
    const arrayBuffer = await fileBlob.arrayBuffer()
    if (arrayBuffer.byteLength > maxBytes) {
      return NextResponse.json(
        { ok: false, error: `File too large (max ${maxBytes / 1024 / 1024} MB).` },
        { status: 413 },
      )
    }

    const durationSec =
      messageType === "voice"
        ? (Number(formData?.get("durationSec") ?? 0) || null)
        : null

    // For file/image messages: preserve the original filename as message content
    const originalName = (fileBlob as File).name ?? null
    const displayName = messageType === "file" ? (originalName || `document.${ext}`) : null

    // Create DB row first to get the ID for the storage path
    const message = await createMediaMessagePlaceholder({
      swUserId: thread.swUserId,
      patientUserId: thread.patientUserId,
      senderId: authResult.userId,
      messageType,
      content: displayName ?? undefined,
      durationSec,
    })

    const folder =
      messageType === "voice" ? "dm/voice" :
      messageType === "image" ? "dm/images" :
      "dm/files"
    const storagePath = `${folder}/${authResult.userId}/${message.id}.${ext}`

    await uploadToStorage({
      fileBuffer: Buffer.from(arrayBuffer),
      mimeType,
      storagePath,
      upsert: false,
    })

    await setMessageStoragePath(message.id, storagePath)

    const signedUrl = await getSignedDocumentUrl({ storagePath })

    // Notify recipient (fire-and-forget)
    const isSenderSw = authResult.userId === thread.swUserId
    void (async () => {
      try {
        const pool = getDbPool()
        const { rows } = await pool.query<{ first_name: string | null; last_name: string | null }>(
          "SELECT first_name, last_name FROM public.applicants WHERE user_id = $1::uuid LIMIT 1",
          [authResult.userId],
        )
        const senderName =
          [rows[0]?.first_name, rows[0]?.last_name].filter(Boolean).join(" ") || null

        await notifyNewDirectMessage(
          otherUserId,
          senderName ?? (isSenderSw ? "Your social worker" : "Your patient"),
          message.id,
          isSenderSw,
        )
      } catch {
        // Non-critical
      }
    })()

    return NextResponse.json(
      { ok: true, message: { ...message, storagePath, signedUrl } },
      { status: 201 },
    )
  } catch (error) {
    logServerError("POST /api/messages/[userId]/upload failed", error, {
      module: "api/messages/[userId]/upload",
    })
    return NextResponse.json({ ok: false, error: "Failed to upload file." }, { status: 500 })
  }
}
