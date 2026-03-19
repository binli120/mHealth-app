/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getNotifications } from "@/lib/db/notifications"
import { logServerError } from "@/lib/server/logger"

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url)
    const parsedLimit = parseInt(url.searchParams.get("limit") ?? "50", 10)
    const limit = Math.min(isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit, 100)
    const notifications = await getNotifications(auth.userId, limit)
    return NextResponse.json({ ok: true, data: notifications })
  } catch (err) {
    logServerError("Failed to fetch notifications", err, { module: "api/notifications", userId: auth.userId })
    return NextResponse.json({ ok: false, error: "Failed to load notifications." }, { status: 500 })
  }
}
