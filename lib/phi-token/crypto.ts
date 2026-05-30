/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Client-side AES-256-GCM encryption using the browser Web Crypto API.
 * This module must only be imported in client components (never server-only code).
 *
 * Security model: the generated key is embedded in the resume token so the user
 * only needs to keep the token file. The encryption ensures PHI never travels
 * over the network to our servers — it stays on the user's device.
 */

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_LENGTH }, true, [
    "encrypt",
    "decrypt",
  ])
}

export async function exportKeyBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key)
  return toBase64(new Uint8Array(raw))
}

export async function importKeyBase64(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromBase64(b64), { name: ALGORITHM }, false, ["decrypt"])
}

export async function encryptJson(
  value: unknown,
  key: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(JSON.stringify(value))
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded)
  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
  }
}

export async function decryptJson(iv: string, ciphertext: string, key: CryptoKey): Promise<unknown> {
  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(plainBuffer))
}
