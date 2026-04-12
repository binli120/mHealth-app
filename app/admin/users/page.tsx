"use client"

/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Copy,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react"

import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

import type { AdminUser, CompanyOption } from "./page.types"
import { ROLE_COLORS, ROLE_OPTIONS } from "./page.constants"
import { fullName } from "./page.utils"

type UserStatusAction = "activate" | "deactivate" | "delete" | "reactivate"

interface ConfirmActionState {
  user: AdminUser
  action: UserStatusAction
  nextStatus: AdminUser["lifecycle_status"]
}

const PAGE_SIZE = 25
const EDITABLE_ROLE_OPTIONS = ROLE_OPTIONS.filter((option) => option.value)

function getStatusBadgeClass(status: AdminUser["lifecycle_status"]): string {
  if (status === "active") return "bg-emerald-100 text-emerald-700"
  if (status === "inactive") return "bg-amber-100 text-amber-800"
  return "bg-rose-100 text-rose-700"
}

function getStatusLabel(status: AdminUser["lifecycle_status"]): string {
  if (status === "active") return "Active"
  if (status === "inactive") return "Inactive"
  return "Deleted"
}

function getStatusActionConfig(user: AdminUser): {
  action: UserStatusAction
  nextStatus: AdminUser["lifecycle_status"]
  label: string
  icon: typeof UserCheck
  className: string
} {
  if (user.lifecycle_status === "deleted") {
    return {
      action: "reactivate",
      nextStatus: "active",
      label: "Reactivate",
      icon: RotateCcw,
      className: "text-emerald-600",
    }
  }

  if (user.lifecycle_status === "inactive") {
    return {
      action: "activate",
      nextStatus: "active",
      label: "Activate",
      icon: UserCheck,
      className: "text-emerald-600",
    }
  }

  return {
    action: "deactivate",
    nextStatus: "inactive",
    label: "Deactivate",
    icon: UserX,
    className: "text-amber-700",
  }
}

