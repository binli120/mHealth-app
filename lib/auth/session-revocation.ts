/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { createHash } from "crypto"
import { getDbPool } from "@/lib/db/server"

interface SessionRevocationCheck {
  token: string
  userId: string
  sessionId?: string | null
  issuedAt?: Date | null
}

interface RevokeUserSessionsOptions {
  reason: string
  revokedBy?: string | null
  expiresAt?: Date | null
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function isSessionRevoked({
  token,
  userId,
  sessionId,
  issuedAt,
}: SessionRevocationCheck): Promise<boolean> {
  const pool = getDbPool()
  const tokenHash = hashAccessToken(token)

  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM public.revoked_sessions
        WHERE (expires_at IS NULL OR expires_at > now())
          AND (
            token_hash = $1
            OR ($2::text IS NOT NULL AND session_id = $2::text)
            OR (
              user_id = $3::uuid
              AND session_id IS NULL
              AND token_hash IS NULL
              AND ($4::timestamptz IS NULL OR $4::timestamptz <= revoked_at)
            )
          )
      ) AS exists
    `,
    [tokenHash, sessionId ?? null, userId, issuedAt ?? null],
  )

  return result.rows[0]?.exists ?? false
}

export async function revokeUserSessions(
  userId: string,
  { reason, revokedBy = null, expiresAt = null }: RevokeUserSessionsOptions,
): Promise<void> {
  const pool = getDbPool()

  await pool.query(
    `
      INSERT INTO public.revoked_sessions (
        user_id,
        reason,
        revoked_by,
        expires_at
      )
      VALUES ($1::uuid, $2, $3::uuid, $4::timestamptz)
    `,
    [userId, reason, revokedBy, expiresAt],
  )
}
