/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * DB layer for SW engagement requests and direct messages.
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"

// ── Types ────────────────────────────────────────────────────────────────────

export type EngagementRequestStatus = "pending" | "accepted" | "rejected" | "cancelled"

export interface EngagementRequest {
  id: string
  patientUserId: string
  swUserId: string
  status: EngagementRequestStatus
  patientMessage: string | null
  rejectionNote: string | null
  createdAt: string
  updatedAt: string
  // Joined fields
  patientName: string | null
  patientEmail: string
  swName: string | null
  swEmail: string
  companyName: string
}

export type DirectMessageType = "text" | "voice" | "image" | "file"

export interface DirectMessage {
  id: string
  swUserId: string
  patientUserId: string
  senderId: string
  senderName: string | null
  messageType: DirectMessageType
  content: string | null
  storagePath: string | null
  signedUrl?: string | null
  durationSec: number | null
  transcription: string | null
  transcriptionLang: string | null
  readAt: string | null
  createdAt: string
}

export interface DirectMessageThread {
  swUserId: string
  swName: string | null
  swEmail: string
  companyName: string
  patientUserId: string
  patientName: string | null
  patientEmail: string
  lastMessageAt: string | null
  lastMessageContent: string | null
  unreadCount: number
}

// ── Engagement requests ──────────────────────────────────────────────────────

interface EngagementRequestRow {
  id: string
  patient_user_id: string
  sw_user_id: string
  status: EngagementRequestStatus
  patient_message: string | null
  rejection_note: string | null
  created_at: Date
  updated_at: Date
  patient_first: string | null
  patient_last: string | null
  patient_email: string
  sw_first: string | null
  sw_last: string | null
  sw_email: string
  company_name: string
}

function rowToRequest(row: EngagementRequestRow): EngagementRequest {
  return {
    id: row.id,
    patientUserId: row.patient_user_id,
    swUserId: row.sw_user_id,
    status: row.status,
    patientMessage: row.patient_message,
    rejectionNote: row.rejection_note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    patientName: [row.patient_first, row.patient_last].filter(Boolean).join(" ") || null,
    patientEmail: row.patient_email,
    swName: [row.sw_first, row.sw_last].filter(Boolean).join(" ") || null,
    swEmail: row.sw_email,
    companyName: row.company_name,
  }
}

// SW names come from social_worker_profiles.
// Patient names come from applicants (the correct patient table).
const REQUEST_JOIN = `
  FROM public.sw_engagement_requests er
  JOIN public.users pu ON pu.id = er.patient_user_id
  JOIN public.users su ON su.id = er.sw_user_id
  JOIN public.social_worker_profiles swp ON swp.user_id = er.sw_user_id
  JOIN public.companies c ON c.id = swp.company_id
  LEFT JOIN public.applicants pa ON pa.user_id = er.patient_user_id
`

const REQUEST_SELECT = `
  SELECT
    er.id,
    er.patient_user_id,
    er.sw_user_id,
    er.status,
    er.patient_message,
    er.rejection_note,
    er.created_at,
    er.updated_at,
    pa.first_name  AS patient_first,
    pa.last_name   AS patient_last,
    pu.email       AS patient_email,
    swp.first_name AS sw_first,
    swp.last_name  AS sw_last,
    su.email       AS sw_email,
    c.name         AS company_name
`

/** Patient sends an engagement request to a SW. */
export async function createEngagementRequest(
  patientUserId: string,
  swUserId: string,
  message?: string,
): Promise<EngagementRequest> {
  const pool = getDbPool()
  const { rows } = await pool.query<EngagementRequestRow>(
    `
    INSERT INTO public.sw_engagement_requests
      (patient_user_id, sw_user_id, patient_message)
    VALUES ($1::uuid, $2::uuid, $3)
    RETURNING
      id, patient_user_id, sw_user_id, status,
      patient_message, rejection_note, created_at, updated_at
    `,
    [patientUserId, swUserId, message ?? null],
  )

  const base = rows[0]
  // Fetch joined fields
  const { rows: joined } = await pool.query<EngagementRequestRow>(
    `${REQUEST_SELECT} ${REQUEST_JOIN} WHERE er.id = $1`,
    [base.id],
  )
  return rowToRequest(joined[0])
}

