/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  getAnalyticsIpHash,
  getAnalyticsUserHash,
  sanitizeActiveDurationMs,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsSessionId,
} from "@/lib/server/customer-analytics"
import { logServerInfo } from "@/lib/server/logger"

export const runtime = "nodejs"

type AnalyticsEventType = "page_view" | "active_time"

interface AnalyticsPayload {
  eventType?: unknown
  path?: unknown
  sessionId?: unknown
  durationMs?: unknown
}

function getEventType(value: unknown): AnalyticsEventType | null {
  return value === "page_view" || value === "active_time" ? value : null
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as AnalyticsPayload | null
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 })
  }

  const eventType = getEventType(payload.eventType)
  if (!eventType) {
    return NextResponse.json({ ok: false, error: "Unsupported analytics event type." }, { status: 400 })
  }

  const sessionId = sanitizeAnalyticsSessionId(payload.sessionId)
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId is required." }, { status: 400 })
  }

  const authResult = await requireAuthenticatedUser(request)
  const userHash = authResult.ok ? getAnalyticsUserHash(authResult.userId) : undefined
  const ipHash = getAnalyticsIpHash(request)
  const path = sanitizeAnalyticsPath(payload.path)

  if (eventType === "active_time") {
    const durationMs = sanitizeActiveDurationMs(payload.durationMs)
    if (durationMs <= 0) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    logServerInfo("customer.active_time", {
      duration_ms: durationMs,
      path,
      route: "/api/analytics/session",
      session_id: sessionId,
      ...(ipHash ? { ip_hash: ipHash } : {}),
      ...(userHash ? { user_hash: userHash } : {}),
    })

    return NextResponse.json({ ok: true })
  }

  logServerInfo("customer.page_view", {
    path,
    route: "/api/analytics/session",
    session_id: sessionId,
    ...(ipHash ? { ip_hash: ipHash } : {}),
    ...(userHash ? { user_hash: userHash } : {}),
  })

  return NextResponse.json({ ok: true })
}
