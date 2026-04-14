"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useReducer, useState } from "react"
import {
  BarChart, Bar, ComposedChart, Line, LineChart, Legend,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import {
  TrendingUp, Users, FileText, Home, Loader2, Bot,
  UserPlus, X, ChevronLeft, ChevronRight, Activity,
  MousePointerClick,
} from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { AnalyticsData, DrillDownColumn, DrillDownResult } from "@/lib/db/admin-analytics"

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "3 months",  value: 3 },
  { label: "6 months",  value: 6 },
  { label: "12 months", value: 12 },
]

const STATUS_LABELS: Record<string, string> = {
  draft:          "Draft",
  submitted:      "Submitted",
  ai_extracted:   "AI Extracted",
  needs_review:   "Needs Review",
  rfi_requested:  "RFI Requested",
  approved:       "Approved",
  denied:         "Denied",
}

const STATUS_COLORS: Record<string, string> = {
  draft:          "#94a3b8",
  submitted:      "#3b82f6",
  ai_extracted:   "#8b5cf6",
  needs_review:   "#f59e0b",
  rfi_requested:  "#f97316",
  approved:       "#22c55e",
  denied:         "#ef4444",
}

const PROGRAM_COLORS = [
  "#3b82f6","#8b5cf6","#22c55e","#f59e0b",
  "#ef4444","#06b6d4","#f97316","#ec4899","#14b8a6","#a855f7",
]

