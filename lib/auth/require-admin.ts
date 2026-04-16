/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { NextResponse } from "next/server"

import { getDbPool } from "@/lib/db/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

export async function requireAdmin(
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
    [authResult.userId],
  )

  if (!result.rows[0]?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Forbidden. Admin access required." },
        { status: 403 },
      ),
    }
  }

  return { ok: true, userId: authResult.userId }
}
