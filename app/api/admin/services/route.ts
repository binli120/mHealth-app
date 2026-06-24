import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"

export const runtime = "nodejs"
// No caching — always fetch live status
export const revalidate = 0

const SIDECAR_URL = process.env.HEALTHCHECK_SIDECAR_URL ?? "http://healthcheck:4000"

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  try {
    const res = await fetch(`${SIDECAR_URL}/status`, {
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `sidecar returned ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: "healthcheck sidecar unreachable", detail: message },
      { status: 503 },
    )
  }
}
