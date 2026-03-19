import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getUnreadCount } from "@/lib/db/notifications"
import { logServerError } from "@/lib/server/logger"

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const count = await getUnreadCount(auth.userId)
    return NextResponse.json({ ok: true, data: { count } })
  } catch (err) {
    logServerError("Failed to fetch unread notification count", err, { module: "api/notifications/unread-count", userId: auth.userId })
    return NextResponse.json({ ok: false, error: "Failed to load notification count." }, { status: 500 })
  }
}