/** Patient cancels their own pending request. */
export async function cancelEngagementRequest(
  requestId: string,
  patientUserId: string,
): Promise<boolean> {
  const pool = getDbPool()
  const { rowCount } = await pool.query(
    `
    UPDATE public.sw_engagement_requests
    SET status = 'cancelled'
    WHERE id = $1 AND patient_user_id = $2::uuid AND status = 'pending'
    `,
    [requestId, patientUserId],
  )
  return (rowCount ?? 0) > 0
}

/** Patient views all their own requests (all statuses). */
export async function getPatientEngagementRequests(
  patientUserId: string,
): Promise<EngagementRequest[]> {
  const pool = getDbPool()
  const { rows } = await pool.query<EngagementRequestRow>(
    `${REQUEST_SELECT} ${REQUEST_JOIN}
     WHERE er.patient_user_id = $1::uuid
     ORDER BY er.created_at DESC`,
    [patientUserId],
  )
  return rows.map(rowToRequest)
}

/** SW views pending requests directed at them. */
export async function getSwPendingRequests(swUserId: string): Promise<EngagementRequest[]> {
  const pool = getDbPool()
  const { rows } = await pool.query<EngagementRequestRow>(
    `${REQUEST_SELECT} ${REQUEST_JOIN}
     WHERE er.sw_user_id = $1::uuid AND er.status = 'pending'
     ORDER BY er.created_at ASC`,
    [swUserId],
  )
  return rows.map(rowToRequest)
}

/** Count of pending requests for a SW — used for badge. */
export async function countSwPendingRequests(swUserId: string): Promise<number> {
  const pool = getDbPool()
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM public.sw_engagement_requests
     WHERE sw_user_id = $1::uuid AND status = 'pending'`,
    [swUserId],
  )
  return parseInt(rows[0]?.count ?? "0", 10)
}

/** Fetch a single request by id. */
export async function getEngagementRequest(requestId: string): Promise<EngagementRequest | null> {
  const pool = getDbPool()
  const { rows } = await pool.query<EngagementRequestRow>(
    `${REQUEST_SELECT} ${REQUEST_JOIN} WHERE er.id = $1`,
    [requestId],
  )
  return rows[0] ? rowToRequest(rows[0]) : null
}

/** SW accepts a request — also grants SW-patient access. */
export async function acceptEngagementRequest(
  requestId: string,
  swUserId: string,
): Promise<EngagementRequest | null> {
  const pool = getDbPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const { rows } = await client.query<{ id: string; patient_user_id: string }>(
      `UPDATE public.sw_engagement_requests
       SET status = 'accepted'
       WHERE id = $1 AND sw_user_id = $2::uuid AND status = 'pending'
       RETURNING id, patient_user_id`,
      [requestId, swUserId],
    )
    if (!rows[0]) {
      await client.query("ROLLBACK")
      return null
    }

    const { patient_user_id } = rows[0]

    // Grant access (upsert)
    await client.query(
      `INSERT INTO public.patient_social_worker_access
         (patient_user_id, social_worker_user_id, granted_at, is_active)
       VALUES ($1::uuid, $2::uuid, NOW(), true)
       ON CONFLICT (patient_user_id, social_worker_user_id)
       DO UPDATE SET is_active = true, revoked_at = NULL, granted_at = NOW()`,
      [patient_user_id, swUserId],
    )

    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  return getEngagementRequest(requestId)
}

/** SW rejects a request with an optional polite note. */
export async function rejectEngagementRequest(
  requestId: string,
  swUserId: string,
  rejectionNote?: string,
): Promise<EngagementRequest | null> {
  const pool = getDbPool()
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE public.sw_engagement_requests
     SET status = 'rejected', rejection_note = $3
     WHERE id = $1 AND sw_user_id = $2::uuid AND status = 'pending'
     RETURNING id`,
    [requestId, swUserId, rejectionNote ?? null],
  )
  if (!rows[0]) return null
  return getEngagementRequest(requestId)
}

