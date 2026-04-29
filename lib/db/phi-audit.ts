/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * PHI (Protected Health Information) access audit log.
 *
 * HIPAA §164.312(b) requires audit controls that record and examine activity
 * in systems containing PHI.  Every read or write of an encrypted PHI field
 * (SSN, bank account numbers) must be recorded here.
 *
 * Design decisions:
 *   - Writes are fire-and-forget so a broken audit log never blocks clinical
 *     workflows (PDF generation, benefit orchestration, etc.).
 *   - Failures are forwarded to logServerError so ops can detect a systemic
 *     outage via the structured log stream.
 *   - The admin query function is intentionally separate from the write path
 *     and can only be called from server-side admin routes.
 */

import "server-only"

import { getDbPool } from "./server"
import { logServerError } from "@/lib/server/logger"

// ── Types ─────────────────────────────────────────────────────────────────────

/** Context supplied by the API layer for richer audit records. */
export interface PhiAuditContext {
  /** Originating client IP address (x-forwarded-for or x-real-ip). */
  ipAddress?: string
  /** Human-readable reason for the access, e.g. "pdf-generation", "user-submitted". */
  purpose?: string
}

/** A single row from audit_logs, typed for the admin viewer. */
export interface PhiAuditEntry {
  id: string
  userId: string
  action: string
  ipAddress: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface GetPhiAuditLogsOptions {
  /** Filter to a specific user, or omit to return all PHI events. */
  userId?: string
  /** Number of records to return (default: 50, max: 200). */
  limit?: number
  /** Offset for pagination (default: 0). */
  offset?: number
}

export interface PhiAuditPage {
  entries: PhiAuditEntry[]
  total: number
}

// ── Write path ────────────────────────────────────────────────────────────────

/**
 * Record a PHI access event in audit_logs — fire-and-forget.
 *
 * The call never throws or awaits so it cannot block a clinical workflow.
 * Any write failure is forwarded to logServerError for ops visibility.
 *
 * @param userId   The authenticated user whose PHI was accessed
 * @param action   Dot-namespaced event name, e.g. "phi.ssn.decrypted"
 * @param context  Optional request-level context (IP address, purpose)
 * @param meta     Additional structured metadata to persist in new_data
 */
export function logPhiAccess(
  userId: string,
  action: string,
  context: PhiAuditContext = {},
  meta: Record<string, unknown> = {},
): void {
  const pool = getDbPool()
  const { ipAddress, purpose } = context
  const newData = JSON.stringify({ purpose, ...meta })

  pool
    .query(
      `INSERT INTO audit_logs (user_id, action, ip_address, new_data)
       VALUES ($1, $2, $3, $4)`,
      [userId, action, ipAddress ?? null, newData],
    )
    .catch((err) =>
      logServerError("phi.audit.write_failed", err, { userId, action }),
    )
}

// ── Read path (admin only) ────────────────────────────────────────────────────

/**
 * Retrieve paginated PHI audit log entries from audit_logs.
 *
 * Filters to rows whose action starts with "phi." so unrelated audit events
 * (e.g. login events) are excluded from the PHI audit report.
 *
 * @param options  Pagination + optional user filter
 * @returns        Page of entries with a total count for pagination UI
 */
export async function getPhiAuditLogs(
  options: GetPhiAuditLogsOptions = {},
): Promise<PhiAuditPage> {
  const { userId, limit = 50, offset = 0 } = options
  const safeLimit = Math.min(limit, 200)

  const pool = getDbPool()

  // Build WHERE clause dynamically
  const conditions = ["action LIKE 'phi.%'"]
  const values: unknown[] = []
  let paramIndex = 1

  if (userId) {
    conditions.push(`user_id = $${paramIndex}`)
    values.push(userId)
    paramIndex++
  }

  const where = conditions.join(" AND ")

  const [rowsResult, countResult] = await Promise.all([
    pool.query<{
      id: string
      user_id: string
      action: string
      ip_address: string | null
      new_data: string | null
      created_at: string
    }>(
      `SELECT id, user_id, action, ip_address, new_data, created_at
       FROM audit_logs
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, safeLimit, offset],
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_logs WHERE ${where}`,
      values,
    ),
  ])

  const entries: PhiAuditEntry[] = rowsResult.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    action: row.action,
    ipAddress: row.ip_address,
    metadata: (() => {
      try {
        return row.new_data ? (JSON.parse(row.new_data) as Record<string, unknown>) : {}
      } catch {
        return {}
      }
    })(),
    createdAt: row.created_at,
  }))

  return {
    entries,
    total: parseInt(countResult.rows[0]?.count ?? "0", 10),
  }
}
