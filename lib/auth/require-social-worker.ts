/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { NextResponse } from "next/server"

import { getDbPool } from "@/lib/db/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

export async function requireApprovedSocialWorker(
  request: Request,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) {
    return authResult
  }

  const pool = getDbPool()
  const result = await pool.query<{ approved: boolean; is_admin: boolean }>(
    `
      SELECT
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          JOIN public.social_worker_profiles swp ON swp.user_id = ur.user_id
          WHERE ur.user_id = $1::uuid
            AND r.name = 'social_worker'
            AND swp.status = 'approved'
        ) AS approved,
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1::uuid
            AND r.name = 'admin'
        ) AS is_admin
    `,
    [authResult.userId],
  )

  // Admin accounts are entirely separate from social workers.
  if (result.rows[0]?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Forbidden. This endpoint is for social workers only." },
        { status: 403 },
      ),
    }
  }

  if (!result.rows[0]?.approved) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Forbidden. Approved social worker account required." },
        { status: 403 },
      ),
    }
  }

  return { ok: true, userId: authResult.userId }
}