/** Check if there is already a pending request for this pair. */
export async function hasPendingRequest(
  patientUserId: string,
  swUserId: string,
): Promise<boolean> {
  const pool = getDbPool()
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.sw_engagement_requests
       WHERE patient_user_id = $1::uuid AND sw_user_id = $2::uuid AND status = 'pending'
     ) AS exists`,
    [patientUserId, swUserId],
  )
  return rows[0]?.exists ?? false
}


// ── Direct messages ──────────────────────────────────────────────────────────

interface DirectMessageRow {
  id: string
  sw_user_id: string
  patient_user_id: string
  sender_id: string
  sender_first: string | null
  sender_last: string | null
  message_type: DirectMessageType
  content: string | null
  storage_path: string | null
  duration_sec: number | null
  transcription: string | null
  transcription_lang: string | null
  read_at: Date | null
  created_at: Date
}

function rowToMessage(row: DirectMessageRow): DirectMessage {
  return {
    id: row.id,
    swUserId: row.sw_user_id,
    patientUserId: row.patient_user_id,
    senderId: row.sender_id,
    senderName: [row.sender_first, row.sender_last].filter(Boolean).join(" ") || null,
    messageType: row.message_type,
    content: row.content,
    storagePath: row.storage_path,
    durationSec: row.duration_sec,
    transcription: row.transcription,
    transcriptionLang: row.transcription_lang,
    readAt: row.read_at ? row.read_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  }
}

/** Send a text direct message. */
export async function sendDirectMessage(input: {
  swUserId: string
  patientUserId: string
  senderId: string
  content: string
}): Promise<DirectMessage> {
  const pool = getDbPool()
  const { rows } = await pool.query<DirectMessageRow>(
    `INSERT INTO public.sw_direct_messages
       (sw_user_id, patient_user_id, sender_id, message_type, content)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'text', $4)
     RETURNING
       id, sw_user_id, patient_user_id, sender_id, message_type,
       content, storage_path, duration_sec, transcription, transcription_lang, read_at, created_at`,
    [input.swUserId, input.patientUserId, input.senderId, input.content],
  )
  return {
    ...rowToMessage(rows[0]),
    senderName: null, // resolved in list query
  }
}

/** Create a placeholder message row for a media upload (returns id for storage path). */
export async function createMediaMessagePlaceholder(input: {
  swUserId: string
  patientUserId: string
  senderId: string
  messageType: "voice" | "image" | "file"
  content?: string
  durationSec?: number | null
  transcription?: string | null
  transcriptionLang?: string | null
}): Promise<DirectMessage> {
  const pool = getDbPool()
  const { rows } = await pool.query<DirectMessageRow>(
    `INSERT INTO public.sw_direct_messages
       (sw_user_id, patient_user_id, sender_id, message_type, content, duration_sec, transcription, transcription_lang)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)
     RETURNING
       id, sw_user_id, patient_user_id, sender_id, message_type,
       content, storage_path, duration_sec, transcription, transcription_lang, read_at, created_at`,
    [
      input.swUserId,
      input.patientUserId,
      input.senderId,
      input.messageType,
      input.content ?? null,
      input.durationSec ?? null,
      input.transcription ?? null,
      input.transcriptionLang ?? null,
    ],
  )
  return rowToMessage(rows[0])
}

/** Backfill storage_path after upload completes. */
export async function setMessageStoragePath(
  messageId: string,
  storagePath: string,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    "UPDATE public.sw_direct_messages SET storage_path = $1 WHERE id = $2",
    [storagePath, messageId],
  )
}

/** Update transcription and language for an existing voice message. */
export async function updateMessageTranscription(
  messageId: string,
  transcription: string,
  transcriptionLang: string,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE public.sw_direct_messages
     SET transcription = $1, transcription_lang = $2
     WHERE id = $3`,
    [transcription, transcriptionLang, messageId],
  )
}

