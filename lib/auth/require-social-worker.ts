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

  // Batch role check + MFA policy flag in a single round-trip.
  // Fail CLOSED on DB error.
  let approved: boolean
  let isAdmin: boolean
  let require2fa: string | null
  try {
    const result = await pool.query<{ approved: boolean; is_admin: boolean; require_2fa: string | null }>(
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
          ) AS is_admin,
          (SELECT value FROM public.admin_settings WHERE key = 'require_2fa_social_worker') AS require_2fa
      `,
      [authResult.userId],
    )
    approved  = Boolean(result.rows[0]?.approved)
    isAdmin   = Boolean(result.rows[0]?.is_admin)
    require2fa = result.rows[0]?.require_2fa ?? null
  } catch (err) {
    logServerError("Failed to query social worker role / 2FA policy — failing closed", err, {
      userId: authResult.userId,
    })
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Unable to verify social worker access. Please try again." },
        { status: 503 },
      ),
    }
  }

  // Admin accounts are entirely separate from social workers.
  if (isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Forbidden. This endpoint is for social workers only." },
        { status: 403 },
      ),
    }
  }

  if (!approved) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Forbidden. Approved social worker account required." },
        { status: 403 },
      ),
    }
  }

  // aal2 (MFA) is enforced only when require_2fa_social_worker = 'true' in admin_settings.
  // Passkey sessions are always exempt. Local dev bypass skips enforcement for E2E tests.
  if (
    require2fa === "true" &&
    !authResult.isPasskeySession &&
    authResult.aal !== "aal2" &&
    !(isLocalAuthHelperEnabled() && isLocalRequest(request))
  ) {
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
      logServerError("Failed to query MFA factors for social worker gate — failing closed", err, {
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
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "MFA enrollment required for social worker access.", mfa_enrollment_required: true },
          { status: 403 },
        ),
      }
    }

    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Two-factor authentication required.", mfa_required: true },
        { status: 403 },
      ),
    }
  }

  return { ok: true, userId: authResult.userId }
}
