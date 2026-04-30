"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Admin PHI Audit Log viewer - /admin/phi-audit
 *
 * Displays paginated PHI access events recorded in audit_logs. Access is
 * restricted to admins via the requireAdmin guard on the backing API route.
 */

import { useCallback, useEffect, useMemo, useReducer } from "react"
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react"

import {
  AdminPageShell,
  AdminTablePanel,
} from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { PhiAuditEntry } from "@/lib/db/phi-audit"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

type EventFilter = "all" | "reads" | "writes"

type PageState = {
  status: "loading" | "ready" | "error"
  entries: PhiAuditEntry[]
  total: number
  offset: number
  userFilter: string
  filterDraft: string
  eventFilter: EventFilter
}

type PageAction =
  | { type: "fetch_start" }
  | { type: "fetch_ok"; entries: PhiAuditEntry[]; total: number }
  | { type: "fetch_err" }
  | { type: "set_filter_draft"; value: string }
  | { type: "apply_filter"; value: string }
  | { type: "set_event_filter"; value: EventFilter }
  | { type: "set_offset"; offset: number }

function initState(): PageState {
  return {
    status: "loading",
    entries: [],
    total: 0,
    offset: 0,
    userFilter: "",
    filterDraft: "",
    eventFilter: "all",
  }
}

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, status: "loading" }
    case "fetch_ok":
      return { ...state, status: "ready", entries: action.entries, total: action.total }
    case "fetch_err":
      return { ...state, status: "error" }
    case "set_filter_draft":
      return { ...state, filterDraft: action.value }
    case "apply_filter":
      return { ...state, userFilter: action.value, filterDraft: action.value, offset: 0 }
    case "set_event_filter":
      return { ...state, eventFilter: action.value }
    case "set_offset":
      return { ...state, offset: action.offset }
  }
}

const ACTION_LABELS: Record<string, string> = {
  "phi.ssn.written": "SSN Written",
  "phi.ssn.decrypted": "SSN Read",
  "phi.bank_account.written": "Bank Account Written",
  "phi.bank_account.decrypted": "Bank Account Read",
}

