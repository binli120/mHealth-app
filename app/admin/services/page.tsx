"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Server,
} from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  AdminPageHeader,
  AdminPageShell,
  AdminPanel,
  AdminPanelContent,
  AdminPanelHeader,
  AdminPanelTitle,
} from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type Health = "up" | "warn" | "down" | "missing" | "unknown"

interface ServiceStatus {
  name: string
  label: string
  running: boolean
  health: Health
  uptime: string | null
  restarts: number | null
  httpStatus: number | null
  modelCount?: number
  http?: number | null
  tlsPortOpen?: boolean
  healthz?: string
}

interface StatusResponse {
  ok: boolean
  timestamp: string
  summary: "healthy" | "warn" | "degraded"
  services: ServiceStatus[]
  error?: string
}

// ── Fetch helper (plain async fn — no hooks, no synchronous setState) ─────────

async function loadServices(): Promise<StatusResponse> {
  const res  = await authenticatedFetch("/api/admin/services")
  const json = (await res.json()) as StatusResponse
  if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to fetch service status")
  return json
}

// ── Health indicator ──────────────────────────────────────────────────────────

function HealthIcon({ health }: { health: Health }) {
  if (health === "up")      return <CheckCircle2  className="size-5 text-green-500" />
  if (health === "warn")    return <AlertTriangle className="size-5 text-yellow-500" />
  if (health === "down")    return <XCircle       className="size-5 text-red-500" />
  if (health === "missing") return <XCircle       className="size-5 text-red-400" />
  return <HelpCircle className="size-5 text-muted-foreground" />
}

function HealthBadge({ health }: { health: Health }) {
  const variants: Record<Health, string> = {
    up:      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    warn:    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    down:    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    missing: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    unknown: "bg-muted text-muted-foreground",
  }
  const labels: Record<Health, string> = {
    up: "OK", warn: "WARN", down: "DOWN", missing: "MISSING", unknown: "?",
  }
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
      variants[health],
    )}>
      {labels[health]}
    </span>
  )
}

// ── Per-service detail line ───────────────────────────────────────────────────

function ServiceDetail({ svc }: { svc: ServiceStatus }) {
  const parts: string[] = []
  if (svc.uptime) parts.push(svc.uptime)

  if (svc.name === "healthcompass-proxy") {
    if (svc.http)                        parts.push(`HTTP → ${svc.http}`)
    if (svc.tlsPortOpen !== undefined)   parts.push(`TLS :443 ${svc.tlsPortOpen ? "open" : "closed"}`)
  } else if (svc.httpStatus != null) {
    parts.push(`HTTP ${svc.httpStatus}`)
  }

  if (svc.name === "healthcompass-ollama" && svc.modelCount !== undefined) {
    parts.push(`${svc.modelCount} model${svc.modelCount === 1 ? "" : "s"}`)
  }

  if (svc.healthz)                                         parts.push(svc.healthz)
  if (svc.restarts != null && svc.restarts > 0)            parts.push(`restarts: ${svc.restarts}`)
  if (parts.length === 0) return null

  return <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span>
}

// ── Summary banner ────────────────────────────────────────────────────────────

function SummaryBanner({ summary }: { summary: StatusResponse["summary"] }) {
  if (summary === "healthy") return (
    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
      <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
      <span className="text-sm font-medium text-green-800 dark:text-green-300">All services healthy</span>
    </div>
  )
  if (summary === "warn") return (
    <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-900/20">
      <AlertTriangle className="size-5 text-yellow-600 dark:text-yellow-400" />
      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Some services need attention</span>
    </div>
  )
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
      <XCircle className="size-5 text-red-600 dark:text-red-400" />
      <span className="text-sm font-medium text-red-800 dark:text-red-300">One or more services are down</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [data, setData]               = useState<StatusResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Initial load — setState only inside .then()/.catch()/.finally(), never synchronously
  useEffect(() => {
    loadServices()
      .then((json) => { setData(json); setLastChecked(new Date()) })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not reach health check endpoint"))
      .finally(() => setLoading(false))
  }, [])

  // Auto-refresh every 30 s
  useEffect(() => {
    const id = setInterval(() => {
      setRefreshing(true)
      loadServices()
        .then((json) => { setData(json); setLastChecked(new Date()); setError(null) })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not reach health check endpoint"))
        .finally(() => setRefreshing(false))
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadServices()
      .then((json) => { setData(json); setLastChecked(new Date()); setError(null) })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not reach health check endpoint"))
      .finally(() => setRefreshing(false))
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Services"
        description="Live health status of all HealthCompass infrastructure"
      />

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {lastChecked && (
          <p className="text-xs text-muted-foreground">
            Last checked: {lastChecked.toLocaleTimeString()} · auto-refreshes every 30 s
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="ml-auto gap-1.5"
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary banner */}
      {data && <SummaryBanner summary={data.summary} />}

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
          <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              Make sure the healthcheck sidecar container is running.
            </p>
          </div>
        </div>
      )}

      {/* Services table */}
      <AdminPanel>
        <AdminPanelHeader>
          <AdminPanelTitle>Container Health</AdminPanelTitle>
        </AdminPanelHeader>
        <AdminPanelContent className="p-0">
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" />
              Checking services…
            </div>
          ) : (
            <div className="divide-y">
              {(data?.services ?? []).map((svc) => (
                <div key={svc.name} className="flex items-center gap-4 px-6 py-4">
                  <HealthIcon health={svc.health} />

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{svc.label}</span>
                      <HealthBadge health={svc.health} />
                    </div>
                    <ServiceDetail svc={svc} />
                  </div>

                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {svc.name}
                  </span>
                </div>
              ))}

              {data?.services.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Server className="size-4" />
                  No services found
                </div>
              )}
            </div>
          )}
        </AdminPanelContent>
      </AdminPanel>

      {data?.timestamp && (
        <p className="text-right text-xs text-muted-foreground">
          Sidecar timestamp: {new Date(data.timestamp).toLocaleString()}
        </p>
      )}
    </AdminPageShell>
  )
}
