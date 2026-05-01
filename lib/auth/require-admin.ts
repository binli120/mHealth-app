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

  // Passkey sessions are already strong two-factor auth — skip TOTP check.
  if (!authResult.isPasskeySession && authResult.aal !== "aal2") {
    try {
      const mfaResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM auth.mfa_factors
         WHERE user_id = $1::uuid
           AND factor_type = 'totp'
           AND status = 'verified'`,
        [authResult.userId],
      )
      const hasMfa = parseInt(mfaResult.rows[0]?.count ?? "0", 10) > 0
      if (hasMfa) {
        return {
          ok: false,
          response: NextResponse.json(
            { ok: false, error: "Two-factor authentication required.", mfa_required: true },
            { status: 403 },
          ),
        }
      }
    } catch {
      // If auth.mfa_factors is inaccessible (e.g. restricted DB role), fail open
      // so existing sessions aren't unexpectedly broken.
    }
  }

  return { ok: true, userId: authResult.userId }
}
