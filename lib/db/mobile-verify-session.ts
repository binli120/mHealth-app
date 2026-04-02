/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * DB layer — cross-device mobile verification sessions
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MobileVerifySession {
  id: string
  token: string
  userId: string
  applicantId: string
  status: "pending" | "completed" | "failed" | "expired"
  verifyStatus: "verified" | "needs_review" | "failed" | null
  verifyScore: number | null
  verifyBreakdown: Record<string, boolean> | null
  createdAt: string
  expiresAt: string
  completedAt: string | null
}

// ─── Row type from DB ─────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  token: string
  user_id: string
  applicant_id: string
  status: string
  verify_status: string | null
  verify_score: number | null
  verify_breakdown: Record<string, boolean> | null
  created_at: string
  expires_at: string
  completed_at: string | null
}

function mapRow(row: SessionRow): MobileVerifySession {
  return {
    id: row.id,
    token: row.token,
    userId: row.user_id,
    applicantId: row.applicant_id,
    status: row.status as MobileVerifySession["status"],
    verifyStatus: row.verify_status as MobileVerifySession["verifyStatus"],
    verifyScore: row.verify_score,
    verifyBreakdown: row.verify_breakdown,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Create a new pending session.
 * Expires any existing pending sessions for the same user first.
 */
export async function createMobileVerifySession(
  userId: string,
  applicantId: string,
): Promise<MobileVerifySession> {
  const pool = getDbPool()

  // Expire stale pending sessions for this user
  await pool.query(
    `UPDATE mobile_verify_sessions
     SET status = 'expired'
     WHERE user_id = $1 AND status = 'pending'`,
    [userId],
  )

  const result = await pool.query<SessionRow>(
    `INSERT INTO mobile_verify_sessions (user_id, applicant_id)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, applicantId],
  )

  const row = result.rows[0]
  if (!row) throw new Error("Failed to create mobile verify session")

  return mapRow(row)
}

/**
 * Look up a session by token (used by the mobile device — no auth required).
 * Returns null if the token does not exist.
 */
export async function getSessionByToken(token: string): Promise<MobileVerifySession | null> {
  const pool = getDbPool()

  const result = await pool.query<SessionRow>(
    "SELECT * FROM mobile_verify_sessions WHERE token = $1 LIMIT 1",
    [token],
  )

  const row = result.rows[0]
  if (!row) return null

  // Auto-expire if past expiry time
  if (row.status === "pending" && new Date(row.expires_at) < new Date()) {
    await pool.query(
      "UPDATE mobile_verify_sessions SET status = 'expired' WHERE token = $1",
      [token],
    )
    return { ...mapRow(row), status: "expired" }
  }

  return mapRow(row)
}

/**
 * Poll a session by token + userId (desktop polling — authenticated).
 */
export async function getSessionForUser(
  userId: string,
  token: string,
): Promise<MobileVerifySession | null> {
  const pool = getDbPool()

  const result = await pool.query<SessionRow>(
    "SELECT * FROM mobile_verify_sessions WHERE token = $1 AND user_id = $2 LIMIT 1",
    [token, userId],
  )

  const row = result.rows[0]
  if (!row) return null

  if (row.status === "pending" && new Date(row.expires_at) < new Date()) {
    await pool.query(
      "UPDATE mobile_verify_sessions SET status = 'expired' WHERE token = $1",
      [token],
    )
    return { ...mapRow(row), status: "expired" }
  }

  return mapRow(row)
}

/**
 * Mark a session as completed with the verification result.
 * Called by the mobile device after scanning.
 */
export async function completeSession(
  token: string,
  verifyStatus: "verified" | "needs_review" | "failed",
  verifyScore: number,
  verifyBreakdown: Record<string, boolean>,
): Promise<void> {
  const pool = getDbPool()

  await pool.query(
    `UPDATE mobile_verify_sessions
     SET
       status           = 'completed',
       verify_status    = $2,
       verify_score     = $3,
       verify_breakdown = $4,
       completed_at     = NOW()
     WHERE token = $1 AND status = 'pending'`,
    [token, verifyStatus, verifyScore, JSON.stringify(verifyBreakdown)],
  )
}
