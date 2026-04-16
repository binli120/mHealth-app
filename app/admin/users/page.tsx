"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  Search,
  UserCheck,
  UserX,
  Shield,
  User,
  UserPlus,
  X,
  Loader2,
  CheckCircle,
  Building2,
  Copy,
  Upload,
  ChevronDown,
  Trash2,
} from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { AdminUser, CompanyOption } from "./page.types"
import { ROLE_OPTIONS, ROLE_COLORS } from "./page.constants"
import { fullName } from "./page.utils"

// ── CSV import helpers ────────────────────────────────────────────────────────

type CsvRow = {
  email: string
  first_name: string
  last_name: string
  role: string
  company_id: string
  _error?: string
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
    const get = (key: string) => cols[header.indexOf(key)] ?? ""
    const row: CsvRow = {
      email: get("email"),
      first_name: get("first_name"),
      last_name: get("last_name"),
      role: get("role") || "applicant",
      company_id: get("company_id"),
    }
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      row._error = "Invalid email"
    }
    return row
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

function AdminUsersInner() {
  const searchParams = useSearchParams()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [companyFilter, setCompanyFilter] = useState(searchParams.get("company_id") ?? "")
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const allPageIds = users.map((u) => u.id)
  const allPageSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id))
  const somePageSelected = allPageIds.some((id) => selectedIds.has(id))

  // Bulk action
  const [bulkAction, setBulkAction] = useState("")
  const [bulkRole, setBulkRole] = useState("applicant")
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<string | null>(null)
  const [showBulkRolePicker, setShowBulkRolePicker] = useState(false)

  // Invite modal
  const [showInvite, setShowInvite] = useState(searchParams.get("invite") === "1")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteCompany, setInviteCompany] = useState(searchParams.get("company_id") ?? "")
  const [inviteRole, setInviteRole] = useState("applicant")
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<{ url: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  // CSV import modal
  const [showImport, setShowImport] = useState(false)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ updated: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (roleFilter) params.set("role", roleFilter)
    if (companyFilter) params.set("company_id", companyFilter)
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(page * PAGE_SIZE))
    params.set("companies", "1")

    const res = await authenticatedFetch(`/api/admin/users?${params}`)
    const data = await res.json()
    if (data.ok) {
      setUsers(data.users)
      setTotal(data.total)
      if (data.companies) setCompanies(data.companies)
    }
    setLoading(false)
  }, [search, roleFilter, companyFilter, page])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  // Clear bulk msg after 3s
  useEffect(() => {
    if (!bulkMsg) return
    const t = setTimeout(() => setBulkMsg(null), 3000)
    return () => clearTimeout(t)
  }, [bulkMsg])

  // ── Selection helpers ────────────────────────────────────────────────────

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) allPageIds.forEach((id) => next.delete(id))
      else allPageIds.forEach((id) => next.add(id))
      return next
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── CRUD helpers ─────────────────────────────────────────────────────────

  const handleSetActive = async (userId: string, isActive: boolean) => {
    await authenticatedFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ userId, action: "set_active", isActive }),
    })
    void fetchUsers()
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────

  const handleBulkAction = async (action: string, role?: string) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkLoading(true)
    setBulkMsg(null)
    try {
      let body: Record<string, unknown>
      if (action === "deactivate" || action === "activate") {
        body = { action, userIds: ids }
      } else if (action === "set_role" && role) {
        body = { action: "set_role", userIds: ids, role }
      } else {
        setBulkLoading(false)
        return
      }
      const res = await authenticatedFetch("/api/admin/bulk", {
        method: "POST",
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        setBulkMsg(`Updated ${data.updated} user${data.updated !== 1 ? "s" : ""}`)
        setSelectedIds(new Set())
        void fetchUsers()
      } else {
        setBulkMsg(data.error ?? "Action failed")
      }
    } catch (err) {
      setBulkMsg(String(err))
    } finally {
      setBulkLoading(false)
    }
  }

  // ── Invite ───────────────────────────────────────────────────────────────

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setInviteResult(null)
    try {
      const res = await authenticatedFetch("/api/admin/users/invite", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          companyId: inviteCompany || null,
          role: inviteRole,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setInviteResult({ url: data.inviteUrl })
        void fetchUsers()
      } else {
        setInviteError(data.error ?? `Error ${res.status}`)
      }
    } catch (err) {
      setInviteError(String(err))
    } finally {
      setInviting(false)
    }
  }

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const resetInviteModal = () => {
    setShowInvite(false)
    setInviteEmail("")
    setInviteCompany(companyFilter)
    setInviteRole("applicant")
    setInviteError(null)
    setInviteResult(null)
    setLinkCopied(false)
  }

  // ── CSV Import ───────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFileName(file.name)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvRows(parseCsv(text))
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    const validRows = csvRows.filter((r) => !r._error)
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const res = await authenticatedFetch("/api/admin/bulk", {
        method: "POST",
        body: JSON.stringify({ action: "import_csv", rows: validRows }),
      })
      const data = await res.json()
      if (data.ok) {
        setImportResult({ updated: data.updated, errors: data.errors ?? [] })
        void fetchUsers()
      } else {
        setImportResult({ updated: 0, errors: [data.error ?? "Import failed"] })
      }
    } catch (err) {
      setImportResult({ updated: 0, errors: [String(err)] })
    } finally {
      setImporting(false)
    }
  }

  const resetImportModal = () => {
    setShowImport(false)
    setCsvRows([])
    setCsvFileName(null)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const companyFilterLabel = companies.find((c) => c.id === companyFilter)?.name
  const validCsvRows = csvRows.filter((r) => !r._error)
  const errorCsvRows = csvRows.filter((r) => r._error)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} total users
            {companyFilterLabel && (
              <span className="ml-1">
                · filtered by <span className="font-medium text-blue-700">{companyFilterLabel}</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(0) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={companyFilter}
          onChange={(e) => { setCompanyFilter(e.target.value); setPage(0) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-40"
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {companyFilter && (
          <button
            onClick={() => setCompanyFilter("")}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1"
          >
            <X className="w-3 h-3" /> Clear company
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Roles</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-gray-50 ${selectedIds.has(u.id) ? "bg-blue-50/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{fullName(u)}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.company_name ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-600 truncate max-w-36">{u.company_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-gray-400 text-xs">No role</span>
                        ) : (
                          u.roles.map((r) => (
                            <span
                              key={r}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[r] ?? "bg-gray-100 text-gray-600"}`}
                            >
                              {r === "admin" && <Shield className="w-3 h-3" />}
                              {r.replace(/_/g, " ")}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSetActive(u.id, !u.is_active)}
                        title={u.is_active ? "Deactivate" : "Activate"}
                        className={`p-1.5 rounded hover:bg-gray-100 ${u.is_active ? "text-red-500" : "text-emerald-600"}`}
                      >
                        {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk Action Bar ─────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-medium text-slate-300">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-5 bg-slate-700" />

          {bulkMsg && (
            <span className="text-xs text-emerald-400 font-medium">{bulkMsg}</span>
          )}

          {/* Activate */}
          <button
            onClick={() => handleBulkAction("activate")}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
          >
            {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            Activate
          </button>

          {/* Deactivate */}
          <button
            onClick={() => handleBulkAction("deactivate")}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Deactivate
          </button>

          {/* Assign role */}
          <div className="relative">
            <button
              onClick={() => setShowBulkRolePicker((v) => !v)}
              disabled={bulkLoading}
              className="flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200 disabled:opacity-40"
            >
              <Shield className="w-3.5 h-3.5" />
              Assign Role
              <ChevronDown className="w-3 h-3" />
            </button>
            {showBulkRolePicker && (
              <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl border border-gray-200 shadow-xl py-1 min-w-44 z-50">
                {ROLE_OPTIONS.filter((o) => o.value).map((o) => (
                  <button
                    key={o.value}
                    onClick={() => {
                      setBulkRole(o.value)
                      setShowBulkRolePicker(false)
                      void handleBulkAction("set_role", o.value)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-slate-700" />

          {/* Clear selection */}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-slate-400 hover:text-white"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Invite User Modal ────────────────────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">Invite User</h2>
              </div>
              <button onClick={resetInviteModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteResult ? (
              <div className="px-6 py-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">Invitation created!</div>
                    <div className="text-xs text-gray-500">
                      {process.env.NODE_ENV === "development"
                        ? "Check the server console for the email link (no Resend key in dev)."
                        : "An email has been sent to the user."}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                  <div className="text-xs text-gray-500 mb-1 font-medium">Invitation link</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-700 break-all flex-1 font-mono leading-relaxed">
                      {inviteResult.url}
                    </span>
                    <button
                      onClick={() => copyLink(inviteResult.url)}
                      className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-blue-700 border border-gray-200 rounded px-2 py-1"
                    >
                      {linkCopied ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {linkCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setInviteResult(null); setInviteEmail(""); setInviteError(null) }}
                    className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Invite another
                  </button>
                  <button
                    onClick={resetInviteModal}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={inviteCompany}
                    onChange={(e) => setInviteCompany(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLE_OPTIONS.filter((o) => o.value).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {inviteError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {inviteError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetInviteModal}
                    className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {inviting ? "Sending…" : "Send Invitation"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── CSV Import Modal ─────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">Import Users from CSV</h2>
              </div>
              <button onClick={resetImportModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
              {/* Format hint */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                <strong>Expected columns:</strong>{" "}
                <code className="font-mono">email, first_name, last_name, role, company_id</code>
                <br />
                <span className="text-blue-500">role</span> defaults to{" "}
                <code className="font-mono">applicant</code> if omitted.{" "}
                <span className="text-blue-500">company_id</span> is optional.
              </div>

              {/* File picker */}
              {!importResult && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-gray-300 mb-2" />
                    <span className="text-sm font-medium text-gray-600">
                      {csvFileName ?? "Click to choose a CSV file"}
                    </span>
                    {csvFileName && (
                      <span className="text-xs text-gray-400 mt-1">
                        {csvRows.length} rows found ({validCsvRows.length} valid, {errorCsvRows.length} errors)
                      </span>
                    )}
                  </label>
                </div>
              )}

              {/* Preview table */}
              {csvRows.length > 0 && !importResult && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Preview ({csvRows.length} rows)</h3>
                    {errorCsvRows.length > 0 && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        {errorCsvRows.length} row{errorCsvRows.length !== 1 ? "s" : ""} will be skipped
                      </span>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Role</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {csvRows.map((row, i) => (
                          <tr key={i} className={row._error ? "bg-red-50" : ""}>
                            <td className="px-3 py-2 font-mono text-gray-700">{row.email || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{row.role}</td>
                            <td className="px-3 py-2">
                              {row._error ? (
                                <span className="text-red-600 font-medium">{row._error}</span>
                              ) : (
                                <span className="text-emerald-600">✓ Valid</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${importResult.errors.length === 0 ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
                    <CheckCircle className={`w-6 h-6 flex-shrink-0 ${importResult.errors.length === 0 ? "text-emerald-600" : "text-amber-500"}`} />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {importResult.updated} user{importResult.updated !== 1 ? "s" : ""} imported
                      </div>
                      {importResult.errors.length > 0 && (
                        <div className="text-xs text-amber-700 mt-0.5">
                          {importResult.errors.length} row{importResult.errors.length !== 1 ? "s" : ""} failed
                        </div>
                      )}
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {importResult.errors.map((e, i) => (
                        <div key={i} className="text-xs text-red-700 font-mono">{e}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0 flex gap-2">
              <button
                onClick={resetImportModal}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                {importResult ? "Close" : "Cancel"}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={importing || validCsvRows.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {importing ? "Importing…" : `Import ${validCsvRows.length} User${validCsvRows.length !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    }>
      <AdminUsersInner />
    </Suspense>
  )
}
