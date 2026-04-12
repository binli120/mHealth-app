"use client"

/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { useEffect, useState, useCallback } from "react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Database,
  Bot,
  Mail,
  Building2,
  Activity,
  FileSearch,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

type ServiceStatus = "live" | "degraded" | "down"

interface ServiceCheck {
  name: string
  status: ServiceStatus
  latencyMs: number | null
  detail: string | null
  script: string
}

interface HealthData {
  overallStatus: ServiceStatus
  services: ServiceCheck[]
  checkedAt: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<ServiceStatus, { label: string; icon: React.ReactNode; card: string; badge: string }> = {
  live: {
    label: "Operational",
    icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    card: "border-green-200 bg-green-50",
    badge: "bg-green-100 text-green-700",
  },
  degraded: {
    label: "Degraded",
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    card: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
  },
  down: {
    label: "Down",
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    card: "border-red-200 bg-red-50",
    badge: "bg-red-100 text-red-700",
  },
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  "HealthCompass App": <Activity className="w-5 h-5 text-gray-500" />,
  "MassHealth Analysis API": <FileSearch className="w-5 h-5 text-gray-500" />,
  "Supabase (PostgreSQL)": <Database className="w-5 h-5 text-gray-500" />,
  "Ollama (AI Chat)":      <Bot className="w-5 h-5 text-gray-500" />,
  "Resend (Email)":        <Mail className="w-5 h-5 text-gray-500" />,
  "NPPES NPI Registry":   <Building2 className="w-5 h-5 text-gray-500" />,
}

const OVERALL_BANNER: Record<ServiceStatus, { bg: string; text: string; label: string }> = {
  live:     { bg: "bg-green-600",  text: "text-white", label: "All Systems Operational" },
  degraded: { bg: "bg-amber-500",  text: "text-white", label: "Partial Outage Detected" },
  down:     { bg: "bg-red-600",    text: "text-white", label: "Major Outage Detected" },
}

function LatencyBadge({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-xs text-gray-400">—</span>
  const color = ms < 200 ? "text-green-600" : ms < 800 ? "text-amber-600" : "text-red-600"
  return (
    <span className={`flex items-center gap-1 text-xs font-mono ${color}`}>
      <Clock className="w-3 h-3" />
      {ms} ms
    </span>
  )
}

function ServiceCard({ svc }: { svc: ServiceCheck }) {
  const meta = STATUS_META[svc.status]
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${meta.card}`}>
      <div className="mt-0.5">{SERVICE_ICONS[svc.name] ?? <CheckCircle2 className="w-5 h-5 text-gray-400" />}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{svc.name}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
            {meta.label}
          </span>
          <LatencyBadge ms={svc.latencyMs} />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Probe: <span className="font-mono">{svc.script}</span>
        </p>
        {svc.detail && (
          <p className="text-xs text-gray-600 mt-1 font-mono break-all">{svc.detail}</p>
        )}
      </div>
      <div className="flex-shrink-0">{meta.icon}</div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await authenticatedFetch("/api/admin/health")
      const data = await res.json()
      if (data.ok) {
        setHealth(data)
        setLastRefreshed(new Date())
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => load(true), 60_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Running health checks…
      </div>
    )
  }

  if (!health) {
    return (
      <div className="flex items-center justify-center h-48 text-red-500 text-sm">
        Failed to load health data.
      </div>
    )
  }

  const banner = OVERALL_BANNER[health.overallStatus]
  const checkedAt = new Date(health.checkedAt).toLocaleTimeString()

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Runs bounded probes for the app runtime, analysis API, Ollama, Supabase, and integrations. Auto-refreshes every 60s.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Overall status banner */}
      <div className={`${banner.bg} ${banner.text} rounded-xl px-5 py-4 mb-6 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {health.overallStatus === "live"
            ? <CheckCircle2 className="w-6 h-6" />
            : health.overallStatus === "degraded"
            ? <AlertTriangle className="w-6 h-6" />
            : <XCircle className="w-6 h-6" />}
          <span className="font-semibold text-lg">{banner.label}</span>
        </div>
        <div className="text-sm opacity-80 flex flex-col items-end">
          <span>Checked at {checkedAt}</span>
          {lastRefreshed && (
            <span className="text-xs opacity-70">
              Last refreshed {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Service cards */}
      <div className="space-y-3">
        {health.services.map((svc) => (
          <ServiceCard key={svc.name} svc={svc} />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6 text-xs text-gray-400 border-t border-gray-100 pt-4">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Operational</span>
        <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Degraded</span>
        <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-500" /> Down</span>
        <span className="flex items-center gap-1 ml-auto"><Clock className="w-3.5 h-3.5" /> Latency shown per check</span>
      </div>
    </div>
  )
}