const MODULE_COLORS: Record<string, string> = {
  "Applications":    "#3b82f6",
  "Benefit Stack":   "#8b5cf6",
  "Pre-Screener":    "#22c55e",
  "AI Chat":         "#06b6d4",
  "SW Messaging":    "#f59e0b",
  "Collab Sessions": "#f97316",
  "Identity Verify": "#ec4899",
  "Documents":       "#14b8a6",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(ym: string): string {
  const [y, m] = ym.split("-")
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("default", { month: "short", year: "2-digit" })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)   return "just now"
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Shared reducer factory ────────────────────────────────────────────────────

type AsyncState<T> =
  | { status: "loading"; data: T | null }
  | { status: "success"; data: T }
  | { status: "error";   data: null }

type AsyncAction<T> =
  | { type: "fetch" }
  | { type: "success"; data: T }
  | { type: "error" }

function asyncReducer<T>(state: AsyncState<T>, action: AsyncAction<T>): AsyncState<T> {
  switch (action.type) {
    case "fetch":   return { status: "loading", data: state.data }
    case "success": return { status: "success", data: action.data }
    case "error":   return { status: "error",   data: null }
  }
}

// ── Drill-down spec ───────────────────────────────────────────────────────────

type DrillDownSpec = {
  type: string      // "apps-month" | "apps-status" | "users-month" | "ai-month"
  value: string
  title: string
} | null

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState(12)
  const [drillDown, setDrillDown] = useState<DrillDownSpec>(null)
  const [state, dispatch] = useReducer(
    asyncReducer as (s: AsyncState<AnalyticsData>, a: AsyncAction<AnalyticsData>) => AsyncState<AnalyticsData>,
    { status: "loading", data: null },
  )

  useEffect(() => {
    let cancelled = false
    dispatch({ type: "fetch" })
    authenticatedFetch(`/api/admin/analytics?months=${period}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return
        if (res.ok) dispatch({ type: "success", data: res.data })
        else dispatch({ type: "error" })
      })
      .catch(() => { if (!cancelled) dispatch({ type: "error" }) })
    return () => { cancelled = true }
  }, [period])

  const { status, data } = state
  const loading = status === "loading"

  const open = (spec: NonNullable<DrillDownSpec>) => setDrillDown(spec)

  return (
    <div className="max-w-6xl mx-auto pb-12">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
            <MousePointerClick className="w-3.5 h-3.5" />
            Click any chart to explore the underlying records
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === opt.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-6">
          Failed to load analytics data. Please try again.
        </div>
      )}

      {/* ══════════════════════════ APPLICATIONS ════════════════════════════ */}
      <SectionHeader title="Application Statistics" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Applications" value={data?.totalApplications}
          icon={<FileText className="w-5 h-5 text-blue-500" />} bg="bg-blue-50" loading={loading} />
        <KpiCard label="Filed This Month"   value={data?.submittedThisMonth}
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} bg="bg-emerald-50" loading={loading} />
        <KpiCard label="Total Applicants"   value={data?.totalApplicants}
          icon={<Users className="w-5 h-5 text-purple-500" />} bg="bg-purple-50" loading={loading} />
        <KpiCard label="Avg Household Size" value={data?.avgHouseholdSize}
          icon={<Home className="w-5 h-5 text-amber-500" />} bg="bg-amber-50" loading={loading} decimals={1} />
      </div>

      {loading ? <ChartSkeleton rows={3} /> : data && (
        <>
          {/* Trends overview — multi-line */}
          <TrendOverviewChart data={data} period={period} />

          {/* Applications filed by month */}
          <ChartCard title="Applications Filed by Month" subtitle={`Last ${period} months — click a bar to see those applications`} className="mb-6">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={data.applicationsByMonth.map((d) => ({ rawMonth: d.month, month: fmt(d.month), count: d.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(v: number) => [v, "Applications"]} />
                <Bar dataKey="count" fill="#93c5fd" radius={[4,4,0,0]} cursor="pointer"
                  onClick={(d: { rawMonth: string; month: string }) =>
                    open({ type: "apps-month", value: d.rawMonth, title: `Applications filed in ${d.month}` })}
                />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2}
                  dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
                  activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Status + Program */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ChartCard title="Status Breakdown" subtitle="Click a bar to see those applications">
              {data.applicationsByStatus.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart layout="vertical"
                    data={data.applicationsByStatus.map((d) => ({ ...d, label: STATUS_LABELS[d.status] ?? d.status }))}
                    margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={96} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={(v: number) => [v, "Applications"]} />
                    <Bar dataKey="count" radius={[0,4,4,0]} cursor="pointer"
                      onClick={(d: { status: string; label: string }) =>
                        open({ type: "apps-status", value: d.status, title: `${d.label} Applications` })}>
                      {data.applicationsByStatus.map((e) => (
                        <Cell key={e.status} fill={STATUS_COLORS[e.status] ?? "#3b82f6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Program Distribution" subtitle="From eligibility screenings">
              {data.applicationsByProgram.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart layout="vertical" data={data.applicationsByProgram} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="program" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={(v: number) => [v, "Screenings"]} />
                    <Bar dataKey="count" radius={[0,4,4,0]}>
                      {data.applicationsByProgram.map((e, i) => (
                        <Cell key={e.program} fill={PROGRAM_COLORS[i % PROGRAM_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ══════════════════════ USER & PLATFORM ACTIVITY ══════════════════ */}
          <SectionHeader title="User & Platform Activity" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label="Total Users"      value={data.totalUsers}        icon={<Users className="w-5 h-5 text-indigo-500" />}  bg="bg-indigo-50" loading={loading} />
            <KpiCard label="New This Month"   value={data.newUsersThisMonth} icon={<UserPlus className="w-5 h-5 text-teal-500" />} bg="bg-teal-50"   loading={loading} />
            <KpiCard label="Total AI Requests" value={data.totalAiRequests}  icon={<Bot className="w-5 h-5 text-cyan-500" />}      bg="bg-cyan-50"   loading={loading} />
            <KpiCard label="AI This Month"    value={data.aiRequestsThisMonth} icon={<Activity className="w-5 h-5 text-rose-500" />} bg="bg-rose-50" loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ChartCard title="User Registrations" subtitle={`Last ${period} months — click a bar to see new users`}>
              {data.userRegistrationsByMonth.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={data.userRegistrationsByMonth.map((d) => ({ rawMonth: d.month, month: fmt(d.month), count: d.count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={(v: number) => [v, "New users"]} />
                    <Bar dataKey="count" fill="#c4b5fd" radius={[4,4,0,0]} cursor="pointer"
                      onClick={(d: { rawMonth: string; month: string }) =>
                        open({ type: "users-month", value: d.rawMonth, title: `Users registered in ${d.month}` })}
                    />
                    <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2}
                      dot={{ r: 3, fill: "#7c3aed", strokeWidth: 0 }}
                      activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Feature Usage" subtitle={`Last ${period} months — interactions per module`}>
              {data.moduleUsage.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart layout="vertical" data={data.moduleUsage} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="module" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={112} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={(v: number) => [v, "Interactions"]} />
                    <Bar dataKey="count" radius={[0,4,4,0]}>
                      {data.moduleUsage.map((e) => (
                        <Cell key={e.module} fill={MODULE_COLORS[e.module] ?? "#3b82f6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ══════════════════════ AI REQUESTS & ACTIVITY ════════════════════ */}
          <SectionHeader title="AI Requests & Recent Activity" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ChartCard title="Ollama / AI Chat Requests" subtitle={`Last ${period} months — click a bar for details`}>
              {data.aiChatByMonth.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-sm text-gray-400 gap-1">
                  <Bot className="w-6 h-6 opacity-30" />
                  No AI requests logged yet
                  <span className="text-xs">Apply <code className="bg-gray-100 px-1 rounded">database/chat_logs_schema.sql</code></span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={data.aiChatByMonth.map((d) => ({ rawMonth: d.month, month: fmt(d.month), count: d.count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={(v: number) => [v, "Requests"]} />
                    <Bar dataKey="count" fill="#a5f3fc" radius={[4,4,0,0]} cursor="pointer"
                      onClick={(d: { rawMonth: string; month: string }) =>
                        open({ type: "ai-month", value: d.rawMonth, title: `AI requests in ${d.month}` })}
                    />
                    <Line type="monotone" dataKey="count" stroke="#0891b2" strokeWidth={2}
                      dot={{ r: 3, fill: "#0891b2", strokeWidth: 0 }}
                      activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Recent activity feed */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
                <p className="text-xs text-gray-400 mt-0.5">Latest audit log events</p>
              </div>
              {data.recentActivity.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-gray-400">No activity logged yet</div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {data.recentActivity.map((e, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-gray-700">{e.action}</span>
                        {e.user_email && (
                          <span className="text-xs text-gray-400 ml-1 truncate">· {e.user_email}</span>
                        )}
                        {e.application_id && (
                          <span className="text-xs text-gray-300 ml-1">· #{e.application_id.slice(0,8)}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-300 flex-shrink-0">{timeAgo(e.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ════════════════════════ DEMOGRAPHICS ═══════════════════════════ */}
          <SectionHeader title="Demographics" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Income as % of FPL" subtitle="From eligibility screenings">
              {data.fplDistribution.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.fplDistribution} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={(v: number) => [v, "Applicants"]} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Household Size" subtitle="Distribution across applications">
              {data.householdSizeDistribution.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={data.householdSizeDistribution.map((d) => ({ ...d, label: d.size >= 8 ? "8+" : String(d.size) }))}
                    margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={(v: number) => [v, "Applications"]} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}

      {/* ── Drill-down panel ── */}
      <DrillDownPanel
        key={drillDown ? `${drillDown.type}:${drillDown.value}` : "closed"}
        drill={drillDown}
        onClose={() => setDrillDown(null)}
      />
    </div>
  )
}

// ── Drill-down panel ──────────────────────────────────────────────────────────

function DrillDownPanel({ drill, onClose }: { drill: DrillDownSpec; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const [state, dispatch] = useReducer(
    asyncReducer as (s: AsyncState<DrillDownResult>, a: AsyncAction<DrillDownResult>) => AsyncState<DrillDownResult>,
    { status: "loading", data: null },
  )

  useEffect(() => {
    if (!drill) return
    let cancelled = false
    dispatch({ type: "fetch" })
    const qs = new URLSearchParams({
      type: drill.type, value: drill.value, page: String(page), limit: "20",
    })
    authenticatedFetch(`/api/admin/analytics/drill-down?${qs}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return
        if (res.ok) dispatch({ type: "success", data: res.result })
        else dispatch({ type: "error" })
      })
      .catch(() => { if (!cancelled) dispatch({ type: "error" }) })
    return () => { cancelled = true }
  }, [drill, page])

  if (!drill) return null

  const { status, data } = state
  const total      = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">{drill.title}</h2>
            {data && (
              <p className="text-xs text-gray-400 mt-0.5">{total.toLocaleString()} record{total !== 1 ? "s" : ""}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {status === "loading" && (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          )}
          {status === "error" && (
            <div className="p-6 text-sm text-red-600">Failed to load records.</div>
          )}
          {status === "success" && data && (
            data.rows.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">No records found</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    {data.columns.map((col) => (
                      <th key={col.key} className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      {data.columns.map((col) => (
                        <td key={col.key} className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate">
                          <CellValue value={row[col.key]} col={col} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 flex-shrink-0 bg-white">
            <span className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Cell renderer ─────────────────────────────────────────────────────────────

function CellValue({ value, col }: { value: unknown; col: DrillDownColumn }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-gray-300">—</span>
  }

  switch (col.format) {
    case "date":
      return (
        <span>{new Date(value as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
      )
    case "badge":
      return <StatusBadge status={value as string} />
    case "percent":
      return <span>{Number(value).toFixed(1)}%</span>
    case "money":
      return <span>${Number(value).toLocaleString()}</span>
    default:
      return <span>{String(value)}</span>
  }
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    draft:          "bg-gray-100 text-gray-600",
    submitted:      "bg-blue-100 text-blue-700",
    ai_extracted:   "bg-purple-100 text-purple-700",
    needs_review:   "bg-amber-100 text-amber-700",
    rfi_requested:  "bg-orange-100 text-orange-700",
    approved:       "bg-green-100 text-green-700",
    denied:         "bg-red-100 text-red-700",
  }
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${palette[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── Trends overview (multi-line) ─────────────────────────────────────────────

function TrendOverviewChart({ data, period }: { data: AnalyticsData; period: number }) {
  // Merge all months from the three series into a single sorted list
  const months = Array.from(
    new Set([
      ...data.applicationsByMonth.map((d) => d.month),
      ...data.userRegistrationsByMonth.map((d) => d.month),
      ...data.aiChatByMonth.map((d) => d.month),
    ]),
  ).sort()

  const chartData = months.map((m) => ({
    month: fmt(m),
    Applications: data.applicationsByMonth.find((d) => d.month === m)?.count ?? 0,
    Users:        data.userRegistrationsByMonth.find((d) => d.month === m)?.count ?? 0,
    "AI Requests": data.aiChatByMonth.find((d) => d.month === m)?.count ?? 0,
  }))

  return (
    <ChartCard
      title="Trends Overview"
      subtitle={`Last ${period} months — applications, user signups, and AI requests`}
      className="mb-6"
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
          <Line type="monotone" dataKey="Applications" stroke="#2563eb" strokeWidth={2}
            dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="Users" stroke="#7c3aed" strokeWidth={2}
            dot={{ r: 3, fill: "#7c3aed", strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="AI Requests" stroke="#0891b2" strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 3, fill: "#0891b2", strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-2">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{title}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  )
}

function ChartCard({ title, subtitle, children, className = "" }: {
  title: string; subtitle: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function KpiCard({ label, value, icon, bg, loading, decimals = 0 }: {
  label: string; value: number | undefined; icon: React.ReactNode
  bg: string; loading: boolean; decimals?: number
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`${bg} p-2.5 rounded-lg flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900">
          {loading || value === undefined ? "—" : value.toFixed(decimals)}
        </div>
        <div className="text-xs text-gray-500 truncate">{label}</div>
      </div>
    </div>
  )
}

function EmptyChart() {
  return <div className="h-48 flex items-center justify-center text-sm text-gray-400">No data yet</div>
}

function ChartSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-48 animate-pulse">
          <div className="h-3 bg-gray-100 rounded w-1/3 mb-2" />
          <div className="h-2 bg-gray-50 rounded w-1/4 mb-6" />
          <div className="flex items-end gap-2 h-20">
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${30 + (j * 7) % 60}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
