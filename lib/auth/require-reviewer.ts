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

async function getUserRoles(userId: string): Promise<string[]> {
  const pool = getDbPool()
  try {
    const result = await pool.query<{ name: string }>(
      `
        SELECT r.name
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1::uuid
      `,
      [userId],
    )
    return result.rows.map((row) => row.name)
  } catch (error) {
    logServerError("[require-reviewer]", error, { fn: "getUserRoles", userId })
    return []
  }
}

function hasReviewerRole(roles: string[]): boolean {
  return roles.some((role) => REVIEWER_ROLE_NAMES.includes(role as (typeof REVIEWER_ROLE_NAMES)[number]))
}

export async function requireReviewer(request: Request): Promise<ReviewerAuthResult> {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) {
    return authResult
  }

  const roles = await getUserRoles(authResult.userId)
  if (!hasReviewerRole(roles)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Forbidden. Reviewer access required." },
        { status: 403 },
      ),
    }
  }

  // Local dev: skip MFA enforcement for E2E / local testing.
  if (isLocalAuthHelperEnabled() && isLocalRequest(request)) {
    return { ...authResult, roles }
  }

  // aal2 (MFA) is required for reviewer access.
  // Admin accounts already hold aal2; passkey sessions are aal2-equivalent.
  if (!authResult.isPasskeySession && authResult.aal !== "aal2") {
    const pool = getDbPool()
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
