/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.PROFILE_ENCRYPTION_KEY
  if (!raw) {
    throw new Error("PROFILE_ENCRYPTION_KEY environment variable is not set")
  }
  // Accept a 64-char hex string (32 bytes) or a 44-char base64 string (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex")
  }
  const buf = Buffer.from(raw, "base64")
  if (buf.length !== 32) {
    throw new Error("PROFILE_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)")
  }
  return buf
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Stored format (colon-delimited, all segments hex-encoded):
 *   v1:iv:authTag:ciphertext
 *
 * The leading version token lets us detect the key generation used to
 * encrypt a value, enabling zero-downtime key rotation in the future:
 *   • v1 → current PROFILE_ENCRYPTION_KEY
 *   • v2 → (future) rotated key, re-encrypted during a migration job
 */
export function encryptField(plain: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

/**
 * Decrypts a value previously encrypted with encryptField.
 * Returns the plaintext string.
 *
 * Supports both the current versioned format (v1:iv:tag:cipher) and the
 * legacy unversioned format (iv:tag:cipher) so existing rows keep working
 * after a rolling deploy.
 */
export function decryptField(stored: string): string {
  const parts = stored.split(":")

  let ivHex: string, tagHex: string, cipherHex: string

  if (parts.length === 4 && parts[0] === "v1") {
    // Current format: v1:iv:tag:cipher
    ;[, ivHex, tagHex, cipherHex] = parts as [string, string, string, string]
  } else if (parts.length === 3) {
    // Legacy format written before versioning was added: iv:tag:cipher
    ;[ivHex, tagHex, cipherHex] = parts as [string, string, string]
  } else {
    throw new Error("Invalid encrypted field format")
  }

  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error("Invalid encrypted field format")
  }

  const key = getKey()
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const ciphertext = Buffer.from(cipherHex, "hex")
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}
