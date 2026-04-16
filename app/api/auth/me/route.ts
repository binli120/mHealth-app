/**
 * GET /api/auth/me
 * Returns the authenticated user's roles and SW profile status.
 * Used by the login page to redirect to the correct dashboard.
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getDbPool } from "@/lib/db/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const pool = getDbPool()

  const [rolesResult, swResult] = await Promise.all([
    pool.query<{ name: string }>(
      `SELECT r.name FROM public.user_roles ur
       JOIN public.roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1::uuid`,
      [authResult.userId],
    ),
    pool.query<{ status: string }>(
      `SELECT status FROM public.social_worker_profiles WHERE user_id = $1::uuid LIMIT 1`,
      [authResult.userId],
    ),
  ])

  const roles = rolesResult.rows.map((r) => r.name)
  const swStatus = swResult.rows[0]?.status ?? null

  return NextResponse.json({ ok: true, roles, swStatus })
}
