/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser, isLocalRequest } from "@/lib/auth/require-auth"
import { isLocalAuthHelperEnabled } from "@/lib/auth/local-auth"
import { getDbPool } from "@/lib/db/server"
import { logServerError } from "@/lib/server/logger"

export const REVIEWER_ROLE_NAMES = ["admin", "reviewer", "case_reviewer", "supervisor"] as const

type AuthenticatedUserResult = Extract<
  Awaited<ReturnType<typeof requireAuthenticatedUser>>,
  { ok: true }
>

export type ReviewerAuthResult =
  | (AuthenticatedUserResult & { roles: string[] })
  | { ok: false; response: NextResponse }

function hasReviewerRole(roles: string[]): boolean {
  return roles.some((role) => REVIEWER_ROLE_NAMES.includes(role as (typeof REVIEWER_ROLE_NAMES)[number]))
}

export async function requireReviewer(request: Request): Promise<ReviewerAuthResult> {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) {
    return authResult
  }

  const pool = getDbPool()

  // Batch role list + MFA policy flag in a single round-trip.
  // Fail CLOSED on DB error — a transient failure must never grant reviewer access.
  let roles: string[]
  let require2fa: string | null
  try {
    const result = await pool.query<{ role_name: string; require_2fa: string | null }>(
      `
        SELECT
          r.name AS role_name,
          (SELECT value FROM public.admin_settings WHERE key = 'require_2fa_reviewer') AS require_2fa
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1::uuid
      `,
      [authResult.userId],
    )
    roles = result.rows.map((row) => row.role_name)
    require2fa = result.rows[0]?.require_2fa ?? null
  } catch (err) {
    logServerError("Failed to query reviewer role / 2FA policy — failing closed", err, {
      userId: authResult.userId,
    })
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Unable to verify reviewer access. Please try again." },
        { status: 503 },
      ),
    }
  }

  if (!hasReviewerRole(roles)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Forbidden. Reviewer access required." },
        { status: 403 },
      ),
    }
  }

  // aal2 (MFA) is enforced only when require_2fa_reviewer = 'true' in admin_settings.
  // Passkey sessions and admin accounts (which already hold aal2) are always exempt.
  // Local dev bypass: skip when isLocalAuthHelperEnabled() to allow E2E tests.
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
      logServerError("Failed to query MFA factors for reviewer gate — failing closed", err, {
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
          { ok: false, error: "MFA enrollment required for reviewer access.", mfa_enrollment_required: true },
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

  return { ...authResult, roles }
}

export async function requireReviewerFromHeaders(pathname = "/reviewer/dashboard"): Promise<ReviewerAuthResult> {
  const headerList = await headers()
  const requestHeaders = new Headers(headerList)
  const host = requestHeaders.get("host") ?? "localhost"
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http"
  return requireReviewer(new Request(`${protocol}://${host}${pathname}`, { headers: requestHeaders }))
}
