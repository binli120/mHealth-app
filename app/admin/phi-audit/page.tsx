"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Admin PHI Audit Log viewer — /admin/phi-audit
 *
 * Displays paginated PHI access events (SSN reads/writes, bank account
 * reads/writes) recorded in audit_logs.  Access is restricted to admins
 * via the requireAdmin guard on the backing API route.
 *
 * HIPAA §164.312(b) — Audit controls: hardware, software, and/or
 * procedural mechanisms that record and examine activity in information
 * systems that contain or use PHI.
 */

import { useEffect, useReducer, useCallback } from "react"
import {
  ShieldCheck,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { PhiAuditEntry } from "@/lib/db/phi-audit"

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

// ── Types ─────────────────────────────────────────────────────────────────────

type PageState = {
  status: "loading" | "ready" | "error"
  entries: PhiAuditEntry[]
  total: number
  offset: number
  userFilter: string
  /** Draft value of the filter input (not yet applied) */
  filterDraft: string
}

type PageAction =
  | { type: "fetch_start" }
  | { type: "fetch_ok"; entries: PhiAuditEntry[]; total: number }
  | { type: "fetch_err" }
  | { type: "set_filter_draft"; value: string }
  | { type: "apply_filter"; value: string }
  | { type: "set_offset"; offset: number }

function initState(): PageState {
  return {
    status: "loading",
    entries: [],
    total: 0,
    offset: 0,
    userFilter: "",
    filterDraft: "",
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
    case "set_offset":
      return { ...state, offset: action.offset }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  "phi.ssn.written":              "SSN Written",
  "phi.ssn.decrypted":            "SSN Read",
  "phi.bank_account.written":     "Bank Account Written",
  "phi.bank_account.decrypted":   "Bank Account Read",
}

const ACTION_COLORS: Record<string, string> = {
  "phi.ssn.written":            "bg-amber-100 text-amber-800",
  "phi.ssn.decrypted":          "bg-blue-100 text-blue-800",
  "phi.bank_account.written":   "bg-purple-100 text-purple-800",
  "phi.bank_account.decrypted": "bg-indigo-100 text-indigo-800",
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

// ── Component ─────────────────────────────────────────────────────────────────

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

  // Load on mount and whenever offset / filter change
  useEffect(() => {
    void load(state.offset, state.userFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.offset, state.userFilter])

  const totalPages = Math.ceil(state.total / PAGE_SIZE)
  const currentPage = Math.floor(state.offset / PAGE_SIZE) + 1

  const handleApplyFilter = () => {
    dispatch({ type: "apply_filter", value: state.filterDraft })
  }

  const handleClearFilter = () => {
    dispatch({ type: "apply_filter", value: "" })
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">PHI Audit Log</h1>
            <p className="text-sm text-gray-500">
              HIPAA §164.312(b) — all Protected Health Information access events
            </p>
          </div>
        </div>
        <button
          onClick={() => void load(state.offset, state.userFilter)}
          disabled={state.status === "loading"}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${state.status === "loading" ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Filter by user ID…"
          value={state.filterDraft}
          onChange={(e) => dispatch({ type: "set_filter_draft", value: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
          className="flex-1 text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />
        {state.filterDraft && (
          <button
            onClick={handleClearFilter}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleApplyFilter}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          Apply
        </button>
      </div>

      {/* Count */}
      {state.status === "ready" && (
        <p className="text-xs text-gray-500 mb-3">
          {state.total.toLocaleString()} event{state.total !== 1 ? "s" : ""}
          {state.userFilter && ` for user ${state.userFilter}`}
        </p>
      )}

      {/* Error */}
      {state.status === "error" && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Failed to load PHI audit log. Please try again.
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {state.status === "loading" ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : state.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <ShieldCheck className="w-8 h-8 text-gray-200" />
            No PHI access events found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {state.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs max-w-[180px] truncate">
                      {entry.userId}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {entry.ipAddress ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {(entry.metadata.purpose as string | undefined) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs max-w-[220px] truncate">
                      {Object.keys(entry.metadata).filter((k) => k !== "purpose").length > 0
                        ? JSON.stringify(
                            Object.fromEntries(
                              Object.entries(entry.metadata).filter(([k]) => k !== "purpose"),
                            ),
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && state.status === "ready" && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatch({ type: "set_offset", offset: state.offset - PAGE_SIZE })}
              disabled={state.offset === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={() => dispatch({ type: "set_offset", offset: state.offset + PAGE_SIZE })}
              disabled={state.offset + PAGE_SIZE >= state.total}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
