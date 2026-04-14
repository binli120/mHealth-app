/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Patient engagement request endpoints.
 * GET  /api/patient/sw-request        — list this patient's requests
 * POST /api/patient/sw-request        — send a new request to a SW
 * DELETE /api/patient/sw-request?id=  — cancel a pending request
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  cancelEngagementRequest,
  createEngagementRequest,
  getPatientEngagementRequests,
  hasPendingRequest,
} from "@/lib/db/sw-messaging"
import { getSwProfile } from "@/lib/db/social-worker"
import { notifySwEngagementRequest } from "@/lib/notifications/service"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const requests = await getPatientEngagementRequests(authResult.userId)
    return NextResponse.json({ ok: true, requests })
  } catch (error) {
    logServerError("GET /api/patient/sw-request failed", error, { module: "api/patient/sw-request" })
    return NextResponse.json({ ok: false, error: "Failed to load requests." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = await request.json().catch(() => null)
    const swUserId = typeof body?.swUserId === "string" ? body.swUserId.trim() : ""
    const message = typeof body?.message === "string" ? body.message.trim() : undefined

    if (!swUserId) {
      return NextResponse.json({ ok: false, error: "swUserId is required." }, { status: 400 })
    }

    // Verify SW is approved
    const swProfile = await getSwProfile(swUserId)
    if (!swProfile || swProfile.status !== "approved") {
      return NextResponse.json(
        { ok: false, error: "Social worker not found or not approved." },
        { status: 404 },
      )
    }

    // Prevent duplicate pending requests
    const alreadyPending = await hasPendingRequest(authResult.userId, swUserId)
    if (alreadyPending) {
      return NextResponse.json(
        { ok: false, error: "You already have a pending request with this social worker." },
        { status: 409 },
      )
    }

    const engagementRequest = await createEngagementRequest(authResult.userId, swUserId, message)

    // Notify the SW (fire-and-forget)
    void notifySwEngagementRequest(
      swUserId,
      engagementRequest.patientName ?? engagementRequest.patientEmail,
      engagementRequest.id,
    )

    return NextResponse.json({ ok: true, request: engagementRequest }, { status: 201 })
  } catch (error) {
    logServerError("POST /api/patient/sw-request failed", error, { module: "api/patient/sw-request" })
    return NextResponse.json({ ok: false, error: "Failed to send request." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { searchParams } = new URL(request.url)
    const requestId = (searchParams.get("id") ?? "").trim()
    if (!requestId) {
      return NextResponse.json({ ok: false, error: "id query param is required." }, { status: 400 })
    }

    const cancelled = await cancelEngagementRequest(requestId, authResult.userId)
    if (!cancelled) {
      return NextResponse.json(
        { ok: false, error: "Request not found or already resolved." },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError("DELETE /api/patient/sw-request failed", error, { module: "api/patient/sw-request" })
    return NextResponse.json({ ok: false, error: "Failed to cancel request." }, { status: 500 })
  }
}
