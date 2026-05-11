/**
 * Server-side DB helpers for patient/user passkey credentials.
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import type { AuthenticatorTransportFuture, WebAuthnCredential } from "@simplewebauthn/server"
import { getDbPool } from "@/lib/db/server"
import { bytesToBase64Url, base64UrlToBytes } from "@/lib/auth/admin-passkeys"

export interface UserPasskeyRow {
  id: string
  user_id: string
  credential_id: string
  public_key: string
  counter: string
  transports: string[]
  device_type: string
  backed_up: boolean
  name: string | null
  created_at: string
}

export async function listPasskeysForUser(userId: string): Promise<UserPasskeyRow[]> {
  const pool = getDbPool()
  const result = await pool.query<UserPasskeyRow>(
    `
      SELECT id, user_id, credential_id, public_key, counter::text,
             transports, device_type, backed_up, name, created_at
      FROM public.user_passkey_credentials
      WHERE user_id = $1::uuid
      ORDER BY created_at ASC
    `,
    [userId],
  )
  return result.rows
}

export async function getPasskeyByCredentialId(credentialId: string): Promise<UserPasskeyRow | null> {
  const pool = getDbPool()
  const result = await pool.query<UserPasskeyRow>(
    `
      SELECT id, user_id, credential_id, public_key, counter::text,
             transports, device_type, backed_up, name, created_at
      FROM public.user_passkey_credentials
      WHERE credential_id = $1
      LIMIT 1
    `,
    [credentialId],
  )
  return result.rows[0] ?? null
}

export function toWebAuthnCredential(row: UserPasskeyRow): WebAuthnCredential {
  return {
    id: row.credential_id,
    publicKey: base64UrlToBytes(row.public_key),
    counter: Number(row.counter),
    transports: row.transports as AuthenticatorTransportFuture[],
  }
}

export async function saveUserPasskey(params: {
  userId: string
  credentialId: string
  publicKey: Uint8Array
  counter: number
  transports: string[]
  deviceType: string
  backedUp: boolean
  name?: string | null
}) {
  const pool = getDbPool()
  await pool.query(
    `
      INSERT INTO public.user_passkey_credentials
        (user_id, credential_id, public_key, counter, transports, device_type, backed_up, name)
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (credential_id) DO NOTHING
    `,
    [
      params.userId,
      params.credentialId,
      bytesToBase64Url(params.publicKey),
      params.counter,
      params.transports,
      params.deviceType,
      params.backedUp,
      params.name ?? null,
    ],
  )
}

export async function deleteUserPasskey(userId: string, passkeyId: string): Promise<boolean> {
  const pool = getDbPool()
  const result = await pool.query(
    `
      DELETE FROM public.user_passkey_credentials
      WHERE id = $1::uuid AND user_id = $2::uuid
    `,
    [passkeyId, userId],
  )
  return (result.rowCount ?? 0) > 0
}

export async function updatePasskeyCounter(credentialId: string, counter: number) {
  const pool = getDbPool()
  await pool.query(
    `
      UPDATE public.user_passkey_credentials
      SET counter = $2, last_used_at = now()
      WHERE credential_id = $1
    `,
    [credentialId, counter],
  )
}

export { bytesToBase64Url, base64UrlToBytes }
