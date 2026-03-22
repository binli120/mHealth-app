/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { getDbPool } from "@/lib/db/server"

export const runtime = "nodejs"

interface NppesOrg {
  number: string
  basic?: {
    organization_name?: string
    name?: string
    address?: string
    city?: string
    state?: string
    postal_code?: string
    phone_number?: string
  }
  addresses?: Array<{
    address_1?: string
    city?: string
    state?: string
    postal_code?: string
    telephone_number?: string
    address_purpose?: string
  }>
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()

  if (q.length < 2) {
    return NextResponse.json({ ok: true, results: [] })
  }

  const [nppesResults, localResults] = await Promise.allSettled([
    fetchNppes(q),
    fetchLocalCompanies(q),
  ])

  const nppes = nppesResults.status === "fulfilled" ? nppesResults.value : []
  const local = localResults.status === "fulfilled" ? localResults.value : []
  const nppesError =
    nppesResults.status === "rejected"
      ? String(nppesResults.reason)
      : null

  // Merge: local approved first, then NPPES
  const merged = [...local, ...nppes]

  return NextResponse.json({ ok: true, results: merged, nppesError })
}

async function fetchNppes(q: string) {
  // NPPES requires a trailing * for partial/prefix matching
  const searchTerm = q.endsWith("*") ? q : `${q}*`

  const url = new URL("https://npiregistry.cms.hhs.gov/api/")
  url.searchParams.set("version", "2.1")
  url.searchParams.set("organization_name", searchTerm)
  url.searchParams.set("enumeration_type", "NPI-2")
  url.searchParams.set("limit", "15")

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return []

  const data = (await res.json()) as { results?: NppesOrg[]; result_count?: number }
  return (data.results ?? []).map((org) => {
    const practice =
      org.addresses?.find((a) => a.address_purpose === "LOCATION") ??
      org.addresses?.[0]

    return {
      id: null as string | null,
      source: "nppes" as const,
      name: org.basic?.organization_name ?? org.basic?.name ?? "",
      npi: org.number ?? null,
      address: practice?.address_1 ?? null,
      city: practice?.city ?? null,
      state: practice?.state ?? null,
      zip: practice?.postal_code ?? null,
      phone: practice?.telephone_number ?? null,
      email_domain: null as string | null,
    }
  }).filter((r) => r.name)
}

async function fetchLocalCompanies(q: string) {
  const pool = getDbPool()
  const result = await pool.query(
    `
      SELECT id, name, npi, address, city, state, zip, phone, email_domain
      FROM public.companies
      WHERE status = 'approved'
        AND name ILIKE $1
      ORDER BY name
      LIMIT 10
    `,
    [`%${q}%`],
  )

  return result.rows.map((row) => ({
    ...row,
    source: "local" as const,
  }))
}
