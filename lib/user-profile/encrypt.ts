/**
 * @author Bin Lee
 * @email binlee120@gmail.com
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
 * Returns a colon-delimited string: iv:authTag:ciphertext (all hex-encoded).
 */
export function encryptField(plain: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

/**
 * Decrypts a value previously encrypted with encryptField.
 * Returns the plaintext string.
 */
export function decryptField(stored: string): string {
  const [ivHex, tagHex, cipherHex] = stored.split(":")
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
