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

  // Batch the role check and the MFA-required policy setting in a single query.
  // Fail CLOSED on any DB error — a transient failure must never grant admin access.
  let result: { rows: Array<{ is_admin: boolean; require_2fa: string | null }> }
  try {
    result = await pool.query<{ is_admin: boolean; require_2fa: string | null }>(
      `
        SELECT
          EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1::uuid
              AND r.name = 'admin'
          ) AS is_admin,
          (SELECT value FROM public.admin_settings WHERE key = 'require_2fa_admin') AS require_2fa
      `,
      [authResult.userId],
    )
  } catch (err) {
    logServerError("Failed to query admin role / 2FA policy — failing closed", err, {
      userId: authResult.userId,
    })
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Unable to verify admin access. Please try again." },
        { status: 503 },
      ),
    }
  }

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

  // Verify the DB policy setting.
  // If the key is ABSENT (null) — the admin_settings row was never seeded — fail
  // closed with 503: we cannot safely determine the MFA policy from an empty DB.
  // If the key is present but 'false' — log a security alert and continue;
  // MFA is still enforced by the aal2 / factor check below.
  const require2fa = result.rows[0]?.require_2fa
  if (require2fa === null || require2fa === undefined) {
    logServerError(
      "[SECURITY] admin_settings.require_2fa_admin key is missing from the database — failing closed. Re-run the baseline seed.",
      new Error("require_2fa_admin absent from DB"),
      { userId: authResult.userId },
    )
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Admin policy unavailable. Please contact your administrator." },
        { status: 503 },
      ),
    }
  }
  if (require2fa !== "true") {
    logServerError(
      "[SECURITY] admin_settings.require_2fa_admin is not 'true' — MFA is still enforced by code but the DB policy is misconfigured. Run migration 20260526000000_require_2fa_admin_true.sql.",
      new Error("require_2fa_admin misconfigured"),
      { currentValue: require2fa },
    )
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