/** Fetch messages in a thread (cursor-based, newest first). */
export async function getDirectMessages(input: {
  swUserId: string
  patientUserId: string
  before?: string  // message id cursor
  limit?: number
}): Promise<DirectMessage[]> {
  const pool = getDbPool()
  const limit = Math.min(input.limit ?? 50, 100)

  // Sender may be a patient (applicants) or a social worker (social_worker_profiles).
  // COALESCE resolves the name from whichever table has a matching row.
  const { rows } = await pool.query<DirectMessageRow>(
    `SELECT
       dm.id, dm.sw_user_id, dm.patient_user_id, dm.sender_id,
       COALESCE(swp_s.first_name, ap_s.first_name) AS sender_first,
       COALESCE(swp_s.last_name,  ap_s.last_name)  AS sender_last,
       dm.message_type, dm.content, dm.storage_path,
       dm.duration_sec, dm.transcription, dm.transcription_lang, dm.read_at, dm.created_at
     FROM public.sw_direct_messages dm
     LEFT JOIN public.applicants ap_s              ON ap_s.user_id  = dm.sender_id
     LEFT JOIN public.social_worker_profiles swp_s ON swp_s.user_id = dm.sender_id
     WHERE dm.sw_user_id = $1::uuid
       AND dm.patient_user_id = $2::uuid
       ${input.before ? "AND dm.created_at < (SELECT created_at FROM public.sw_direct_messages WHERE id = $4)" : ""}
     ORDER BY dm.created_at DESC
     LIMIT $3`,
    input.before
      ? [input.swUserId, input.patientUserId, limit, input.before]
      : [input.swUserId, input.patientUserId, limit],
  )
  return rows.map(rowToMessage)
}

