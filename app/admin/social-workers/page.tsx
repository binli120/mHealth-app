"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Search, CheckCircle, XCircle, UserCheck, UserPlus, X, Loader2, Copy } from "lucide-react"
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
import type { SocialWorker, CompanyOption } from "./page.types"
import { STATUS_FILTER_OPTIONS, STATUS_STYLE, VALID_STATUS_FILTERS } from "./page.constants"
import { initialStatusFromSearchParams, fullName } from "./page.utils"

function AdminSocialWorkersPageInner() {
  const searchParams = useSearchParams()
  const [workers, setWorkers] = useState<SocialWorker[]>([])
  const [total, setTotal] = useState(0)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState(() =>
    initialStatusFromSearchParams(searchParams),
  )
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rejectDialog, setRejectDialog] = useState<{ id: string; note: string } | null>(null)
  const PAGE_SIZE = 25

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteCompany, setInviteCompany] = useState("")
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<{ url: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const fetchWorkers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(page * PAGE_SIZE))

    const [swRes, usersRes] = await Promise.all([
      authenticatedFetch(`/api/admin/social-workers?${params}`),
      companies.length === 0
        ? authenticatedFetch("/api/admin/users?companies=1&limit=1")
        : Promise.resolve(null),
    ])

    const swData = await swRes.json()
    if (swData.ok) {
      setWorkers(swData.socialWorkers)
      setTotal(swData.total)
    }

    if (usersRes) {
      const usersData = await usersRes.json()
      if (usersData.companies) setCompanies(usersData.companies)
    }

    setLoading(false)
  }, [search, statusFilter, page, companies.length])

  useEffect(() => {
    const t = setTimeout(fetchWorkers, 300)
    return () => clearTimeout(t)
  }, [fetchWorkers])

  const handleApprove = async (profileId: string) => {
    await authenticatedFetch("/api/admin/social-workers", {
      method: "PATCH",
      body: JSON.stringify({ profileId, action: "approve" }),
    })
    fetchWorkers()
  }

  const handleReject = async () => {
    if (!rejectDialog) return
    await authenticatedFetch("/api/admin/social-workers", {
      method: "PATCH",
      body: JSON.stringify({
        profileId: rejectDialog.id,
        action: "reject",
        rejectionNote: rejectDialog.note,
      }),
    })
    setRejectDialog(null)
    fetchWorkers()
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
          role: "social_worker",
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setInviteResult({ url: data.inviteUrl })
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
    setInviteCompany("")
    setInviteError(null)
    setInviteResult(null)
    setLinkCopied(false)
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Social Workers"
        description={`${total} total registrations`}
        action={
          <Button
          onClick={() => setShowInvite(true)}
        >
          <UserPlus className="size-4" />
          Invite Social Worker
        </Button>
        }
      />

      {/* Filters */}
      <AdminToolbar>
        <div className="relative min-w-0 flex-1 sm:min-w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          className="h-9 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </AdminToolbar>

      {/* Table */}
      <AdminTablePanel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Social Worker</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">License / Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Applied</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                </tr>
              ) : workers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No social workers found</td>
                </tr>
              ) : (
                workers.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UserCheck className="size-4" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{fullName(w)}</div>
                          <div className="text-xs text-muted-foreground">{w.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{w.company_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {w.license_number && <div>Lic: {w.license_number}</div>}
                      {w.job_title && <div>{w.job_title}</div>}
                      {!w.license_number && !w.job_title && "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[w.status]}`}>
                          {w.status}
                        </span>
                        {w.rejection_note && (
                          <div className="mt-0.5 max-w-32 truncate text-xs text-destructive" title={w.rejection_note}>
                            {w.rejection_note}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {w.status !== "approved" && (
                          <button
                            onClick={() => handleApprove(w.id)}
                            title="Approve"
                            className="rounded p-1.5 text-success hover:bg-success/10"
                          >
                            <CheckCircle className="size-4" />
                          </button>
                        )}
                        {w.status !== "rejected" && (
                          <button
                            onClick={() => setRejectDialog({ id: w.id, note: "" })}
                            title="Reject"
                            className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPrevious={() => setPage(p => p - 1)}
          onNext={() => setPage(p => p + 1)}
        />
      </AdminTablePanel>

      {/* Invite Social Worker Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Invite Social Worker</h2>
              </div>
              <button onClick={resetInviteModal} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
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
                      Share this link with the social worker to complete registration.
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
                      {linkCopied
                        ? <CheckCircle className="w-3 h-3 text-emerald-600" />
                        : <Copy className="w-3 h-3" />}
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
                    placeholder="socialworker@agency.org"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company <span className="text-gray-400 font-normal">(optional — can self-select at registration)</span>
                  </label>
                  <select
                    value={inviteCompany}
                    onChange={(e) => setInviteCompany(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No company pre-selected</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    The invited person will register as a social worker and will need admin approval.
                  </p>
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

      {/* Reject dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-foreground">Reject Social Worker</h3>
            <p className="mb-4 text-sm text-muted-foreground">Optionally provide a rejection note for the social worker.</p>
            <textarea
              value={rejectDialog.note}
              onChange={(e) => setRejectDialog({ ...rejectDialog, note: e.target.value })}
              placeholder="Reason for rejection (optional)"
              rows={3}
              className="mb-4 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectDialog(null)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}

export default function AdminSocialWorkersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl py-12 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <AdminSocialWorkersPageInner />
    </Suspense>
  )
}
