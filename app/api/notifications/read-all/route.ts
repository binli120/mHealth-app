import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { markAllAsRead } from "@/lib/db/notifications"
import { logServerError } from "@/lib/server/logger"

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    await markAllAsRead(auth.userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    logServerError("Failed to mark all notifications as read", err, { module: "api/notifications/read-all", userId: auth.userId })
    return NextResponse.json({ ok: false, error: "Failed to update notifications." }, { status: 500 })
  }
}
