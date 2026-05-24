/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Shared helpers for reading and writing encrypted PHI columns on the
 * applicants table.  All PHI is stored exclusively in *_encrypted columns
 * (AES-256-GCM).  Plaintext legacy columns were dropped in the May 2026
 * PHI remediation migration.
 */

import "server-only"

import { encryptField, decryptField } from "@/lib/user-profile/encrypt"

// ── Write helpers ─────────────────────────────────────────────────────────────

/**
 * Encrypt a PHI field value for storage.
 * Returns null when the input is null, undefined, or an empty string so that
 * optional fields (address_line2, etc.) stored as null remain null in the DB.
 */
export function encryptApplicantField(plain: string | null | undefined): string | null {
  if (!plain) return null
  return encryptField(plain)
}

// ── Read helpers ──────────────────────────────────────────────────────────────

/**
 * Decrypt an encrypted PHI column value.  Returns null when the column is
 * null (field not yet provided by the applicant).
 */
export function decryptOrPlain(
  encrypted: string | null | undefined,
): string | null {
  if (!encrypted) return null
  try {
    return decryptField(encrypted)
  } catch {
    return null
  }
}

/**
 * Produce a display name from encrypted first/last name columns.
 * Returns null when both fields are empty.
 */
export function decryptDisplayName(
  firstEnc: string | null | undefined,
  lastEnc: string | null | undefined,
): string | null {
  const first = decryptOrPlain(firstEnc)
  const last = decryptOrPlain(lastEnc)
  const name = [first, last].filter(Boolean).join(" ").trim()
  return name || null
}

// ── Encrypted column names (for SELECT / GROUP BY) ────────────────────────────

/**
 * SQL fragment that SELECTs the encrypted PHI columns for a given table alias.
 * Legacy plaintext columns (first_name, last_name, etc.) were dropped after the
 * encryption backfill completed. NULL aliases preserve the column names so that
 * all call sites and decryptOrPlain() invocations remain unchanged — the plain
 * argument is simply always null now.
 *
 * Usage:
 *   SELECT ${APPLICANT_PHI_SELECT("a")} FROM applicants a …
 */
export function APPLICANT_PHI_SELECT(alias: string): string {
  return [
    `${alias}.first_name_encrypted`, `NULL::text AS first_name`,
    `${alias}.last_name_encrypted`,  `NULL::text AS last_name`,
    `${alias}.dob_encrypted`,        `NULL::text AS dob`,
    `${alias}.phone_encrypted`,      `NULL::text AS phone`,
    `${alias}.address_line1_encrypted`, `NULL::text AS address_line1`,
    `${alias}.address_line2_encrypted`, `NULL::text AS address_line2`,
    `${alias}.city_encrypted`,       `NULL::text AS city`,
    `${alias}.state_encrypted`,      `NULL::text AS state`,
    `${alias}.zip_encrypted`,        `NULL::text AS zip`,
  ].join(",\n       ")
}

export function APPLICANT_PHI_GROUP_BY(alias: string): string {
  return [
    `${alias}.first_name_encrypted`,
    `${alias}.last_name_encrypted`,
    `${alias}.dob_encrypted`,
    `${alias}.phone_encrypted`,
    `${alias}.address_line1_encrypted`,
    `${alias}.address_line2_encrypted`,
    `${alias}.city_encrypted`,
    `${alias}.state_encrypted`,
    `${alias}.zip_encrypted`,
  ].join(", ")
}

export function APPLICANT_NAME_SELECT(alias: string): string {
  return [
    `${alias}.first_name_encrypted`, `NULL::text AS first_name`,
    `${alias}.last_name_encrypted`,  `NULL::text AS last_name`,
  ].join(", ")
}

export function APPLICANT_NAME_GROUP_BY(alias: string): string {
  return [
    `${alias}.first_name_encrypted`,
    `${alias}.last_name_encrypted`,
  ].join(", ")
}
