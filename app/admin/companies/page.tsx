"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useState, useCallback } from "react"
import {
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Building2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Users,
  UserPlus,
} from "lucide-react"
import { useRouter } from "next/navigation"
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
import type { Company, NppesResult } from "./page.types"
import { STATUS_FILTER_OPTIONS, STATUS_STYLE } from "./page.constants"

export default function AdminCompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  // NPPES add-company panel
  const [nppesQuery, setNppesQuery] = useState("")
  const [nppesResults, setNppesResults] = useState<NppesResult[]>([])
  const [nppesLoading, setNppesLoading] = useState(false)
  const [nppesSearched, setNppesSearched] = useState(false)
  const [nppesError, setNppesError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)

  // Email domain editor
  const [editingDomain, setEditingDomain] = useState<{ id: string; value: string } | null>(null)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(page * PAGE_SIZE))

    const res = await authenticatedFetch(`/api/admin/companies?${params}`)
    const data = await res.json()
    if (data.ok) {
      setCompanies(data.companies)
      setTotal(data.total)
    }
    setLoading(false)
  }, [search, statusFilter, page])

  useEffect(() => {
    const t = setTimeout(fetchCompanies, 300)
    return () => clearTimeout(t)
  }, [fetchCompanies])

  const searchNppes = async () => {
    if (nppesQuery.length < 2) return
    setNppesLoading(true)
    setNppesError(null)
    setNppesSearched(false)
    try {
      const res = await fetch(`/api/companies/search?q=${encodeURIComponent(nppesQuery)}`)
      const data = await res.json()
      setNppesResults(data.results ?? [])
      if (data.nppesError) {
        setNppesError(toUserFacingError(`NPPES API error: ${data.nppesError}`, "Provider search failed."))
      }
    } catch (err) {
      setNppesError(toUserFacingError(err, "Provider search failed."))
    } finally {
      setNppesLoading(false)
      setNppesSearched(true)
    }
  }

  const addCompany = async (r: NppesResult, idx: number) => {
    setAddingId(idx)
    setAddError(null)
    try {
      const res = await authenticatedFetch("/api/admin/companies", {
        method: "POST",
        body: JSON.stringify({
          name: r.name,
          npi: r.npi,
          address: r.address,
          city: r.city,
          state: r.state,
          zip: r.zip,
          phone: r.phone,
          email_domain: r.email_domain,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setShowAddPanel(false)
        setNppesResults([])
        setNppesQuery("")
        fetchCompanies()
      } else {
        setAddError(toUserFacingError(data.error ?? `Error ${res.status}`, "Failed to add company."))
      }
    } catch (err) {
      setAddError(toUserFacingError(err, "Failed to add company."))
    } finally {
      setAddingId(null)
    }
  }

  const updateStatus = async (companyId: string, action: "approve" | "reject") => {
    await authenticatedFetch("/api/admin/companies", {
      method: "PATCH",
      body: JSON.stringify({ companyId, action }),
    })
    fetchCompanies()
  }

  const saveEmailDomain = async () => {
    if (!editingDomain) return
    await authenticatedFetch("/api/admin/companies", {
      method: "PATCH",
      body: JSON.stringify({
        companyId: editingDomain.id,
        action: "set_email_domain",
        emailDomain: editingDomain.value,
      }),
    })
    setEditingDomain(null)
    fetchCompanies()
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Companies"
        description={`${total} total companies`}
        action={
          <Button
          onClick={() => setShowAddPanel(!showAddPanel)}
        >
          <Plus className="size-4" />
          Add from NPI Registry
          {showAddPanel ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </Button>
        }
      />

      {/* NPPES search panel */}
      {showAddPanel && (
        <div className="rounded-lg border bg-primary/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Search NPPES NPI Registry for healthcare organizations
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              placeholder="Organization name (e.g. 'Boston Medical Center')"
              value={nppesQuery}
              onChange={(e) => setNppesQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchNppes()}
              className="h-9 flex-1 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              onClick={searchNppes}
              disabled={nppesLoading}
            >
              {nppesLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Search
            </Button>
          </div>
          {nppesError && (
            <p className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">{nppesError}</p>
          )}
          {nppesResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {nppesResults.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[r.address, r.city, r.state, r.zip].filter(Boolean).join(", ")}
                      {r.npi && ` · NPI: ${r.npi}`}
                      {r.source === "local" && <span className="ml-1 font-medium text-success">Already added</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void addCompany(r, i)}
                    disabled={addingId === i}
                    className="ml-3 shrink-0"
                  >
                    {addingId === i ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
          {nppesSearched && nppesResults.length === 0 && !nppesError && (
            <p className="mt-2 py-2 text-center text-xs text-muted-foreground">
              No organizations found. Try a different name or fewer words.
            </p>
          )}
        </div>
      )}

      {/* Filters */}
      <AdminToolbar>
        <div className="relative min-w-0 flex-1 sm:min-w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search companies..."
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email Domain</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SW Count</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No companies found
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Building2 className="size-4" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[c.city, c.state].filter(Boolean).join(", ")}
                            {c.npi && ` · NPI: ${c.npi}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingDomain?.id === c.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingDomain.value}
                            onChange={(e) => setEditingDomain({ id: c.id, value: e.target.value })}
                            className="w-36 rounded border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="e.g. agency.org"
                          />
                          <button onClick={saveEmailDomain} className="text-xs font-medium text-success hover:underline">Save</button>
                          <button onClick={() => setEditingDomain(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingDomain({ id: c.id, value: c.email_domain ?? "" })}
                          className="text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          {c.email_domain ?? <span className="italic text-muted-foreground">Set domain</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.sw_count}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/admin/users?company_id=${c.id}`)}
                          title="View members"
                          className="rounded p-1.5 text-primary hover:bg-primary/10"
                        >
                          <Users className="size-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/admin/users?company_id=${c.id}&invite=1`)}
                          title="Invite member"
                          className="rounded p-1.5 text-primary hover:bg-primary/10"
                        >
                          <UserPlus className="size-4" />
                        </button>
                        {c.status !== "approved" && (
                          <button
                            onClick={() => updateStatus(c.id, "approve")}
                            title="Approve"
                            className="rounded p-1.5 text-success hover:bg-success/10"
                          >
                            <CheckCircle className="size-4" />
                          </button>
                        )}
                        {c.status !== "rejected" && (
                          <button
                            onClick={() => updateStatus(c.id, "reject")}
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
    </AdminPageShell>
  )
}
