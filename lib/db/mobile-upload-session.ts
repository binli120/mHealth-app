/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * DB layer — cross-device document upload sessions
 * Mirrors the pattern from mobile-verify-session.ts
 */

import "server-only"

import { randomBytes } from "node:crypto"
import { getDbPool } from "@/lib/db/server"

function generateToken(): string {
  return randomBytes(24).toString("base64url")
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MobileUploadSession {
  id: string
  token: string
  userId: string
  applicationId: string
  documentType: string | null
  requiredDocumentLabel: string | null
  status: "pending" | "completed" | "expired"
  documentId: string | null
  createdAt: string
  expiresAt: string
  completedAt: string | null
}

interface SessionRow {
  id: string
  token: string
  user_id: string
  application_id: string
  document_type: string | null
  required_document_label: string | null
  status: string
  document_id: string | null
  created_at: string
  expires_at: string
  completed_at: string | null
}

function mapRow(row: SessionRow): MobileUploadSession {
  return {
    id: row.id,
    token: row.token,
    userId: row.user_id,
    applicationId: row.application_id,
    documentType: row.document_type,
    requiredDocumentLabel: row.required_document_label,
    status: row.status as MobileUploadSession["status"],
    documentId: row.document_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function createMobileUploadSession(
  userId: string,
  applicationId: string,
  documentType?: string,
  requiredDocumentLabel?: string,
): Promise<MobileUploadSession> {
  const pool = getDbPool()

  // Expire any existing pending sessions for the same user + document type
  await pool.query(
    `UPDATE public.mobile_upload_sessions
     SET status = 'expired'
     WHERE user_id = $1
       AND application_id = $2
       AND document_type IS NOT DISTINCT FROM $3
       AND status = 'pending'`,
    [userId, applicationId, documentType ?? null],
  )

  const result = await pool.query<SessionRow>(
    `INSERT INTO public.mobile_upload_sessions
       (user_id, application_id, document_type, required_document_label, token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, applicationId, documentType ?? null, requiredDocumentLabel ?? null, generateToken()],
  )

  const row = result.rows[0]
  if (!row) throw new Error("Failed to create mobile upload session")
  return mapRow(row)
}

/** Public — used by the mobile device (no user auth). */
export async function getUploadSessionByToken(token: string): Promise<MobileUploadSession | null> {
  const pool = getDbPool()

  const result = await pool.query<SessionRow>(
    "SELECT * FROM public.mobile_upload_sessions WHERE token = $1 LIMIT 1",
    [token],
  )

  const row = result.rows[0]
  if (!row) return null

  if (row.status === "pending" && new Date(row.expires_at) < new Date()) {
    await pool.query(
      "UPDATE public.mobile_upload_sessions SET status = 'expired' WHERE token = $1",
      [token],
    )
    return { ...mapRow(row), status: "expired" }
  }

  return mapRow(row)
}

/** Authenticated poll — desktop checks for completion. */
export async function getUploadSessionForUser(
  userId: string,
  token: string,
): Promise<MobileUploadSession | null> {
  const pool = getDbPool()

  const result = await pool.query<SessionRow>(
    "SELECT * FROM public.mobile_upload_sessions WHERE token = $1 AND user_id = $2 LIMIT 1",
    [token, userId],
  )

  const row = result.rows[0]
  if (!row) return null

  if (row.status === "pending" && new Date(row.expires_at) < new Date()) {
    await pool.query(
      "UPDATE public.mobile_upload_sessions SET status = 'expired' WHERE token = $1",
      [token],
    )
    return { ...mapRow(row), status: "expired" }
  }

  return mapRow(row)
}

/** Mark the session as completed once the mobile device has uploaded the file. */
export async function completeUploadSession(
  token: string,
  documentId: string,
): Promise<void> {
  const pool = getDbPool()

  await pool.query(
    `UPDATE public.mobile_upload_sessions
     SET status = 'completed', document_id = $2, completed_at = NOW()
     WHERE token = $1 AND status = 'pending'`,
    [token, documentId],
  )
}
