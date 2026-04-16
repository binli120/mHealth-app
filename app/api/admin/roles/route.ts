/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/require-admin"
import {
  listRoles,
  updateRolePermissions,
  createRole,
  deleteRole,
} from "@/lib/db/admin-access"
import type { Permission } from "@/lib/constants/permissions"
import { toUserFacingError } from "@/lib/errors/user-facing"

export const runtime = "nodejs"

const permissionSchema = z.string().regex(/^[a-z_]+\.[a-z_]+$/)

const updatePermissionsSchema = z.object({
  action: z.literal("update_permissions"),
  roleName: z.string().min(1).max(64),
  permissions: z.array(permissionSchema).max(50),
})

const createRoleSchema = z.object({
  action: z.literal("create"),
  name: z.string().min(2).max(64).regex(/^[a-z_]+$/),
  description: z.string().max(200).default(""),
  color: z.string().max(20).default("#6b7280"),
  permissions: z.array(permissionSchema).max(50).default([]),
})

const deleteRoleSchema = z.object({
  action: z.literal("delete"),
  roleName: z.string().min(1).max(64),
})

const patchSchema = z.discriminatedUnion("action", [
  updatePermissionsSchema,
  deleteRoleSchema,
])

// GET /api/admin/roles
export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  try {
    const roles = await listRoles()
    return NextResponse.json({ ok: true, roles })
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingError(err, "Failed to load roles.") }, { status: 500 })
  }
}

// POST /api/admin/roles  → create a new role
export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  try {
    const body = await request.json()
    const payload = createRoleSchema.parse(body)
    await createRole(
      payload.name,
      payload.description,
      payload.color,
      payload.permissions as Permission[],
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 })
    }
    const msg = String(err)
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ ok: false, error: "A role with that name already exists" }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: toUserFacingError(msg, "Create failed.") }, { status: 500 })
  }
}

// PATCH /api/admin/roles  → update_permissions | delete
export async function PATCH(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  try {
    const body = await request.json()
    const payload = patchSchema.parse(body)

    if (payload.action === "update_permissions") {
      await updateRolePermissions(payload.roleName, payload.permissions as Permission[])
      return NextResponse.json({ ok: true })
    }

    if (payload.action === "delete") {
      const result = await deleteRole(payload.roleName)
      if (!result.deleted) {
        return NextResponse.json({ ok: false, error: result.reason }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: toUserFacingError(err, "Save failed.") }, { status: 500 })
  }
}
