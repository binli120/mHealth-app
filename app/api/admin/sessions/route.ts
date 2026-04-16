/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/require-admin"
import {
  listActiveSessions,
  logLoginEvent,
  getAdminSettings,
  upsertAdminSetting,
} from "@/lib/db/admin-access"
import { getSupabaseAdminClient } from "@/lib/supabase/server"
import { logServerError } from "@/lib/server/logger"
import { toUserFacingError } from "@/lib/errors/user-facing"

export const runtime = "nodejs"

const ERROR_LOG_PREFIX = "[admin/sessions]"

const forceLogoutSchema = z.object({
  action: z.literal("force_logout"),
  userId: z.string().uuid(),
})

const forceLogoutAllSchema = z.object({
  action: z.literal("force_logout_all"),
})

const updateSettingsSchema = z.object({
  action: z.literal("update_settings"),
  settings: z.record(z.string().max(64), z.string().max(256)).refine(
    (obj) => Object.keys(obj).length <= 20,
    { message: "Too many settings keys" },
  ),
})

const patchSchema = z.discriminatedUnion("action", [
  forceLogoutSchema,
  forceLogoutAllSchema,
  updateSettingsSchema,
])

// GET /api/admin/sessions
export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  try {
    const [sessions, settings] = await Promise.all([
      listActiveSessions(200),
      getAdminSettings(),
    ])
    return NextResponse.json({ ok: true, sessions, settings })
  } catch (err) {
    logServerError(ERROR_LOG_PREFIX, err, { route: "/api/admin/sessions", method: "GET" })
    return NextResponse.json({ ok: false, error: toUserFacingError(err, "Failed to load sessions.") }, { status: 500 })
  }
}

// PATCH /api/admin/sessions  → force_logout | force_logout_all | update_settings
export async function PATCH(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  try {
    const body = await request.json()
    const payload = patchSchema.parse(body)

    if (payload.action === "force_logout") {
      const supabase = getSupabaseAdminClient()
      const { error } = await supabase.auth.admin.signOut(payload.userId)
      if (error) {
        return NextResponse.json({ ok: false, error: toUserFacingError(error, "Force logout failed.") }, { status: 502 })
      }
      void logLoginEvent(payload.userId, "force_logout")
      return NextResponse.json({ ok: true })
    }

    if (payload.action === "force_logout_all") {
      // Sign out all users by listing recent active sessions and signing each out
      const sessions = await listActiveSessions(500)
      const supabase = getSupabaseAdminClient()
      const uniqueUserIds = [...new Set(sessions.map((s) => s.user_id).filter(Boolean))] as string[]
      const results = await Promise.allSettled(
        uniqueUserIds.map((uid) => supabase.auth.admin.signOut(uid)),
      )
      const failures = results.filter((r) => r.status === "rejected").length
      await Promise.allSettled(
        uniqueUserIds.map((uid) => logLoginEvent(uid, "force_logout")),
      )
      return NextResponse.json({ ok: true, loggedOut: uniqueUserIds.length - failures, failures })
    }

    if (payload.action === "update_settings") {
      await Promise.all(
        Object.entries(payload.settings).map(([k, v]) => upsertAdminSetting(k, v)),
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 })
    }
    logServerError(ERROR_LOG_PREFIX, err, { route: "/api/admin/sessions", method: "PATCH" })
    return NextResponse.json({ ok: false, error: toUserFacingError(err, "Session settings update failed.") }, { status: 500 })
  }
}
