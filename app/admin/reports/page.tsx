"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useState } from "react"
import { Download, FileText, Users, Loader2, CheckCircle } from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

const APPLICATION_STATUSES = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "ai_extracted", label: "AI Extracted" },
  { value: "needs_review", label: "Needs Review" },
  { value: "rfi_requested", label: "RFI Requested" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
]

async function downloadCsv(url: string, filename: string) {
  const res = await authenticatedFetch(url)
  if (!res.ok) throw new Error("Export failed")
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

export default function AdminReportsPage() {
  // Applications export state
  const [appStatus, setAppStatus] = useState("")
  const [appFrom, setAppFrom] = useState("")
  const [appTo, setAppTo] = useState("")
  const [appLoading, setAppLoading] = useState(false)
  const [appDone, setAppDone] = useState(false)
  const [appError, setAppError] = useState("")

  // Users export state
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersDone, setUsersDone] = useState(false)
  const [usersError, setUsersError] = useState("")

  const handleExportApplications = async () => {
    setAppLoading(true)
    setAppDone(false)
    setAppError("")
    try {
      const params = new URLSearchParams({ type: "applications" })
      if (appStatus) params.set("status", appStatus)
      if (appFrom) params.set("from", appFrom)
      if (appTo) params.set("to", appTo + "T23:59:59")
      const filename = `applications-${new Date().toISOString().slice(0, 10)}.csv`
      await downloadCsv(`/api/admin/export?${params}`, filename)
      setAppDone(true)
      setTimeout(() => setAppDone(false), 3000)
    } catch {
      setAppError("Export failed. Please try again.")
    } finally {
      setAppLoading(false)
    }
  }

  const handleExportUsers = async () => {
    setUsersLoading(true)
    setUsersDone(false)
    setUsersError("")
    try {
      const filename = `users-${new Date().toISOString().slice(0, 10)}.csv`
      await downloadCsv("/api/admin/export?type=users", filename)
      setUsersDone(true)
      setTimeout(() => setUsersDone(false), 3000)
    } catch {
      setUsersError("Export failed. Please try again.")
    } finally {
      setUsersLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Exports</h1>
        <p className="text-gray-500 text-sm mt-1">
          Download CSV exports for state reporting and grant documentation
        </p>
      </div>

      <div className="space-y-6">
        {/* Applications export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="bg-blue-50 p-2.5 rounded-lg flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Applications Export</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Applicant details, status, household size, income, FPL%, and program eligibility
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={appStatus}
                onChange={(e) => setAppStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From date</label>
              <input
                type="date"
                value={appFrom}
                onChange={(e) => setAppFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To date</label>
              <input
                type="date"
                value={appTo}
                onChange={(e) => setAppTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {appError && (
            <p className="text-sm text-red-600 mb-3">{appError}</p>
          )}

          <button
            onClick={handleExportApplications}
            disabled={appLoading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {appLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : appDone ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {appLoading ? "Generating…" : appDone ? "Downloaded!" : "Download CSV"}
          </button>
        </div>

        {/* Users export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="bg-purple-50 p-2.5 rounded-lg flex-shrink-0">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Users Export</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                All registered users with name, email, roles, company, and account status
              </p>
            </div>
          </div>

          {usersError && (
            <p className="text-sm text-red-600 mb-3">{usersError}</p>
          )}

          <button
            onClick={handleExportUsers}
            disabled={usersLoading}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {usersLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : usersDone ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {usersLoading ? "Generating…" : usersDone ? "Downloaded!" : "Download CSV"}
          </button>
        </div>

        {/* Columns reference */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Column Reference
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
            <div>
              <p className="font-medium text-gray-700 mb-1">Applications CSV</p>
              <p className="text-gray-500 leading-relaxed">
                id, status, first_name, last_name, email, household_size,
                total_monthly_income, fpl_percentage, estimated_program,
                confidence_score, created_at, submitted_at, decided_at
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">Users CSV</p>
              <p className="text-gray-500 leading-relaxed">
                id, email, first_name, last_name, roles, company_name,
                is_active, created_at
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
