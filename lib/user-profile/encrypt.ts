/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * ─── Key-rotation life cycle ──────────────────────────────────────────────────
 *
 *  Phase A — normal operation (single key):
 *    PROFILE_ENCRYPTION_KEY     set    (current key)
 *    PROFILE_ENCRYPTION_KEY_OLD unset
 *    All rows carry v2: prefix; encryptField writes v2:.
 *
 *  Phase B — migration window (dual-key, set when running rekey-phi-encryption):
 *    PROFILE_ENCRYPTION_KEY     set    (NEW key)
 *    PROFILE_ENCRYPTION_KEY_OLD set    (OLD key, still needed for v1:/legacy rows)
 *    decryptField dispatches by version prefix; encryptField writes v2:.
 *    Run scripts/rekey-phi-encryption.ts to convert all v1: rows → v2:.
 *
 *  Phase C — after migration completes (clean up):
 *    Remove PROFILE_ENCRYPTION_KEY_OLD from all environments.
 *    Delete the v1:/legacy branches below and revert encryptField prefix to v1:
 *    only if you intend another rotation cycle, otherwise leave v2:.
 *
 * See docs/PHI_KEY_ROTATION.md for the full step-by-step runbook.
 */

import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function parseRawKey(raw: string, envName: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex")
  const buf = Buffer.from(raw, "base64")
  if (buf.length !== 32)
    throw new Error(`${envName} must be 32 bytes (64 hex chars or 44 base64 chars)`)
  return buf
}

/** Returns the current (new) AES-256-GCM key — used for all new encryptions. */
function getCurrentKey(): Buffer {
  const raw = process.env.PROFILE_ENCRYPTION_KEY
  if (!raw) throw new Error("PROFILE_ENCRYPTION_KEY environment variable is not set")
  return parseRawKey(raw, "PROFILE_ENCRYPTION_KEY")
}

/**
 * Returns the key that was used to encrypt a given stored value, based on its
 * version prefix.
 *
 *   v2:  → PROFILE_ENCRYPTION_KEY        (current / new key)
 *   v1:  → PROFILE_ENCRYPTION_KEY_OLD    (set during rotation window only)
 *   none → PROFILE_ENCRYPTION_KEY_OLD    (legacy unversioned rows, same as v1)
 *
 * If PROFILE_ENCRYPTION_KEY_OLD is not set, v1/legacy rows fall back to
 * PROFILE_ENCRYPTION_KEY.  This keeps single-key deployments working before
 * any rotation is ever performed.
 */
function getKeyForVersion(version: "v1" | "v2" | "legacy"): Buffer {
  if (version === "v2") return getCurrentKey()

  // v1 / legacy: prefer the dedicated old-key variable during rotation window
  const oldRaw = process.env.PROFILE_ENCRYPTION_KEY_OLD
  if (oldRaw) return parseRawKey(oldRaw, "PROFILE_ENCRYPTION_KEY_OLD")

  // Fall back to current key (pre-rotation: only one key exists)
  return getCurrentKey()
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Stored format (colon-delimited, all segments hex-encoded):
 *   v2:iv:authTag:ciphertext
 *
 * The version prefix enables zero-downtime key rotation:
 *   • v2 → PROFILE_ENCRYPTION_KEY (current key)
 *   • v1 → PROFILE_ENCRYPTION_KEY_OLD (set during migration window only)
 */
export function encryptField(plain: string): string {
  const key = getCurrentKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v2", iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

/**
 * Decrypts a value previously encrypted with encryptField.
 *
 * Handles three stored formats:
 *   v2:iv:tag:cipher  — new key  (PROFILE_ENCRYPTION_KEY)
 *   v1:iv:tag:cipher  — old key  (PROFILE_ENCRYPTION_KEY_OLD, or current key
 *                                  if _OLD is not set)
 *   iv:tag:cipher     — legacy unversioned (same key selection as v1)
 */
export function decryptField(stored: string): string {
  const parts = stored.split(":")

  let version: "v1" | "v2" | "legacy"
  let ivHex: string, tagHex: string, cipherHex: string

  if (parts.length === 4 && parts[0] === "v2") {
    version = "v2"
    ;[, ivHex, tagHex, cipherHex] = parts as [string, string, string, string]
  } else if (parts.length === 4 && parts[0] === "v1") {
    version = "v1"
    ;[, ivHex, tagHex, cipherHex] = parts as [string, string, string, string]
  } else if (parts.length === 3) {
    // Legacy unversioned format written before versioning was added
    version = "legacy"
    ;[ivHex, tagHex, cipherHex] = parts as [string, string, string]
  } else {
    throw new Error("Invalid encrypted field format")
  }

  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error("Invalid encrypted field format")
  }

  const key = getKeyForVersion(version)
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const ciphertext = Buffer.from(cipherHex, "hex")
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}
