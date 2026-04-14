/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { getApplicationsForExport, getUsersForExport } from "@/lib/db/admin-analytics"

export const runtime = "nodejs"

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [headers.join(",")]
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(","))
  }
  return lines.join("\n")
}

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")

  try {
    if (type === "applications") {
      const rows = await getApplicationsForExport({
        status: searchParams.get("status") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
      })

      const headers = [
        "id", "status", "first_name", "last_name", "email",
        "household_size", "total_monthly_income", "fpl_percentage",
        "estimated_program", "confidence_score",
        "created_at", "submitted_at", "decided_at",
      ]
      const csv = buildCsv(headers, rows as unknown as Record<string, unknown>[])

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    if (type === "users") {
      const rows = await getUsersForExport()

      const headers = [
        "id", "email", "first_name", "last_name",
        "roles", "company_name", "is_active", "created_at",
      ]
      const csv = buildCsv(headers, rows as unknown as Record<string, unknown>[])

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    return NextResponse.json({ ok: false, error: "Invalid type. Use ?type=applications or ?type=users" }, { status: 400 })
  } catch (err) {
    console.error("[admin/export] export failed", { type }, err)
    return NextResponse.json({ ok: false, error: "Export failed" }, { status: 500 })
  }
}
