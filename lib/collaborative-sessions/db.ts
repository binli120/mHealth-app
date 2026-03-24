/**
 * Collaborative Session — DB helpers
 * @author Bin Lee
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import type {
  CreateMessageInput,
  CreateSessionInput,
  SessionMessage,
  SessionSummary,
} from "./types"

// ── Row types returned by queries ────────────────────────────────────────────

interface SessionQueryRow {
  id: string
  sw_user_id: string
  sw_name: string
  patient_user_id: string
  patient_name: string
  status: string
  scheduled_at: Date | null
  started_at: Date | null
  ended_at: Date | null
  invite_message: string | null
  created_at: Date
}

interface MessageQueryRow {
  id: string
  session_id: string
  sender_id: string
  sender_name: string
  type: string
  content: string | null
  storage_path: string | null
  duration_sec: number | null
  created_at: Date
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function rowToSummary(row: SessionQueryRow): SessionSummary {
  return {
    id: row.id,
    swUserId: row.sw_user_id,
    swName: row.sw_name,
    patientUserId: row.patient_user_id,
    patientName: row.patient_name,
    status: row.status as SessionSummary["status"],
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    startedAt: row.started_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null,
    inviteMessage: row.invite_message,
    createdAt: row.created_at.toISOString(),
  }
}

function rowToMessage(row: MessageQueryRow): SessionMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    type: row.type as SessionMessage["type"],
    content: row.content,
    storagePath: row.storage_path,
    signedUrl: null,
    durationSec: row.duration_sec,
    createdAt: row.created_at.toISOString(),
  }
}

// ── Name resolution helper ───────────────────────────────────────────────────

const NAME_JOIN = `
  LEFT JOIN applicants sw_a  ON sw_a.user_id  = cs.sw_user_id
  LEFT JOIN applicants pt_a  ON pt_a.user_id  = cs.patient_user_id
`

const NAME_SELECT = `
  COALESCE(NULLIF(TRIM(sw_a.first_name || ' ' || sw_a.last_name), ''),  'Social Worker') AS sw_name,
  COALESCE(NULLIF(TRIM(pt_a.first_name || ' ' || pt_a.last_name), ''),  'Patient')        AS patient_name
`

// ── Session CRUD ─────────────────────────────────────────────────────────────

export async function createSession(input: CreateSessionInput): Promise<SessionSummary> {
  const pool = getDbPool()
  const { rows } = await pool.query<SessionQueryRow>(
    `WITH ins AS (
       INSERT INTO collaborative_sessions
         (sw_user_id, patient_user_id, scheduled_at, invite_message)
       VALUES ($1, $2, $3, $4)
       RETURNING *
     )
     SELECT
       cs.*,
       ${NAME_SELECT}
     FROM ins AS cs
     ${NAME_JOIN}`,
    [input.swUserId, input.patientUserId, input.scheduledAt ?? null, input.inviteMessage ?? null],
  )
  return rowToSummary(rows[0])
}

export async function getSession(sessionId: string): Promise<SessionSummary | null> {
  const pool = getDbPool()
  const { rows } = await pool.query<SessionQueryRow>(
    `SELECT
       cs.*,
       ${NAME_SELECT}
     FROM collaborative_sessions cs
     ${NAME_JOIN}
     WHERE cs.id = $1
     LIMIT 1`,
    [sessionId],
  )
  return rows[0] ? rowToSummary(rows[0]) : null
}

export async function listSessionsForUser(
  userId: string,
  role: "sw" | "patient",
): Promise<SessionSummary[]> {
  const column = role === "sw" ? "cs.sw_user_id" : "cs.patient_user_id"
  const pool = getDbPool()
  const { rows } = await pool.query<SessionQueryRow>(
    `SELECT
       cs.*,
       ${NAME_SELECT}
     FROM collaborative_sessions cs
     ${NAME_JOIN}
     WHERE ${column} = $1
     ORDER BY cs.created_at DESC`,
    [userId],
  )
  return rows.map(rowToSummary)
}

export async function updateSessionStatus(
  sessionId: string,
  status: "scheduled" | "active" | "ended" | "cancelled",
  endedBy?: string,
): Promise<SessionSummary | null> {
  const pool = getDbPool()

  const extras =
    status === "active"
      ? ", started_at = now()"
      : status === "ended" || status === "cancelled"
        ? ", ended_at = now()"
        : ""

  const endedByParam = endedBy ?? null

  const { rows } = await pool.query<SessionQueryRow>(
    `WITH upd AS (
       UPDATE collaborative_sessions
       SET status = $2, ended_by = COALESCE($3::uuid, ended_by)${extras}
       WHERE id = $1
       RETURNING *
     )
     SELECT
       cs.*,
       ${NAME_SELECT}
     FROM upd AS cs
     ${NAME_JOIN}`,
    [sessionId, status, endedByParam],
  )
  return rows[0] ? rowToSummary(rows[0]) : null
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const pool = getDbPool()
  const { rowCount } = await pool.query(
    `DELETE FROM collaborative_sessions WHERE id = $1`,
    [sessionId],
  )
  return (rowCount ?? 0) > 0
}

// ── Message CRUD ─────────────────────────────────────────────────────────────

export async function createMessage(input: CreateMessageInput): Promise<SessionMessage> {
  const pool = getDbPool()
  const { rows } = await pool.query<MessageQueryRow>(
    `WITH ins AS (
       INSERT INTO session_messages
         (session_id, sender_id, type, content, storage_path, duration_sec)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *
     )
     SELECT
       ins.*,
       COALESCE(NULLIF(TRIM(a.first_name || ' ' || a.last_name), ''), 'User') AS sender_name
     FROM ins
     LEFT JOIN applicants a ON a.user_id = ins.sender_id`,
    [
      input.sessionId,
      input.senderId,
      input.type,
      input.content ?? null,
      input.storagePath ?? null,
      input.durationSec ?? null,
    ],
  )
  return rowToMessage(rows[0])
}

export async function listMessages(
  sessionId: string,
  limit = 50,
  beforeId?: string,
): Promise<SessionMessage[]> {
  const pool = getDbPool()

  const cursorClause = beforeId
    ? `AND sm.created_at < (SELECT created_at FROM session_messages WHERE id = $3)`
    : ""
  const params: (string | number)[] = beforeId
    ? [sessionId, limit, beforeId]
    : [sessionId, limit]

  const { rows } = await pool.query<MessageQueryRow>(
    `SELECT
       sm.*,
       COALESCE(NULLIF(TRIM(a.first_name || ' ' || a.last_name), ''), 'User') AS sender_name
     FROM session_messages sm
     LEFT JOIN applicants a ON a.user_id = sm.sender_id
     WHERE sm.session_id = $1
     ${cursorClause}
     ORDER BY sm.created_at ASC
     LIMIT $2`,
    params,
  )
  return rows.map(rowToMessage)
}
