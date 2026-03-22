/**
 * @author Bin Lee
 * @email binlee120@gmail.com
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

  // Debug: check what roles this user actually has
  const rolesDebug = await pool.query(
    `SELECT r.name, ur.user_id FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = $1::uuid`,
    [authResult.userId],
  )
  console.log("[requireAdmin] userId:", authResult.userId)
  console.log("[requireAdmin] roles found:", rolesDebug.rows)

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

  console.log("[requireAdmin] is_admin result:", result.rows[0])

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
