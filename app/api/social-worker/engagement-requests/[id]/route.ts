/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * PATCH /api/social-worker/engagement-requests/[id]
 * SW accepts or rejects a pending engagement request.
 * Body: { action: "accept" | "reject", rejectionNote?: string }
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getSwProfile } from "@/lib/db/social-worker"
import { acceptEngagementRequest, rejectEngagementRequest } from "@/lib/db/sw-messaging"
import {
  notifyEngagementAccepted,
  notifyEngagementRejected,
} from "@/lib/notifications/service"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const profile = await getSwProfile(authResult.userId)
    if (!profile || profile.status !== "approved") {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    const action = body?.action as string | undefined
    const rejectionNote =
      typeof body?.rejectionNote === "string" ? body.rejectionNote.trim() : undefined

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { ok: false, error: "action must be 'accept' or 'reject'." },
        { status: 400 },
      )
    }

    if (action === "accept") {
      const updated = await acceptEngagementRequest(id, authResult.userId)
      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "Request not found or already resolved." },
          { status: 404 },
        )
      }

      void notifyEngagementAccepted(
        updated.patientUserId,
        updated.swName ?? updated.swEmail,
        updated.id,
      )

      return NextResponse.json({ ok: true, request: updated })
    }

    // reject
    const updated = await rejectEngagementRequest(id, authResult.userId, rejectionNote)
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Request not found or already resolved." },
        { status: 404 },
      )
    }

    void notifyEngagementRejected(
      updated.patientUserId,
      updated.swName ?? updated.swEmail,
      updated.id,
      updated.rejectionNote,
    )

    return NextResponse.json({ ok: true, request: updated })
  } catch (error) {
    logServerError("PATCH /api/social-worker/engagement-requests/[id] failed", error, {
      module: "api/social-worker/engagement-requests/[id]",
    })
    return NextResponse.json({ ok: false, error: "Failed to process request." }, { status: 500 })
  }
}
