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

  // Local dev: skip MFA enforcement for E2E / local testing.
  if (isLocalAuthHelperEnabled() && isLocalRequest(request)) {
    return { ok: true, userId: authResult.userId }
  }

  // aal2 (MFA) is required for social worker access.
  // Passkey sessions are aal2-equivalent.
  if (!authResult.isPasskeySession && authResult.aal !== "aal2") {
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
