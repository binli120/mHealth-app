/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"

export interface Invitation {
  id: string
  email: string
  company_id: string | null
  company_name: string | null
  role: string
  token: string
  invited_by: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
}

/** Create a new invitation record and return the token. */
export async function createInvitation(opts: {
  email: string
  companyId?: string | null
  role?: string
  invitedBy: string
}): Promise<{ token: string; id: string }> {
  const pool = getDbPool()
  const result = await pool.query<{ token: string; id: string }>(
    `
      INSERT INTO public.invitations (email, company_id, role, invited_by)
      VALUES ($1, $2, $3, $4::uuid)
      RETURNING token, id
    `,
    [
      opts.email.trim().toLowerCase(),
      opts.companyId ?? null,
      opts.role ?? "applicant",
      opts.invitedBy,
    ],
  )
  return result.rows[0]
}

/** Look up an invitation by token — returns null if not found. */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const pool = getDbPool()
  const result = await pool.query<Invitation>(
    `
      SELECT
        inv.id, inv.email, inv.company_id, c.name AS company_name,
        inv.role, inv.token, inv.invited_by,
        inv.accepted_at, inv.expires_at, inv.created_at
      FROM public.invitations inv
      LEFT JOIN public.companies c ON c.id = inv.company_id
      WHERE inv.token = $1
      LIMIT 1
    `,
    [token],
  )
  return result.rows[0] ?? null
}

/** Mark an invitation as accepted. */
export async function acceptInvitation(token: string): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE public.invitations SET accepted_at = now() WHERE token = $1`,
    [token],
  )
}

/** List all pending (not accepted, not expired) invitations for a company. */
export async function listPendingInvitations(companyId?: string): Promise<Invitation[]> {
  const pool = getDbPool()
  const conditions = [
    "inv.accepted_at IS NULL",
    "inv.expires_at > now()",
  ]
  const params: unknown[] = []
  if (companyId) {
    conditions.push(`inv.company_id = $1::uuid`)
    params.push(companyId)
  }

  const result = await pool.query<Invitation>(
    `
      SELECT
        inv.id, inv.email, inv.company_id, c.name AS company_name,
        inv.role, inv.token, inv.invited_by,
        inv.accepted_at, inv.expires_at, inv.created_at
      FROM public.invitations inv
      LEFT JOIN public.companies c ON c.id = inv.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY inv.created_at DESC
    `,
    params,
  )
  return result.rows
}
