/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * POST /api/applications/[applicationId]/mobile-upload-session
 *   Creates a cross-device upload session.
 *   Body: { documentType?, requiredDocumentLabel? }
 *   Returns: { ok, token, expiresAt, mobileUrl }
 *
 * GET /api/applications/[applicationId]/mobile-upload-session?token=xxx
 *   Desktop polls for session completion.
 *   Returns: { ok, status, documentId }
 */

import { networkInterfaces } from "node:os"
import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  createMobileUploadSession,
  getUploadSessionForUser,
} from "@/lib/db/mobile-upload-session"
import { logServerError } from "@/lib/server/logger"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

function getMobileBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : null) ||
    "http://localhost:3000"

  if (process.env.NODE_ENV !== "development") return configured
  if (!configured.includes("localhost") && !configured.includes("127.0.0.1")) return configured

  const port = (() => {
    try { return new URL(configured).port || "3000" } catch { return "3000" }
  })()

  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return `http://${iface.address}:${port}`
      }
    }
  }

  return configured
}

// ─── POST — create session ─────────────────────────────────────────────────

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { applicationId } = await context.params
  if (!UUID_PATTERN.test(applicationId)) {
    return NextResponse.json({ ok: false, error: "applicationId must be a valid UUID." }, { status: 400 })
  }

  let documentType: string | undefined
  let requiredDocumentLabel: string | undefined
  try {
    const body = (await request.json()) as { documentType?: string; requiredDocumentLabel?: string }
    documentType = body.documentType?.trim() || undefined
    requiredDocumentLabel = body.requiredDocumentLabel?.trim() || undefined
  } catch {
    // Body is optional
  }

  try {
    const session = await createMobileUploadSession(
      auth.userId,
      applicationId,
      documentType,
      requiredDocumentLabel,
    )

    const mobileUrl = `${getMobileBaseUrl()}/upload/mobile/${session.token}`

    return NextResponse.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      mobileUrl,
    })
  } catch (err) {
    logServerError("Failed to create mobile upload session", err, { module: "mobile-upload-session" })
    return NextResponse.json({ ok: false, error: "Failed to create upload session." }, { status: 500 })
  }
}

// ─── GET — poll session status ─────────────────────────────────────────────

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { applicationId } = await context.params
  if (!UUID_PATTERN.test(applicationId)) {
    return NextResponse.json({ ok: false, error: "applicationId must be a valid UUID." }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ ok: false, error: "token is required." }, { status: 400 })
  }

  try {
    const session = await getUploadSessionForUser(auth.userId, token)
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      status: session.status,
      documentId: session.documentId,
      expiresAt: session.expiresAt,
      completedAt: session.completedAt,
    })
  } catch (err) {
    logServerError("Failed to poll mobile upload session", err, { module: "mobile-upload-session" })
    return NextResponse.json({ ok: false, error: "Failed to check session status." }, { status: 500 })
  }
}
