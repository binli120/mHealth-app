/**
 * PHI resume token — split, encrypt, serialize, and restore wizard state PHI.
 *
 * Token format (base64-encoded JSON):
 * {
 *   v:            1,
 *   applicationId: "<uuid>",
 *   persistedAt:  "<ISO string>",
 *   k:            "<base64 AES-256 key>",
 *   iv:           "<base64 12-byte GCM IV>",
 *   ciphertext:   "<base64 AES-GCM ciphertext>"
 * }
 *
 * The key is embedded in the token so the user only needs the file.
 * PHI never reaches the server — it is extracted before any PUT request.
 */

import { PHI_DATA_KEY_SET, type PhiDataKey } from "./phi-fields"
import {
  generateKey,
  exportKeyBase64,
  importKeyBase64,
  encryptJson,
  decryptJson,
} from "./crypto"

const TOKEN_VERSION = 1

export interface PhiToken {
  v: number
  applicationId: string
  persistedAt: string
  k: string
  iv: string
  ciphertext: string
}

/** PHI fields lifted out of WizardState.data */
export type PhiPayload = Record<PhiDataKey, unknown>

/**
 * Split a wizard state snapshot into:
 * - safeState  → safe to send to the server (no PHI)
 * - phiPayload → PHI fields, intended only for the encrypted token
 */
export function splitWizardState(state: Record<string, unknown>): {
  safeState: Record<string, unknown>
  phiPayload: PhiPayload
} {
  const data = state.data
  const safeData: Record<string, unknown> = {}
  const phiPayload: Partial<PhiPayload> = {}

  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (PHI_DATA_KEY_SET.has(key)) {
        phiPayload[key as PhiDataKey] = value
      } else {
        safeData[key] = value
      }
    }
  }

  return {
    safeState: { ...state, data: safeData },
    phiPayload: phiPayload as PhiPayload,
  }
}

/**
 * Merge decrypted PHI back into a server-loaded state snapshot.
 * Used during resume: server provides workflow metadata, token provides PHI.
 */
export function mergePhiIntoState(
  serverState: Record<string, unknown>,
  phiPayload: PhiPayload,
): Record<string, unknown> {
  const existingData = (serverState.data ?? {}) as Record<string, unknown>
  return {
    ...serverState,
    data: { ...existingData, ...phiPayload },
  }
}

/** Encrypt phiPayload and wrap it into a portable token object. */
export async function buildPhiToken(
  applicationId: string,
  phiPayload: PhiPayload,
): Promise<PhiToken> {
  const key = await generateKey()
  const [keyB64, { iv, ciphertext }] = await Promise.all([
    exportKeyBase64(key),
    encryptJson(phiPayload, key),
  ])

  return {
    v: TOKEN_VERSION,
    applicationId,
    persistedAt: new Date().toISOString(),
    k: keyB64,
    iv,
    ciphertext,
  }
}

/** Decrypt and return the PHI payload from a token. */
export async function decryptPhiToken(token: PhiToken): Promise<PhiPayload> {
  if (token.v !== TOKEN_VERSION) {
    throw new Error(`Unsupported token version: ${token.v}`)
  }
  const key = await importKeyBase64(token.k)
  const payload = await decryptJson(token.iv, token.ciphertext, key)
  return payload as PhiPayload
}

/** Encode a token as a portable base64 string (safe to copy/paste). */
export function serializeToken(token: PhiToken): string {
  return btoa(JSON.stringify(token))
}

/** Decode a base64 token string back to a PhiToken object. */
export function deserializeToken(input: string): PhiToken {
  let parsed: unknown
  try {
    parsed = JSON.parse(atob(input.trim()))
  } catch {
    throw new Error("Invalid resume token — could not decode.")
  }

  const t = parsed as Record<string, unknown>
  if (
    typeof t.v !== "number" ||
    typeof t.applicationId !== "string" ||
    typeof t.k !== "string" ||
    typeof t.iv !== "string" ||
    typeof t.ciphertext !== "string"
  ) {
    throw new Error("Invalid resume token — missing required fields.")
  }

  return t as unknown as PhiToken
}

/** Trigger a browser file download for the token. */
export function downloadTokenFile(token: PhiToken, applicationId: string): void {
  const tokenString = serializeToken(token)
  const blob = new Blob([tokenString], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `healthcompass-draft-${applicationId.slice(0, 8)}.token`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Storage-based resume token ───────────────────────────────────────────────
//
// For the Supabase Storage flow the user receives a compact string:
//   "{resumeId}.{base64AESKey}"
//
// resumeId  — UUID stored in the DB, used as the storage blob lookup key.
// base64Key — AES-256 key (never stored server-side), required to decrypt.
//
// Without both pieces the blob cannot be retrieved or decrypted.

const RESUME_TOKEN_SEPARATOR = "."

/**
 * Encode a resumeId + key pair into the portable token string shown to the user.
 */
export function buildResumeTokenString(resumeId: string, keyBase64: string): string {
  // Replace base64 padding "=" with "" to avoid ambiguity with the separator
  // (base64 doesn't contain "."), then re-add padding on parse.
  return `${resumeId}${RESUME_TOKEN_SEPARATOR}${keyBase64.replace(/=/g, "")}`
}

export interface ParsedResumeToken {
  resumeId: string
  keyBase64: string
}

/** Decode a resume token string into its resumeId and AES key. */
export function parseResumeTokenString(tokenString: string): ParsedResumeToken {
  const trimmed = tokenString.trim()
  // UUID is exactly 36 chars; separator is at index 36.
  if (trimmed.length < 38) {
    throw new Error("Invalid resume token — too short.")
  }

  const resumeId = trimmed.slice(0, 36)
  const sep = trimmed[36]
  const keyPart = trimmed.slice(37)

  if (sep !== RESUME_TOKEN_SEPARATOR || !keyPart) {
    throw new Error("Invalid resume token — malformed.")
  }

  // Restore base64 padding
  const padding = (4 - (keyPart.length % 4)) % 4
  const keyBase64 = keyPart + "=".repeat(padding)

  return { resumeId, keyBase64 }
}

/**
 * Encrypt a PHI payload and produce the opaque blob string to upload to storage,
 * plus the resume token string to give the user.
 */
export async function buildStorageDraft(
  applicationId: string,
  phiPayload: PhiPayload,
): Promise<{
  resumeId: string
  encryptedBlob: string
  keyBase64: string
  resumeTokenString: string
}> {
  const { createUuid } = await import("@/lib/utils/random-id")
  const resumeId = createUuid()
  const key = await generateKey()
  const [keyBase64, { iv, ciphertext }] = await Promise.all([
    exportKeyBase64(key),
    encryptJson(phiPayload, key),
  ])

  const blob = JSON.stringify({ v: TOKEN_VERSION, iv, ciphertext })
  return {
    resumeId,
    encryptedBlob: blob,
    keyBase64,
    resumeTokenString: buildResumeTokenString(resumeId, keyBase64),
  }
}

/**
 * Decrypt an encrypted blob string (downloaded from storage) using the key
 * extracted from the user's resume token.
 */
export async function decryptStorageDraft(
  encryptedBlob: string,
  keyBase64: string,
): Promise<PhiPayload> {
  const parsed = JSON.parse(encryptedBlob) as { v: number; iv: string; ciphertext: string }
  if (parsed.v !== TOKEN_VERSION) {
    throw new Error(`Unsupported blob version: ${parsed.v}`)
  }
  const key = await importKeyBase64(keyBase64)
  const payload = await decryptJson(parsed.iv, parsed.ciphertext, key)
  return payload as PhiPayload
}