const ACTION_STYLES: Record<string, { badge: string; dot: string }> = {
  "phi.ssn.written": {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  "phi.ssn.decrypted": {
    badge: "border-blue-200 bg-blue-50 text-blue-800",
    dot: "bg-blue-500",
  },
  "phi.bank_account.written": {
    badge: "border-purple-200 bg-purple-50 text-purple-800",
    dot: "bg-purple-500",
  },
  "phi.bank_account.decrypted": {
    badge: "border-indigo-200 bg-indigo-50 text-indigo-800",
    dot: "bg-indigo-500",
  },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function isToday(iso: string): boolean {
  const value = new Date(iso)
  const now = new Date()
  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  )
}

function eventMatchesFilter(entry: PhiAuditEntry, filter: EventFilter): boolean {
  if (filter === "all") return true
  if (filter === "reads") return entry.action.includes("decrypted")
  return entry.action.includes("written")
}

function userInitials(userId: string): string {
  const trimmed = userId.replace(/[^a-z0-9]/gi, "").toUpperCase()
  return trimmed.slice(0, 2) || "U"
}

function maskUserId(userId: string): string {
  if (userId.length <= 14) return userId
  return `${userId.slice(0, 8)}...${userId.slice(-4)}`
}

function exportEntries(entries: PhiAuditEntry[]) {
  const header = ["timestamp", "event", "user_id", "ip_address", "purpose", "metadata"]
  const rows = entries.map((entry) => [
    entry.createdAt,
    ACTION_LABELS[entry.action] ?? entry.action,
    entry.userId,
    entry.ipAddress ?? "",
    String(entry.metadata.purpose ?? ""),
    JSON.stringify(
      Object.fromEntries(Object.entries(entry.metadata).filter(([key]) => key !== "purpose")),
    ),
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `phi-audit-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function PhiAuditPage() {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  const load = useCallback(async (offset: number, userId: string) => {
    dispatch({ type: "fetch_start" })
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (userId.trim()) params.set("userId", userId.trim())

      const res = await authenticatedFetch(`/api/admin/phi-audit?${params}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as { entries: PhiAuditEntry[]; total: number }
      dispatch({ type: "fetch_ok", entries: data.entries, total: data.total })
    } catch {
      dispatch({ type: "fetch_err" })
    }
  }, [])

  useEffect(() => {
    void load(state.offset, state.userFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.offset, state.userFilter])

  const visibleEntries = useMemo(
    () => state.entries.filter((entry) => eventMatchesFilter(entry, state.eventFilter)),
    [state.entries, state.eventFilter],
  )

  const uniqueUsers = useMemo(
    () => new Set(state.entries.map((entry) => entry.userId)).size,
    [state.entries],
  )

  const eventsToday = useMemo(
    () => state.entries.filter((entry) => isToday(entry.createdAt)).length,
    [state.entries],
  )

  const writeEvents = useMemo(
    () => state.entries.filter((entry) => entry.action.includes("written")).length,
    [state.entries],
  )

  const totalPages = Math.ceil(state.total / PAGE_SIZE)
  const currentPage = Math.floor(state.offset / PAGE_SIZE) + 1

  const handleApplyFilter = () => {
    dispatch({ type: "apply_filter", value: state.filterDraft })
  }

  const handleClearFilter = () => {
    dispatch({ type: "apply_filter", value: "" })
  }

  return (
    <AdminPageShell size="wide" className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="size-8" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">PHI Audit Log</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              HIPAA §164.312(b) - tracking all Protected Health Information access events
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <Bell className="size-4" />
            Alerts
            {writeEvents > 0 && (
              <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                {writeEvents}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => exportEntries(visibleEntries)}
            disabled={visibleEntries.length === 0}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button
            onClick={() => void load(state.offset, state.userFilter)}
            disabled={state.status === "loading"}
            className="bg-slate-950 text-white hover:bg-slate-800"
          >
            <RefreshCw className={cn("size-4", state.status === "loading" && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AuditMetricCard
          icon={Activity}
          label="Total Events"
          value={state.total.toLocaleString()}
          trend="API total"
          tone="emerald"
        />
        <AuditMetricCard
          icon={Users}
          label="Unique Users"
          value={uniqueUsers.toLocaleString()}
          trend="loaded page"
          tone="blue"
        />
        <AuditMetricCard
          icon={Clock3}
          label="Events Today"
          value={eventsToday.toLocaleString()}
          trend="loaded page"
          tone="amber"
        />
        <AuditMetricCard
          icon={AlertTriangle}
          label="Write Events"
          value={writeEvents.toLocaleString()}
          trend="review required"
          tone="rose"
        />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by user ID"
              value={state.filterDraft}
              onChange={(event) => dispatch({ type: "set_filter_draft", value: event.target.value })}
              onKeyDown={(event) => event.key === "Enter" && handleApplyFilter()}
              className="h-10 w-full rounded-md border bg-background pl-9 pr-9 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {state.filterDraft && (
              <button
                onClick={handleClearFilter}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear user filter"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <button className="flex h-10 items-center justify-between rounded-md border bg-background px-3 text-sm text-foreground">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              Last 7 days
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>

          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={state.eventFilter}
              onChange={(event) =>
                dispatch({ type: "set_event_filter", value: event.target.value as EventFilter })
              }
              className="h-10 w-full appearance-none rounded-md border bg-background pl-9 pr-8 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All events</option>
              <option value="reads">Read events</option>
              <option value="writes">Write events</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </label>

          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label="Advanced filters">
              <SlidersHorizontal className="size-4" />
            </Button>
            <Button onClick={handleApplyFilter} className="flex-1 bg-emerald-600 hover:bg-emerald-700 lg:flex-none">
              Apply
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="font-medium text-foreground">{visibleEntries.length}</span> events matched
            {state.userFilter && ` for ${state.userFilter}`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Auto-refresh ready
          </span>
        </div>
      </div>

      {state.status === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          Failed to load PHI audit log. Please try again.
        </div>
      )}

      <AdminTablePanel>
        {state.status === "loading" ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" /> Loading...
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <ShieldCheck className="size-8 text-muted-foreground/40" />
            No PHI access events found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">IP / Purpose</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleEntries.map((entry) => {
                  const actionStyle = ACTION_STYLES[entry.action] ?? {
                    badge: "border-border bg-muted text-muted-foreground",
                    dot: "bg-muted-foreground",
                  }

                  return (
                    <tr key={entry.id} className="transition-colors hover:bg-muted/35">
                      <td className="px-4 py-4 text-muted-foreground">
                        <ChevronDown className="size-4" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-foreground">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("size-1.5 rounded-full", actionStyle.dot)} />
                          <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", actionStyle.badge)}>
                            {ACTION_LABELS[entry.action] ?? entry.action}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                            {userInitials(entry.userId)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">User {userInitials(entry.userId)}</div>
                            <div className="max-w-44 truncate font-mono text-xs text-muted-foreground" title={entry.userId}>
                              {maskUserId(entry.userId)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-mono">
                          <MapPin className="size-3.5" />
                          {entry.ipAddress ?? "-"}
                        </div>
                        <div className="mt-1">
                          {(entry.metadata.purpose as string | undefined) ?? "No purpose recorded"}
                        </div>
                      </td>
                      <td className="max-w-64 truncate px-4 py-4 font-mono text-xs text-muted-foreground">
                        {Object.keys(entry.metadata).filter((key) => key !== "purpose").length > 0
                          ? JSON.stringify(
                              Object.fromEntries(
                                Object.entries(entry.metadata).filter(([key]) => key !== "purpose"),
                              ),
                            )
                          : "-"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminTablePanel>

      {totalPages > 1 && state.status === "ready" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "set_offset", offset: state.offset - PAGE_SIZE })}
              disabled={state.offset === 0}
            >
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "set_offset", offset: state.offset + PAGE_SIZE })}
              disabled={state.offset + PAGE_SIZE >= state.total}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}

interface AuditMetricCardProps {
  icon: typeof Activity
  label: string
  value: string
  trend: string
  tone: "emerald" | "blue" | "amber" | "rose"
}

const metricToneClass: Record<AuditMetricCardProps["tone"], string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
}

function AuditMetricCard({
  icon: Icon,
  label,
  value,
  trend,
  tone,
}: AuditMetricCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className={cn("rounded-lg p-3", metricToneClass[tone])}>
          <Icon className="size-5" />
        </div>
        <MiniTrend tone={tone} />
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-2xl font-semibold leading-none text-foreground">{value}</span>
        <span className="text-xs font-medium text-muted-foreground">{trend}</span>
      </div>
    </div>
  )
}

function MiniTrend({ tone }: { tone: AuditMetricCardProps["tone"] }) {
  const strokeClass: Record<AuditMetricCardProps["tone"], string> = {
    emerald: "stroke-emerald-500",
    blue: "stroke-blue-500",
    amber: "stroke-amber-500",
    rose: "stroke-rose-500",
  }

  return (
    <svg viewBox="0 0 72 32" className="h-8 w-20" aria-hidden="true">
      <path
        d="M2 26 L14 21 L25 23 L36 14 L48 16 L60 8 L70 4"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass[tone]}
      />
    </svg>
  )
}