/** Mark all messages in a thread as read for the given reader. */
export async function markThreadRead(
  swUserId: string,
  patientUserId: string,
  readerUserId: string,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE public.sw_direct_messages
     SET read_at = NOW()
     WHERE sw_user_id = $1::uuid
       AND patient_user_id = $2::uuid
       AND sender_id != $3::uuid
       AND read_at IS NULL`,
    [swUserId, patientUserId, readerUserId],
  )
}

/** List all threads for a SW — one entry per patient, with latest message preview. */
export async function getSwMessageThreads(swUserId: string): Promise<DirectMessageThread[]> {
  const pool = getDbPool()
  const { rows } = await pool.query<{
    sw_user_id: string
    sw_first: string | null
    sw_last: string | null
    sw_email: string
    company_name: string
    patient_user_id: string
    patient_first: string | null
    patient_last: string | null
    patient_email: string
    last_message_at: Date | null
    last_message_content: string | null
    unread_count: string
  }>(
    `SELECT
       dm.sw_user_id,
       swp.first_name    AS sw_first,
       swp.last_name     AS sw_last,
       su.email          AS sw_email,
       c.name            AS company_name,
       dm.patient_user_id,
       pa.first_name     AS patient_first,
       pa.last_name      AS patient_last,
       pu.email          AS patient_email,
       MAX(dm.created_at) AS last_message_at,
       (
         SELECT content FROM public.sw_direct_messages sub
         WHERE sub.sw_user_id = dm.sw_user_id
           AND sub.patient_user_id = dm.patient_user_id
         ORDER BY created_at DESC LIMIT 1
       ) AS last_message_content,
       COUNT(dm.id) FILTER (WHERE dm.sender_id != $1::uuid AND dm.read_at IS NULL)::text AS unread_count
     FROM public.sw_direct_messages dm
     JOIN public.users su ON su.id = dm.sw_user_id
     JOIN public.users pu ON pu.id = dm.patient_user_id
     JOIN public.social_worker_profiles swp ON swp.user_id = dm.sw_user_id
     JOIN public.companies c ON c.id = swp.company_id
     LEFT JOIN public.applicants pa ON pa.user_id = dm.patient_user_id
     WHERE dm.sw_user_id = $1::uuid
     GROUP BY dm.sw_user_id, dm.patient_user_id,
              swp.first_name, swp.last_name, su.email, c.name,
              pa.first_name, pa.last_name, pu.email
     ORDER BY last_message_at DESC NULLS LAST`,
    [swUserId],
  )
  return rows.map((r) => ({
    swUserId: r.sw_user_id,
    swName: [r.sw_first, r.sw_last].filter(Boolean).join(" ") || null,
    swEmail: r.sw_email,
    companyName: r.company_name,
    patientUserId: r.patient_user_id,
    patientName: [r.patient_first, r.patient_last].filter(Boolean).join(" ") || null,
    patientEmail: r.patient_email,
    lastMessageAt: r.last_message_at ? r.last_message_at.toISOString() : null,
    lastMessageContent: r.last_message_content,
    unreadCount: parseInt(r.unread_count, 10),
  }))
}

/** List all threads for a patient — one entry per SW they're connected to. */
export async function getPatientMessageThreads(
  patientUserId: string,
): Promise<DirectMessageThread[]> {
  const pool = getDbPool()
  const { rows } = await pool.query<{
    sw_user_id: string
    sw_first: string | null
    sw_last: string | null
    sw_email: string
    company_name: string
    patient_user_id: string
    patient_first: string | null
    patient_last: string | null
    patient_email: string
    last_message_at: Date | null
    last_message_content: string | null
    unread_count: string
  }>(
    `SELECT
       psa.social_worker_user_id AS sw_user_id,
       swp.first_name    AS sw_first,
       swp.last_name     AS sw_last,
       su.email          AS sw_email,
       c.name            AS company_name,
       psa.patient_user_id,
       pa.first_name     AS patient_first,
       pa.last_name      AS patient_last,
       pu.email          AS patient_email,
       MAX(dm.created_at) AS last_message_at,
       (
         SELECT content FROM public.sw_direct_messages sub
         WHERE sub.sw_user_id = psa.social_worker_user_id
           AND sub.patient_user_id = psa.patient_user_id
         ORDER BY created_at DESC LIMIT 1
       ) AS last_message_content,
       COUNT(dm.id) FILTER (WHERE dm.sender_id != $1::uuid AND dm.read_at IS NULL)::text AS unread_count
     FROM public.patient_social_worker_access psa
     JOIN public.users su ON su.id = psa.social_worker_user_id
     JOIN public.users pu ON pu.id = psa.patient_user_id
     JOIN public.social_worker_profiles swp ON swp.user_id = psa.social_worker_user_id
     JOIN public.companies c ON c.id = swp.company_id
     LEFT JOIN public.applicants pa ON pa.user_id = psa.patient_user_id
     LEFT JOIN public.sw_direct_messages dm
       ON dm.sw_user_id = psa.social_worker_user_id
       AND dm.patient_user_id = psa.patient_user_id
     WHERE psa.patient_user_id = $1::uuid AND psa.is_active = true
     GROUP BY psa.social_worker_user_id, psa.patient_user_id,
              swp.first_name, swp.last_name, su.email, c.name,
              pa.first_name, pa.last_name, pu.email
     ORDER BY last_message_at DESC NULLS LAST`,
    [patientUserId],
  )
  return rows.map((r) => ({
    swUserId: r.sw_user_id,
    swName: [r.sw_first, r.sw_last].filter(Boolean).join(" ") || null,
    swEmail: r.sw_email,
    companyName: r.company_name,
    patientUserId: r.patient_user_id,
    patientName: [r.patient_first, r.patient_last].filter(Boolean).join(" ") || null,
    patientEmail: r.patient_email,
    lastMessageAt: r.last_message_at ? r.last_message_at.toISOString() : null,
    lastMessageContent: r.last_message_content,
    unreadCount: parseInt(r.unread_count, 10),
  }))
}

/** Total unread DM count for a user (either role). */
export async function getUnreadDmCount(userId: string): Promise<number> {
  const pool = getDbPool()
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM public.sw_direct_messages
     WHERE (sw_user_id = $1::uuid OR patient_user_id = $1::uuid)
       AND sender_id != $1::uuid
       AND read_at IS NULL`,
    [userId],
  )
  return parseInt(rows[0]?.count ?? "0", 10)
}
