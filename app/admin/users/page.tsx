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
import { toUserFacingError } from "@/lib/errors/user-facing"
import {
  AdminPageHeader,
  AdminPageShell,
  AdminPagination,
  AdminTablePanel,
  AdminToolbar,
} from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
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
        setBulkMsg(toUserFacingError(data.error, "Action failed."))
      }
    } catch (err) {
      setBulkMsg(toUserFacingError(err, "Action failed."))
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
        setInviteError(toUserFacingError(data.error ?? `Error ${res.status}`, "Failed to send invitation."))
      }
    } catch (err) {
      setInviteError(toUserFacingError(err, "Failed to send invitation."))
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
        setImportResult({ updated: 0, errors: [toUserFacingError(data.error, "Import failed.")] })
      }
    } catch (err) {
      setImportResult({ updated: 0, errors: [toUserFacingError(err, "Import failed.")] })
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
    <AdminPageShell>
      {/* Header */}
      <AdminPageHeader
        title="Users"
        description={
          <>
            {total} total users
            {companyFilterLabel && (
              <span className="ml-1">
                · filtered by <span className="font-medium text-primary">{companyFilterLabel}</span>
              </span>
            )}
          </>
        }
        action={
          <>
          <Button
            variant="outline"
            onClick={() => setShowImport(true)}
          >
            <Upload className="size-4" />
            Import CSV
          </Button>
          <Button
            onClick={() => setShowInvite(true)}
          >
            <UserPlus className="size-4" />
            Invite User
          </Button>
          </>
        }
      />

      {/* Filters */}
      <AdminToolbar>
        <div className="relative min-w-0 flex-1 sm:min-w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(0) }}
          className="h-9 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={companyFilter}
          onChange={(e) => { setCompanyFilter(e.target.value); setPage(0) }}
          className="h-9 min-w-40 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {companyFilter && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompanyFilter("")}
          >
            <X className="size-3" /> Clear company
          </Button>
        )}
      </AdminToolbar>

      {/* Table */}
      <AdminTablePanel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-input text-primary focus:ring-ring"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Roles</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-muted/40 ${selectedIds.has(u.id) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="size-4 rounded border-input text-primary focus:ring-ring"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User className="size-4" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{fullName(u)}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.company_name ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="max-w-36 truncate text-xs text-muted-foreground">{u.company_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No role</span>
                        ) : (
                          u.roles.map((r) => (
                            <span
                              key={r}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {r === "admin" && <Shield className="size-3" />}
                              {r.replace(/_/g, " ")}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSetActive(u.id, !u.is_active)}
                        title={u.is_active ? "Deactivate" : "Activate"}
                        className={`rounded p-1.5 hover:bg-muted ${u.is_active ? "text-destructive" : "text-success"}`}
                      >
                        {u.is_active ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
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
          <AdminPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPrevious={() => setPage(p => p - 1)}
            onNext={() => setPage(p => p + 1)}
          />
        )}
      </AdminTablePanel>

      {/* ── Bulk Action Bar ─────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 flex flex-wrap items-center justify-center gap-3 rounded-lg border bg-popover px-4 py-3 text-popover-foreground shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:px-5">
          <span className="text-sm font-medium text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <div className="hidden h-5 w-px bg-border sm:block" />

          {bulkMsg && (
            <span className="text-xs font-medium text-success">{bulkMsg}</span>
          )}

          {/* Activate */}
          <button
            onClick={() => handleBulkAction("activate")}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-sm text-success hover:opacity-80 disabled:opacity-40"
          >
            {bulkLoading ? <Loader2 className="size-3.5 animate-spin" /> : <UserCheck className="size-3.5" />}
            Activate
          </button>

          {/* Deactivate */}
          <button
            onClick={() => handleBulkAction("deactivate")}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-sm text-destructive hover:opacity-80 disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            Deactivate
          </button>

          {/* Assign role */}
          <div className="relative">
            <button
              onClick={() => setShowBulkRolePicker((v) => !v)}
              disabled={bulkLoading}
              className="flex items-center gap-1 text-sm text-primary hover:opacity-80 disabled:opacity-40"
            >
              <Shield className="size-3.5" />
              Assign Role
              <ChevronDown className="size-3" />
            </button>
            {showBulkRolePicker && (
              <div className="absolute bottom-full left-0 z-50 mb-2 min-w-44 rounded-lg border bg-popover py-1 text-popover-foreground shadow-xl">
                {ROLE_OPTIONS.filter((o) => o.value).map((o) => (
                  <button
                    key={o.value}
                    onClick={() => {
                      setBulkRole(o.value)
                      setShowBulkRolePicker(false)
                      void handleBulkAction("set_role", o.value)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden h-5 w-px bg-border sm:block" />

          {/* Clear selection */}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-muted-foreground hover:text-foreground"
            title="Clear selection"
          >
            <X className="size-4" />
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
    </AdminPageShell>
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
