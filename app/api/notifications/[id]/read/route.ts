import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { markAsRead } from "@/lib/db/notifications"
import { logServerError } from "@/lib/server/logger"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    await markAsRead(id, auth.userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    logServerError("Failed to mark notification as read", err, { module: "api/notifications/[id]/read", userId: auth.userId })
    return NextResponse.json({ ok: false, error: "Failed to update notification." }, { status: 500 })
  }
}
