/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { NextResponse } from "next/server"

import { getDbPool } from "@/lib/db/server"
import { requireAuthenticatedUser, isLocalRequest } from "@/lib/auth/require-auth"
import { isLocalAuthHelperEnabled } from "@/lib/auth/local-auth"
import { logServerError } from "@/lib/server/logger"

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

  // Local dev: when the local auth helper is enabled (NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS=true)
  // and the request comes from a local hostname, skip MFA enforcement so E2E tests can reach
  // admin routes without needing a real TOTP factor. Never active in production.
  if (isLocalAuthHelperEnabled() && isLocalRequest(request)) {
    return { ok: true, userId: authResult.userId }
  }

  // Passkey sessions are already strong two-factor auth — skip TOTP check.
  if (!authResult.isPasskeySession) {
    if (authResult.aal !== "aal2") {
      // Always verify MFA enrollment status. Fail CLOSED on any DB error —
      // a transient error must never grant admin access without MFA.
      let hasMfa: boolean
      try {
        const mfaResult = await pool.query<{ count: string }>(
          `SELECT COUNT(*) AS count
           FROM auth.mfa_factors
           WHERE user_id = $1::uuid
             AND factor_type = 'totp'
             AND status = 'verified'`,
          [authResult.userId],
        )
        hasMfa = parseInt(mfaResult.rows[0]?.count ?? "0", 10) > 0
      } catch (err) {
        logServerError("Failed to query MFA factors for admin gate", err, {
          userId: authResult.userId,
        })
        return {
          ok: false,
          response: NextResponse.json(
            { ok: false, error: "Unable to verify MFA status. Please try again." },
            { status: 503 },
          ),
        }
      }

      if (!hasMfa) {
        // Admin has no TOTP factor enrolled at all — require enrollment before granting access.
        return {
          ok: false,
          response: NextResponse.json(
            { ok: false, error: "MFA enrollment required for admin access.", mfa_enrollment_required: true },
            { status: 403 },
          ),
        }
      }

      // Admin has MFA enrolled but hasn't completed it this session.
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "Two-factor authentication required.", mfa_required: true },
          { status: 403 },
        ),
      }
    }
  }

  return { ok: true, userId: authResult.userId }
}
