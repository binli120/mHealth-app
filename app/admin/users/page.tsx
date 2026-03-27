"use client"

/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { useEffect, useState, useCallback } from "react"
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
} from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { AdminUser, CompanyOption } from "./page.types"
import { ROLE_OPTIONS, ROLE_COLORS } from "./page.constants"
import { fullName } from "./page.utils"

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
  // Auto-open invite modal if ?invite=1 is present (navigated from companies page)
  const PAGE_SIZE = 25

  // Invite modal
  const [showInvite, setShowInvite] = useState(searchParams.get("invite") === "1")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteCompany, setInviteCompany] = useState(searchParams.get("company_id") ?? "")
  const [inviteRole, setInviteRole] = useState("applicant")
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<{ url: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (roleFilter) params.set("role", roleFilter)
    if (companyFilter) params.set("company_id", companyFilter)
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(page * PAGE_SIZE))
    params.set("companies", "1") // piggyback company list on first load

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

  const handleSetActive = async (userId: string, isActive: boolean) => {
    await authenticatedFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ userId, action: "set_active", isActive }),
    })
    void fetchUsers()
  }

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

  const companyFilterLabel = companies.find((c) => c.id === companyFilter)?.name

  return (
    <div className="max-w-6xl mx-auto">
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
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite User
        </button>
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
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
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
                              {r.replace("_", " ")}
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
              /* Success state */
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
                    onClick={() => {
                      setInviteResult(null)
                      setInviteEmail("")
                      setInviteError(null)
                    }}
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
              /* Form state */
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
                    <option value="applicant">Applicant</option>
                    <option value="social_worker">Social Worker</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="admin">Admin</option>
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
