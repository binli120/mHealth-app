/**
 * Server-side storage helpers for admin passkeys.
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import type { AuthenticatorTransportFuture, WebAuthnCredential } from "@simplewebauthn/server"
import { getDbPool } from "@/lib/db/server"

export interface AdminPasskeyCredentialRow {
  id: string
  user_id: string
  credential_id: string
  public_key: string
  counter: string
  transports: string[]
  device_type: string
  backed_up: boolean
  name: string | null
}

export function bytesToBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url")
}

export function base64UrlToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"))
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const pool = getDbPool()
  const result = await pool.query<{ is_admin: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1::uuid
          AND r.name = 'admin'
      ) AS is_admin
    `,
    [userId],
  )
  return Boolean(result.rows[0]?.is_admin)
}

export async function getAdminUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const pool = getDbPool()
  const result = await pool.query<{ id: string; email: string }>(
    `
      SELECT u.id, u.email
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id
      JOIN public.roles r ON r.id = ur.role_id
      WHERE lower(u.email) = lower($1)
        AND u.is_active = true
        AND r.name = 'admin'
      LIMIT 1
    `,
    [email],
  )
  return result.rows[0] ?? null
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const pool = getDbPool()
  const result = await pool.query<{ email: string }>(
    `SELECT email FROM public.users WHERE id = $1::uuid LIMIT 1`,
    [userId],
  )
  return result.rows[0]?.email ?? null
}

export async function listAdminPasskeysForUser(userId: string): Promise<AdminPasskeyCredentialRow[]> {
  const pool = getDbPool()
  const result = await pool.query<AdminPasskeyCredentialRow>(
    `
      SELECT id, user_id, credential_id, public_key, counter::text, transports, device_type, backed_up, name
      FROM public.admin_passkey_credentials
      WHERE user_id = $1::uuid
      ORDER BY created_at ASC
    `,
    [userId],
  )
  return result.rows
}

export async function getAdminPasskeyByCredentialId(credentialId: string): Promise<AdminPasskeyCredentialRow | null> {
  const pool = getDbPool()
  const result = await pool.query<AdminPasskeyCredentialRow>(
    `
      SELECT id, user_id, credential_id, public_key, counter::text, transports, device_type, backed_up, name
      FROM public.admin_passkey_credentials
      WHERE credential_id = $1
      LIMIT 1
    `,
    [credentialId],
  )
  return result.rows[0] ?? null
}

export function toWebAuthnCredential(row: AdminPasskeyCredentialRow): WebAuthnCredential {
  return {
    id: row.credential_id,
    publicKey: base64UrlToBytes(row.public_key),
    counter: Number(row.counter),
    transports: row.transports as AuthenticatorTransportFuture[],
  }
}

export async function saveAdminPasskey(params: {
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
      INSERT INTO public.admin_passkey_credentials (
        user_id, credential_id, public_key, counter, transports, device_type, backed_up, name
      )
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

export async function updateAdminPasskeyCounter(credentialId: string, counter: number) {
  const pool = getDbPool()
  await pool.query(
    `
      UPDATE public.admin_passkey_credentials
      SET counter = $2,
          last_used_at = now()
      WHERE credential_id = $1
    `,
    [credentialId, counter],
  )
}
