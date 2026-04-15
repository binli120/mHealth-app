/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import type { Pool, PoolClient } from "pg"

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

type Queryable = Pool | PoolClient

function getQueryable(queryable?: Queryable): Queryable {
  return queryable ?? getDbPool()
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
export async function getInvitationByToken(
  token: string,
  queryable?: Queryable,
): Promise<Invitation | null> {
  const result = await getQueryable(queryable).query<Invitation>(
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

/** Claim an invitation atomically inside an existing transaction. */
export async function claimInvitationByToken(
  token: string,
  queryable?: Queryable,
): Promise<Invitation | null> {
  const result = await getQueryable(queryable).query<Invitation>(
    `
      UPDATE public.invitations inv
      SET accepted_at = now()
      WHERE inv.token = $1
        AND inv.accepted_at IS NULL
        AND inv.expires_at > now()
      RETURNING
        inv.id,
        inv.email,
        inv.company_id,
        NULL::text AS company_name,
        inv.role,
        inv.token,
        inv.invited_by,
        inv.accepted_at,
        inv.expires_at,
        inv.created_at
    `,
    [token],
  )

  return result.rows[0] ?? null
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
