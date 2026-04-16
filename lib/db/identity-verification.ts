/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * DB layer — identity verification
 *
 * All queries use the shared pg Pool from lib/db/server.ts.
 * No PII from the license barcode is ever stored in plain text:
 *   - License number → SHA-256 hash only
 *   - Expiration date and issuing state are metadata-only
 */

import "server-only"

import { createHash } from "crypto"
import { getDbPool } from "@/lib/db/server"
import type { VerificationBreakdown } from "@/lib/identity/verify-license"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaveAttemptParams {
  applicantId: string
  userId: string
  status: "verified" | "needs_review" | "failed"
  score: number
  breakdown: VerificationBreakdown
  licenseNumber: string
  dlExpirationDate: string   // YYYY-MM-DD or empty
  dlIssuingState: string
  isExpired: boolean
  ipAddress?: string
  userAgent?: string
}

export interface ApplicantIdentityRow {
  identity_status: "unverified" | "pending" | "verified" | "failed"
  identity_score: number | null
  identity_verified_at: string | null
  dl_expiration_date: string | null
  dl_issuing_state: string | null
}

export interface ApplicantProfileRow {
  first_name: string
  last_name: string
  dob: string          // YYYY-MM-DD from DB
  address_line1: string
  city: string
  state: string
  zip: string
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch the minimal applicant fields needed for identity comparison.
 * Returns null if the applicant does not exist or does not belong to the user.
 */
export async function getApplicantProfileForVerification(
  userId: string,
): Promise<ApplicantProfileRow | null> {
  const pool = getDbPool()

  const result = await pool.query<ApplicantProfileRow>(
    `SELECT
       first_name,
       last_name,
       dob,
       address_line1,
       city,
       state,
       zip
     FROM applicants
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  )

  return result.rows[0] ?? null
}

/**
 * Look up current identity status for the authenticated user's applicant record.
 */
export async function getApplicantIdentityStatus(
  userId: string,
): Promise<ApplicantIdentityRow | null> {
  const pool = getDbPool()

  const result = await pool.query<ApplicantIdentityRow>(
    `SELECT
       identity_status,
       identity_score,
       identity_verified_at,
       dl_expiration_date,
       dl_issuing_state
     FROM applicants
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  )

  return result.rows[0] ?? null
}

/**
 * Persist a verification attempt and update the applicant's identity_status.
 * The license number is SHA-256 hashed before storage.
 */
export async function saveVerificationAttempt(params: SaveAttemptParams): Promise<void> {
  const pool = getDbPool()
  const client = await pool.connect()

  const dlNumberHash = params.licenseNumber
    ? createHash("sha256").update(params.licenseNumber.trim().toUpperCase()).digest("hex")
    : null

  const dlExpiration = params.dlExpirationDate || null
  const dlState = params.dlIssuingState || null

  try {
    await client.query("BEGIN")

    // 1. Log the attempt
    await client.query(
      `INSERT INTO identity_verification_attempts (
         applicant_id,
         user_id,
         status,
         score,
         breakdown,
         dl_number_hash,
         dl_expiration_date,
         dl_issuing_state,
         is_expired,
         ip_address,
         user_agent
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        params.applicantId,
        params.userId,
        params.status,
        params.score,
        JSON.stringify(params.breakdown),
        dlNumberHash,
        dlExpiration,
        dlState,
        params.isExpired,
        params.ipAddress ?? null,
        params.userAgent ?? null,
      ],
    )

    // 2. Update the applicant row
    const newIdentityStatus =
      params.status === "verified"
        ? "verified"
        : params.status === "needs_review"
          ? "pending"
          : "failed"

    await client.query(
      `UPDATE applicants
       SET
         identity_status       = $1,
         identity_score        = $2,
         identity_verified_at  = CASE WHEN $1 = 'verified' THEN NOW() ELSE identity_verified_at END,
         dl_number_hash        = COALESCE($3, dl_number_hash),
         dl_expiration_date    = COALESCE($4::date, dl_expiration_date),
         dl_issuing_state      = COALESCE($5, dl_issuing_state)
       WHERE id = $6`,
      [
        newIdentityStatus,
        params.score,
        dlNumberHash,
        dlExpiration,
        dlState,
        params.applicantId,
      ],
    )

    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

/**
 * Look up the applicant row id for a given user.
 * Returns null if not found.
 */
export async function getApplicantIdForUser(userId: string): Promise<string | null> {
  const pool = getDbPool()
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM applicants WHERE user_id = $1 LIMIT 1",
    [userId],
  )
  return result.rows[0]?.id ?? null
}
