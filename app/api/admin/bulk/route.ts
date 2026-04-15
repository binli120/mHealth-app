/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/require-admin"
import { bulkSetActive, bulkSetRole, bulkImportUsers } from "@/lib/db/admin-access"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

const ERROR_LOG_PREFIX = "[admin/bulk]"
const MAX_BULK_IDS = 500
const MAX_IMPORT_ROWS = 500

const deactivateSchema = z.object({
  action: z.literal("deactivate"),
  userIds: z.array(z.string().uuid()).min(1).max(MAX_BULK_IDS),
})

const activateSchema = z.object({
  action: z.literal("activate"),
  userIds: z.array(z.string().uuid()).min(1).max(MAX_BULK_IDS),
})

const setRoleSchema = z.object({
  action: z.literal("set_role"),
  userIds: z.array(z.string().uuid()).min(1).max(MAX_BULK_IDS),
  role: z.string().min(1).max(64),
})

const csvRowSchema = z.object({
  email: z.string().email().max(254),
  first_name: z.string().max(100).default(""),
  last_name: z.string().max(100).default(""),
  role: z.string().max(64).default("applicant"),
  company_id: z.string().max(64).optional(),
})

const importCsvSchema = z.object({
  action: z.literal("import_csv"),
  rows: z.array(csvRowSchema).min(1).max(MAX_IMPORT_ROWS),
})

const requestSchema = z.discriminatedUnion("action", [
  deactivateSchema,
  activateSchema,
  setRoleSchema,
  importCsvSchema,
])

// POST /api/admin/bulk
export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  try {
    const body = await request.json()
    const payload = requestSchema.parse(body)

    if (payload.action === "deactivate") {
      const result = await bulkSetActive(payload.userIds, false)
      return NextResponse.json({ ok: true, ...result })
    }

    if (payload.action === "activate") {
      const result = await bulkSetActive(payload.userIds, true)
      return NextResponse.json({ ok: true, ...result })
    }

    if (payload.action === "set_role") {
      const result = await bulkSetRole(payload.userIds, payload.role)
      return NextResponse.json({ ok: true, ...result })
    }

    if (payload.action === "import_csv") {
      const result = await bulkImportUsers(payload.rows)
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request", detail: err.flatten() },
        { status: 400 },
      )
    }
    logServerError(ERROR_LOG_PREFIX, err, { route: "/api/admin/bulk", method: "POST" })
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
