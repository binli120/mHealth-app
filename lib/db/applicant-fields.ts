/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Shared helpers for reading and writing encrypted PHI columns on the
 * applicants table.
 *
 * Every PHI field (name, DOB, phone, address) is stored twice during the
 * migration window:
 *
 *   • Legacy plaintext column (first_name, last_name, …)
 *     Existing rows until the backfill script is run.
 *
 *   • Encrypted column (first_name_encrypted, last_name_encrypted, …)
 *     All new writes go here immediately after this migration.
 *
 * The `decryptOrPlain` helper implements the dual-read priority:
 *   encrypted column → decrypted value      (new rows / post-backfill)
 *   plaintext column → returned as-is       (pre-backfill legacy rows)
 *   both null        → null
 *
 * After the backfill is verified, a follow-up cleanup migration will NULL
 * and DROP the legacy plaintext columns (see the TODO in the SQL migration).
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
 * Decrypt an encrypted PHI column value, falling back to the legacy plaintext
 * column when the encrypted value is absent (pre-backfill rows).
 *
 * Priority: encrypted → plaintext → null
 *
 * If decryption throws (e.g. corrupted ciphertext), the error propagates so
 * the caller can decide whether to return a 500 or substitute a default.
 * We intentionally do NOT silently swallow decryption errors — they indicate
 * data integrity issues that must be investigated.
 */
export function decryptOrPlain(
  encrypted: string | null | undefined,
  plain: string | null | undefined,
): string | null {
  if (encrypted) return decryptField(encrypted)
  return plain ?? null
}

/**
 * Produce a display name from encrypted (or plaintext fallback) first/last
 * name columns.  Returns null when both fields are empty.
 */
export function decryptDisplayName(
  firstEnc: string | null | undefined,
  firstPlain: string | null | undefined,
  lastEnc: string | null | undefined,
  lastPlain: string | null | undefined,
): string | null {
  const first = decryptOrPlain(firstEnc, firstPlain)
  const last = decryptOrPlain(lastEnc, lastPlain)
  const name = [first, last].filter(Boolean).join(" ").trim()
  return name || null
}

// ── Encrypted column names (for SELECT / GROUP BY) ────────────────────────────

/**
 * SQL fragment that SELECTs both the encrypted and legacy plaintext PHI
 * columns for a given table alias.
 *
 * Usage:
 *   SELECT ${APPLICANT_PHI_SELECT("a")} FROM applicants a …
 *
 * Produces: a.first_name_encrypted, a.first_name, a.last_name_encrypted, …
 */
export function APPLICANT_PHI_SELECT(alias: string): string {
  return [
    `${alias}.first_name_encrypted`, `${alias}.first_name`,
    `${alias}.last_name_encrypted`,  `${alias}.last_name`,
    `${alias}.dob_encrypted`,        `${alias}.dob::text AS dob`,
    `${alias}.phone_encrypted`,      `${alias}.phone`,
    `${alias}.address_line1_encrypted`, `${alias}.address_line1`,
    `${alias}.address_line2_encrypted`, `${alias}.address_line2`,
    `${alias}.city_encrypted`,       `${alias}.city`,
    `${alias}.state_encrypted`,      `${alias}.state`,
    `${alias}.zip_encrypted`,        `${alias}.zip`,
  ].join(",\n       ")
}

/**
 * SQL fragment for GROUP BY that includes both encrypted and legacy columns
 * so GROUP BY remains consistent with SELECT.
 *
 * Usage:
 *   GROUP BY … ${APPLICANT_PHI_GROUP_BY("a")}
 */
export function APPLICANT_PHI_GROUP_BY(alias: string): string {
  return [
    `${alias}.first_name_encrypted`, `${alias}.first_name`,
    `${alias}.last_name_encrypted`,  `${alias}.last_name`,
    `${alias}.dob_encrypted`,        `${alias}.dob`,
    `${alias}.phone_encrypted`,      `${alias}.phone`,
    `${alias}.address_line1_encrypted`, `${alias}.address_line1`,
    `${alias}.address_line2_encrypted`, `${alias}.address_line2`,
    `${alias}.city_encrypted`,       `${alias}.city`,
    `${alias}.state_encrypted`,      `${alias}.state`,
    `${alias}.zip_encrypted`,        `${alias}.zip`,
  ].join(", ")
}

/**
 * SQL fragment for SELECTing only the name columns for a given alias —
 * used by queries that only need a display name (messaging, notifications).
 */
export function APPLICANT_NAME_SELECT(alias: string): string {
  return [
    `${alias}.first_name_encrypted`, `${alias}.first_name`,
    `${alias}.last_name_encrypted`,  `${alias}.last_name`,
  ].join(", ")
}

/**
 * SQL fragment for GROUP BY of only the name columns.
 */
export function APPLICANT_NAME_GROUP_BY(alias: string): string {
  return [
    `${alias}.first_name_encrypted`, `${alias}.first_name`,
    `${alias}.last_name_encrypted`,  `${alias}.last_name`,
  ].join(", ")
}
