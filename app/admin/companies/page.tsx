"use client"

/**
 * @author Bin Lee
 * @email binlee120@gmail.com
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
        setNppesError(`NPPES API error: ${data.nppesError}`)
      }
    } catch (err) {
      setNppesError(String(err))
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
        setAddError(data.error ?? `Error ${res.status}`)
      }
    } catch (err) {
      setAddError(String(err))
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
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total companies</p>
        </div>
        <button
          onClick={() => setShowAddPanel(!showAddPanel)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add from NPI Registry
          {showAddPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* NPPES search panel */}
      {showAddPanel && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">
            Search NPPES NPI Registry for healthcare organizations
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Organization name (e.g. 'Boston Medical Center')"
              value={nppesQuery}
              onChange={(e) => setNppesQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchNppes()}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={searchNppes}
              disabled={nppesLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {nppesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
          {nppesError && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{nppesError}</p>
          )}
          {nppesResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {nppesResults.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {[r.address, r.city, r.state, r.zip].filter(Boolean).join(", ")}
                      {r.npi && ` · NPI: ${r.npi}`}
                      {r.source === "local" && <span className="ml-1 text-emerald-600 font-medium">✓ Already added</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => void addCompany(r, i)}
                    disabled={addingId === i}
                    className="ml-3 flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {addingId === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
          {nppesSearched && nppesResults.length === 0 && !nppesError && (
            <p className="mt-2 text-xs text-gray-500 text-center py-2">
              No organizations found. Try a different name or fewer words.
            </p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search companies…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email Domain</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SW Count</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No companies found
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-500">
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
                            className="text-xs border border-gray-300 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. agency.org"
                          />
                          <button onClick={saveEmailDomain} className="text-xs text-emerald-600 font-medium hover:underline">Save</button>
                          <button onClick={() => setEditingDomain(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingDomain({ id: c.id, value: c.email_domain ?? "" })}
                          className="text-xs text-gray-500 hover:text-blue-600 hover:underline"
                        >
                          {c.email_domain ?? <span className="italic text-gray-400">Set domain</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.sw_count}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/admin/users?company_id=${c.id}`)}
                          title="View members"
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/admin/users?company_id=${c.id}&invite=1`)}
                          title="Invite member"
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-500"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        {c.status !== "approved" && (
                          <button
                            onClick={() => updateStatus(c.id, "approve")}
                            title="Approve"
                            className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {c.status !== "rejected" && (
                          <button
                            onClick={() => updateStatus(c.id, "reject")}
                            title="Reject"
                            className="p-1.5 rounded hover:bg-red-50 text-red-500"
                          >
                            <XCircle className="w-4 h-4" />
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
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
