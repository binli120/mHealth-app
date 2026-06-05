/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { listUsers, setUserActive, setUserRole, listCompaniesForSelect } from "@/lib/db/admin"
import { getSupabaseAdminClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? undefined
  const role = searchParams.get("role") ?? undefined
  const companyId = searchParams.get("company_id") ?? undefined
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100)
  const offset = parseInt(searchParams.get("offset") ?? "0", 10)

  // ?companies=1 returns the company select options alongside users (saves a round-trip)
  const includeCompanies = searchParams.get("companies") === "1"

  const [data, companies] = await Promise.all([
    listUsers({ search, role, companyId, limit, offset }),
    includeCompanies ? listCompaniesForSelect() : Promise.resolve(undefined),
  ])

  return NextResponse.json({ ok: true, ...data, ...(companies ? { companies } : {}) })
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string
    action?: "set_active" | "set_role" | "reset_mfa"
    isActive?: boolean
    roleName?: string
    add?: boolean
  }

  if (!body.userId || !body.action) {
    return NextResponse.json({ ok: false, error: "userId and action required" }, { status: 400 })
  }

  if (body.action === "set_active") {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ ok: false, error: "isActive required" }, { status: 400 })
    }
    await setUserActive(body.userId, body.isActive)
    return NextResponse.json({ ok: true })
  }

  if (body.action === "set_role") {
    if (!body.roleName || typeof body.add !== "boolean") {
      return NextResponse.json({ ok: false, error: "roleName and add required" }, { status: 400 })
    }
    await setUserRole(body.userId, body.roleName, body.add)
    return NextResponse.json({ ok: true })
  }

  if (body.action === "reset_mfa") {
    const adminClient = getSupabaseAdminClient()
    const { data: factors, error: listErr } = await adminClient.auth.admin.mfa.listFactors({ userId: body.userId })
    if (listErr) {
      return NextResponse.json({ ok: false, error: listErr.message }, { status: 500 })
    }
    const allFactors = (factors?.factors ?? []).filter((f) => f.factor_type === "totp")
    await Promise.all(
      allFactors.map((f: { id: string }) =>
        adminClient.auth.admin.mfa.deleteFactor({ userId: body.userId!, id: f.id }),
      ),
    )
    return NextResponse.json({ ok: true, removed: allFactors.length })
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 })
}
