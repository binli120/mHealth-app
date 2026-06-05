/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * POST /api/masshealth/benefit-policy-updates/notify
 * Checks submitted/non-draft applications for MassHealth policy updates and
 * creates in-app notifications when new findings are found.
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { listAppliedApplicationsForPolicyUpdates } from "@/lib/db/application-drafts"
import { notifyBenefitPolicyUpdatesForApplication } from "@/lib/masshealth/benefit-policy-change-notifier"
import { logServerError, logServerInfo } from "@/lib/server/logger"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const start = Date.now()
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) {
    return authResult.response
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown }
  const limit = normalizeLimit(body.limit)

  try {
    const applications = await listAppliedApplicationsForPolicyUpdates(authResult.userId, limit)
    if (applications.length === 0) {
      return NextResponse.json({
        ok: true,
        checked: false,
        checkedApplications: 0,
        notificationsCreated: 0,
        reason: "no_applied_applications",
      })
    }

    const results = []
    for (const application of applications) {
      const result = await notifyBenefitPolicyUpdatesForApplication({
        userId: authResult.userId,
        applicationId: application.id,
        applicationType: application.applicationType,
        wizardState: application.draftState,
      })
      results.push({
        applicationId: application.id,
        status: application.status,
        ...result,
      })
    }

    const notificationsCreated = results.filter((result) => result.notified).length
    logServerInfo("masshealth.benefitPolicyUpdates.notify.done", {
      userId: authResult.userId,
      checkedApplications: applications.length,
      notificationsCreated,
      ms: Date.now() - start,
    })

    return NextResponse.json({
      ok: true,
      checked: true,
      checkedApplications: applications.length,
      notificationsCreated,
      results,
    })
  } catch (error) {
    logServerError("masshealth.benefitPolicyUpdates.notify.error", error, {
      userId: authResult.userId,
      ms: Date.now() - start,
    })
    return NextResponse.json(
      { ok: false, error: "Failed to check MassHealth benefit policy updates." },
      { status: 502 },
    )
  }
}

function normalizeLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 5
  }
  return Math.max(1, Math.min(20, Math.trunc(value)))
}
