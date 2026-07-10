/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * DB layer — universal desktop→mobile handoff sessions
 */
import "server-only"
import { randomBytes } from "node:crypto"
import { getDbPool } from "@/lib/db/server"
import { encryptField, decryptField } from "@/lib/user-profile/encrypt"

function generateToken(): string {
  return randomBytes(24).toString("base64url")
}

export type HandoffContextType = "intake_chat" | "mh_chat" | "id_verify" | "voice_message" | "doc_upload"
export type HandoffStatus = "pending" | "active" | "completed" | "expired"

export interface MobileHandoffSession {
  id: string
  token: string
  userId: string
  contextType: HandoffContextType
  contextPayload: Record<string, unknown>
  /** Decrypted refresh token — only populated by claimHandoffSession */
  decryptedRefreshToken: string
  status: HandoffStatus
  createdAt: string
  expiresAt: string
  completedAt: string | null
  progressSummary: Record<string, unknown> | null
}

interface SessionRow {
  id: string
  token: string
  user_id: string
  context_type: string
  context_payload: Record<string, unknown>
  encrypted_refresh_token: string
  status: string
  created_at: string
  expires_at: string
  completed_at: string | null
  progress_summary: Record<string, unknown> | null
}

function mapRow(row: SessionRow, decryptedRefreshToken = ""): MobileHandoffSession {
  return {
    id: row.id,
    token: row.token,
    userId: row.user_id,
    contextType: row.context_type as HandoffContextType,
    contextPayload: row.context_payload,
    decryptedRefreshToken,
    status: row.status as HandoffStatus,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    progressSummary: row.progress_summary,
  }
}

export async function createHandoffSession(
  userId: string,
  contextType: HandoffContextType,
  contextPayload: Record<string, unknown>,
  refreshToken: string,
): Promise<MobileHandoffSession> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE mobile_handoff_sessions SET status = 'expired' WHERE user_id = $1 AND status = 'pending'`,
    [userId],
  )
  const token = generateToken()
  const encrypted = encryptField(refreshToken)
  const result = await pool.query<SessionRow>(
    `INSERT INTO mobile_handoff_sessions (token, user_id, context_type, context_payload, encrypted_refresh_token)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [token, userId, contextType, JSON.stringify(contextPayload), encrypted],
  )
  const row = result.rows[0]
  if (!row) throw new Error("Failed to create handoff session")
  return mapRow(row, refreshToken)
}

export async function getHandoffSessionForUser(
  userId: string,
  token: string,
): Promise<MobileHandoffSession | null> {
  const pool = getDbPool()
  const result = await pool.query<SessionRow>(
    `SELECT * FROM mobile_handoff_sessions WHERE token = $1 AND user_id = $2 LIMIT 1`,
    [token, userId],
  )
  const row = result.rows[0]
  if (!row) return null
  if (row.status === "pending" && new Date(row.expires_at) < new Date()) {
    await pool.query(`UPDATE mobile_handoff_sessions SET status = 'expired' WHERE token = $1`, [token])
    return { ...mapRow(row), status: "expired" }
  }
  return mapRow(row)
}

/** Atomically claim a pending token → active. Returns null if already claimed/expired. */
export async function claimHandoffSession(token: string): Promise<MobileHandoffSession | null> {
  const pool = getDbPool()
  const result = await pool.query<SessionRow>(
    `UPDATE mobile_handoff_sessions
     SET status = 'active'
     WHERE token = $1 AND status = 'pending' AND expires_at > now()
     RETURNING *`,
    [token],
  )
  const row = result.rows[0]
  if (!row) return null
  let decryptedRefreshToken: string
  try {
    decryptedRefreshToken = decryptField(row.encrypted_refresh_token)
  } catch (error) {
    throw new Error("Failed to decrypt handoff session credentials")
  }
  return mapRow(row, decryptedRefreshToken)
}

export async function completeHandoffSession(
  token: string,
  userId: string,
  progressSummary: Record<string, unknown>,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE mobile_handoff_sessions
     SET status = 'completed', completed_at = now(), progress_summary = $3
     WHERE token = $1 AND user_id = $2 AND status = 'active'`,
    [token, userId, JSON.stringify(progressSummary)],
  )
}

export async function cancelHandoffSession(token: string, userId: string): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE mobile_handoff_sessions SET status = 'expired' WHERE token = $1 AND user_id = $2`,
    [token, userId],
  )
}