function buildConfirmationCopy(action: UserStatusAction, userName: string): { title: string; body: string } {
  if (action === "deactivate") {
    return {
      title: `Deactivate ${userName}?`,
      body: "The user will remain in the system, but their account status will change to inactive until an admin activates it again.",
    }
  }

  if (action === "activate") {
    return {
      title: `Activate ${userName}?`,
      body: "This will restore the user to active status immediately.",
    }
  }

  if (action === "reactivate") {
    return {
      title: `Reactivate ${userName}?`,
      body: "This will restore the soft-deleted patient account and mark it active again.",
    }
  }

  return {
    title: `Delete ${userName}?`,
    body: "This is a soft delete for patient accounts. The record and historical data stay in place, but the account status changes to deleted until an admin reactivates it.",
  }
}

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
  const [pageError, setPageError] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editingRoles, setEditingRoles] = useState<string[]>([])
  const [savingRoles, setSavingRoles] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

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
    setPageError(null)

    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (roleFilter) params.set("role", roleFilter)
      if (companyFilter) params.set("company_id", companyFilter)
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(page * PAGE_SIZE))
      params.set("companies", "1")

      const res = await authenticatedFetch(`/api/admin/users?${params}`)
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Failed to load users (${res.status})`)
      }

      setUsers(data.users)
      setTotal(data.total)
      if (data.companies) setCompanies(data.companies)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load users.")
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, companyFilter, page])

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300)
    return () => clearTimeout(timer)
  }, [fetchUsers])

  const handleRoleToggle = (roleName: string) => {
    setEditingRoles((currentRoles) =>
      currentRoles.includes(roleName)
        ? currentRoles.filter((existingRole) => existingRole !== roleName)
        : [...currentRoles, roleName],
    )
  }

  const openEditUser = (user: AdminUser) => {
    setEditingUser(user)
    setEditingRoles(user.roles)
    setEditError(null)
  }

  const closeEditUser = () => {
    setEditingUser(null)
    setEditingRoles([])
    setSavingRoles(false)
    setEditError(null)
  }

  const saveRoleChanges = async () => {
    if (!editingUser) return

    const currentRoles = new Set(editingUser.roles)
    const nextRoles = new Set(editingRoles)
    const updates: Array<{ roleName: string; add: boolean }> = []

    for (const roleName of EDITABLE_ROLE_OPTIONS.map((option) => option.value)) {
      const hadRole = currentRoles.has(roleName)
      const willHaveRole = nextRoles.has(roleName)
      if (hadRole !== willHaveRole) {
        updates.push({ roleName, add: willHaveRole })
      }
    }

    if (updates.length === 0) {
      closeEditUser()
      return
    }

    setSavingRoles(true)
    setEditError(null)

    try {
      for (const update of updates) {
        const res = await authenticatedFetch("/api/admin/users", {
          method: "PATCH",
          body: JSON.stringify({
            userId: editingUser.id,
            action: "set_role",
            roleName: update.roleName,
            add: update.add,
          }),
        })

        const payload = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
        if (!res.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to update user roles.")
        }
      }

      closeEditUser()
      await fetchUsers()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update user roles.")
    } finally {
      setSavingRoles(false)
    }
  }

  const requestStatusChange = (user: AdminUser, action: UserStatusAction, nextStatus: AdminUser["lifecycle_status"]) => {
    setConfirmAction({ user, action, nextStatus })
    setConfirmError(null)
  }

  const executeStatusChange = async () => {
    if (!confirmAction) return

    setSavingUserId(confirmAction.user.id)
    setConfirmError(null)

    try {
      const res = await authenticatedFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: confirmAction.user.id,
          action: "set_status",
          status: confirmAction.nextStatus,
        }),
      })

      const payload = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to update user status.")
      }

      setConfirmAction(null)
      await fetchUsers()
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : "Unable to update user status.")
    } finally {
      setSavingUserId(null)
    }
  }

  const handleSendInvite = async (event: React.FormEvent) => {
    event.preventDefault()
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
        await fetchUsers()
      } else {
        setInviteError(data.error ?? `Error ${res.status}`)
      }
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : String(error))
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

  const companyFilterLabel = companies.find((company) => company.id === companyFilter)?.name

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

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email or name…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value)
            setPage(0)
          }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={companyFilter}
          onChange={(event) => {
            setCompanyFilter(event.target.value)
            setPage(0)
          }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-40"
        >
          <option value="">All Companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
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

      {pageError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

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
                users.map((user) => {
                  const statusAction = getStatusActionConfig(user)
                  const StatusActionIcon = statusAction.icon
                  const isSavingThisUser = savingUserId === user.id

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{fullName(user)}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.company_name ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-600 truncate max-w-36">{user.company_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length === 0 ? (
                            <span className="text-gray-400 text-xs">No role</span>
                          ) : (
                            user.roles.map((roleName) => (
                              <span
                                key={roleName}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[roleName] ?? "bg-gray-100 text-gray-600"}`}
                              >
                                {roleName === "admin" && <Shield className="w-3 h-3" />}
                                {roleName.replace("_", " ")}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(user.lifecycle_status)}`}>
                          {getStatusLabel(user.lifecycle_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditUser(user)}
                            title="Edit roles"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => requestStatusChange(user, statusAction.action, statusAction.nextStatus)}
                            title={statusAction.label}
                            disabled={isSavingThisUser}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-50 ${statusAction.className}`}
                          >
                            {isSavingThisUser ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <StatusActionIcon className="w-4 h-4" />
                            )}
                          </button>

                          {user.is_patient && user.lifecycle_status !== "deleted" && (
                            <button
                              onClick={() => requestStatusChange(user, "delete", "deleted")}
                              title="Delete patient"
                              disabled={isSavingThisUser}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((currentPage) => currentPage - 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Edit User</h2>
                <p className="text-sm text-gray-500">{editingUser.email}</p>
              </div>
              <button onClick={closeEditUser} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-sm font-medium text-gray-900">{fullName(editingUser)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${getStatusBadgeClass(editingUser.lifecycle_status)}`}>
                    {getStatusLabel(editingUser.lifecycle_status)}
                  </span>
                  {editingUser.company_name ? <span>{editingUser.company_name}</span> : null}
                  {editingUser.is_patient ? <span>Patient account</span> : <span>Staff account</span>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Roles</h3>
                <div className="grid gap-2">
                  {EDITABLE_ROLE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={editingRoles.includes(option.value)}
                        onChange={() => handleRoleToggle(option.value)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {editError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={closeEditUser}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRoleChanges}
                disabled={savingRoles}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingRoles && <Loader2 className="w-4 h-4 animate-spin" />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-gray-100 px-6 py-5">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {buildConfirmationCopy(confirmAction.action, fullName(confirmAction.user)).title}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {buildConfirmationCopy(confirmAction.action, fullName(confirmAction.user)).body}
                </p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <div className="font-medium text-gray-900">{fullName(confirmAction.user)}</div>
                <div className="mt-1">{confirmAction.user.email}</div>
              </div>

              {confirmError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {confirmError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null)
                  setConfirmError(null)
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeStatusChange}
                disabled={savingUserId === confirmAction.user.id}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  confirmAction.action === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {savingUserId === confirmAction.user.id && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

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
              <form onSubmit={handleSendInvite} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
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
                    onChange={(event) => setInviteCompany(event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value)}
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
