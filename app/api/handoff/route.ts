/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * POST   /api/handoff  — create session (authenticated)
 * GET    /api/handoff?token=xxx — poll status (authenticated)
 * DELETE /api/handoff?token=xxx — cancel session (authenticated)
 */
import { networkInterfaces } from "node:os"
import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  createHandoffSession,
  getHandoffSessionForUser,
  cancelHandoffSession,
  type HandoffContextType,
} from "@/lib/db/mobile-handoff-session"
import { logServerError } from "@/lib/server/logger"

const VALID_CONTEXT_TYPES = new Set<HandoffContextType>([
  "intake_chat", "mh_chat", "id_verify", "voice_message", "doc_upload",
])

function getMobileBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ||
    "http://localhost:3000"
  if (process.env.NODE_ENV !== "development") return configured
  if (!configured.includes("localhost") && !configured.includes("127.0.0.1")) return configured
  const port = (() => { try { return new URL(configured).port || "3000" } catch { return "3000" } })()
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return `http://${iface.address}:${port}`
    }
  }
  return configured
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  let body: { contextType?: string; contextPayload?: Record<string, unknown>; refreshToken?: string }
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }) }

  const { contextType, contextPayload = {}, refreshToken } = body
  if (!contextType || !VALID_CONTEXT_TYPES.has(contextType as HandoffContextType)) {
    return NextResponse.json({ ok: false, error: "Invalid contextType" }, { status: 400 })
  }
  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: "refreshToken required" }, { status: 400 })
  }

  try {
    const session = await createHandoffSession(auth.userId, contextType as HandoffContextType, contextPayload, refreshToken)
    const mobileUrl = `${getMobileBaseUrl()}/mobile/${session.token}`
    return NextResponse.json({ ok: true, token: session.token, mobileUrl, expiresAt: session.expiresAt })
  } catch (err) {
    logServerError("Failed to create handoff session", err, { module: "handoff" })
    return NextResponse.json({ ok: false, error: "Failed to create session" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const token = new URL(request.url).searchParams.get("token")?.trim()
  if (!token) return NextResponse.json({ ok: false, error: "token required" }, { status: 400 })

  try {
    const session = await getHandoffSessionForUser(auth.userId, token)
    if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 })
    return NextResponse.json({ ok: true, status: session.status, progressSummary: session.progressSummary, expiresAt: session.expiresAt })
  } catch (err) {
    logServerError("Failed to poll handoff session", err, { module: "handoff" })
    return NextResponse.json({ ok: false, error: "Failed to poll session" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const token = new URL(request.url).searchParams.get("token")?.trim()
  if (!token) return NextResponse.json({ ok: false, error: "token required" }, { status: 400 })

  try {
    await cancelHandoffSession(token, auth.userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    logServerError("Failed to cancel handoff session", err, { module: "handoff" })
    return NextResponse.json({ ok: false, error: "Failed to cancel session" }, { status: 500 })
  }
}
