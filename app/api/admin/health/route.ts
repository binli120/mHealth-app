/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { getDbPool } from "@/lib/db/server"

export const runtime = "nodejs"

type ServiceStatus = "live" | "degraded" | "down"

interface ServiceCheck {
  name: string
  status: ServiceStatus
  latencyMs: number | null
  detail: string | null
  script: string
}

function getAnalysisBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "")
}

function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "")
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function runHealthScript(
  name: string,
  script: string,
  check: () => Promise<Omit<ServiceCheck, "name" | "script">>,
): Promise<ServiceCheck> {
  try {
    const result = await check()
    return { name, script, ...result }
  } catch (error) {
    return {
      name,
      script,
      status: "down",
      latencyMs: null,
      detail: describeError(error),
    }
  }
}

async function checkAppRuntime(): Promise<ServiceCheck> {
  const start = Date.now()
  return runHealthScript(
    "HealthCompass App",
    "Next.js runtime smoke check",
    async () => ({
      status: "live",
      latencyMs: Date.now() - start,
      detail: `Runtime: ${process.env.NODE_ENV ?? "unknown"} · uptime ${Math.round(process.uptime())}s`,
    }),
  )
}

async function checkSupabase(): Promise<ServiceCheck> {
  return runHealthScript("Supabase (PostgreSQL)", "SELECT current_database(), current_user", async () => {
    const start = Date.now()
    const pool = getDbPool()
    const result = await pool.query<{ db: string; usr: string }>(
      "SELECT current_database() AS db, current_user AS usr",
    )
    const row = result.rows[0]
    return {
      status: "live",
      latencyMs: Date.now() - start,
      detail: row ? `DB: ${row.db} · user: ${row.usr}` : "Connected",
    }
  })
}

async function checkOllama(): Promise<ServiceCheck> {
  return runHealthScript("Ollama (AI Chat)", "GET /api/tags", async () => {
    const base = getOllamaBaseUrl()
    const start = Date.now()
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) })
    const latencyMs = Date.now() - start
    if (!res.ok) {
      return { status: "degraded", latencyMs, detail: `${base}/api/tags returned HTTP ${res.status}` }
    }
    const data = await res.json()
    const models: string[] = (data.models ?? []).map((m: { name: string }) => m.name)
    const detail = models.length > 0 ? `Models: ${models.slice(0, 3).join(", ")}` : "No models loaded"
    const status: ServiceStatus = models.length > 0 ? "live" : "degraded"
    return { status, latencyMs, detail }
  })
}

async function checkAnalysisService(): Promise<ServiceCheck> {
  return runHealthScript("MassHealth Analysis API", "GET /health", async () => {
    const base = getAnalysisBaseUrl()
    const start = Date.now()
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) })
    const latencyMs = Date.now() - start
    const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null

    if (!res.ok) {
      return {
        status: "down",
        latencyMs,
        detail: `${base}/health returned HTTP ${res.status}`,
      }
    }

    const detail =
      payload && Object.keys(payload).length > 0
        ? JSON.stringify(payload).slice(0, 180)
        : `${base}/health responded OK`

    return { status: "live", latencyMs, detail }
  })
}

async function checkResend(): Promise<ServiceCheck> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return {
      name: "Resend (Email)",
      status: "degraded",
      latencyMs: null,
      detail: "RESEND_API_KEY not configured",
      script: "GET /domains",
    }
  }
  return runHealthScript("Resend (Email)", "GET /domains", async () => {
    const start = Date.now()
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
    const latencyMs = Date.now() - start
    if (res.status === 401) {
      return { status: "down", latencyMs, detail: "Invalid API key" }
    }
    if (!res.ok) {
      return { status: "degraded", latencyMs, detail: `HTTP ${res.status}` }
    }
    return { status: "live", latencyMs, detail: null }
  })
}

async function checkNPPES(): Promise<ServiceCheck> {
  return runHealthScript("NPPES NPI Registry", "GET CMS NPI registry sample", async () => {
    const start = Date.now()
    const res = await fetch(
      "https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1003000126&limit=1",
      { signal: AbortSignal.timeout(8000) }
    )
    const latencyMs = Date.now() - start
    if (!res.ok) {
      return { status: "degraded", latencyMs, detail: `HTTP ${res.status}` }
    }
    return { status: "live", latencyMs, detail: null }
  })
}

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const results = await Promise.allSettled([
    checkAppRuntime(),
    checkAnalysisService(),
    checkSupabase(),
    checkOllama(),
    checkResend(),
    checkNPPES(),
  ])

  const services: ServiceCheck[] = results.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : {
          name: "Unknown",
          script: "Unknown probe",
          status: "down",
          latencyMs: null,
          detail: describeError(result.reason),
        }
  )

  const overallStatus: ServiceStatus =
    services.some((s) => s.status === "down")
      ? "down"
      : services.some((s) => s.status === "degraded")
      ? "degraded"
      : "live"

  return NextResponse.json({ ok: true, overallStatus, services, checkedAt: new Date().toISOString() })
}
