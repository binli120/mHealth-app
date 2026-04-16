/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import {
  listCompanies,
  createCompany,
  updateCompanyStatus,
  updateCompanyEmailDomain,
} from "@/lib/db/admin"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? undefined
  const status = searchParams.get("status") ?? undefined
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100)
  const offset = parseInt(searchParams.get("offset") ?? "0", 10)

  const data = await listCompanies({ search, status, limit, offset })
  return NextResponse.json({ ok: true, ...data })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    npi?: string
    address?: string
    city?: string
    state?: string
    zip?: string
    phone?: string
    email_domain?: string
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "Company name is required" }, { status: 400 })
  }

  const company = await createCompany({
    name: body.name.trim(),
    npi: body.npi,
    address: body.address,
    city: body.city,
    state: body.state,
    zip: body.zip,
    phone: body.phone,
    email_domain: body.email_domain,
  })

  return NextResponse.json({ ok: true, company }, { status: 201 })
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const body = (await request.json().catch(() => ({}))) as {
    companyId?: string
    action?: "approve" | "reject" | "set_email_domain"
    emailDomain?: string
  }

  if (!body.companyId || !body.action) {
    return NextResponse.json({ ok: false, error: "companyId and action required" }, { status: 400 })
  }

  if (body.action === "approve" || body.action === "reject") {
    await updateCompanyStatus(body.companyId, body.action === "approve" ? "approved" : "rejected", authResult.userId)
    return NextResponse.json({ ok: true })
  }

  if (body.action === "set_email_domain") {
    if (!body.emailDomain) {
      return NextResponse.json({ ok: false, error: "emailDomain required" }, { status: 400 })
    }
    await updateCompanyEmailDomain(body.companyId, body.emailDomain)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 })
}
