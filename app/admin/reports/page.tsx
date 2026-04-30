"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useState } from "react"
import { Download, FileText, Users, Loader2, CheckCircle } from "lucide-react"
import { APPLICATION_STATUS_FILTER_OPTIONS } from "@/lib/application-status"
import {
  AdminPageHeader,
  AdminPageShell,
  AdminPanel,
  AdminPanelContent,
  AdminPanelHeader,
  AdminPanelTitle,
} from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { downloadCsv } from "./page.utils"

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
    <AdminPageShell size="narrow">
      <AdminPageHeader
        title="Reports & Exports"
        description="Download CSV exports for state reporting and grant documentation"
      />

      <div className="space-y-6">
        {/* Applications export */}
        <AdminPanel>
          <AdminPanelHeader>
            <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-md bg-primary/10 p-2.5 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <AdminPanelTitle>Applications Export</AdminPanelTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Applicant details, status, household size, income, FPL%, and program eligibility
              </p>
            </div>
          </div>
          </AdminPanelHeader>

          <AdminPanelContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={appStatus}
                onChange={(e) => setAppStatus(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {APPLICATION_STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">From date</label>
              <input
                type="date"
                value={appFrom}
                onChange={(e) => setAppFrom(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">To date</label>
              <input
                type="date"
                value={appTo}
                onChange={(e) => setAppTo(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {appError && (
            <p className="mb-3 text-sm text-destructive">{appError}</p>
          )}

          <Button
            onClick={handleExportApplications}
            disabled={appLoading}
          >
            {appLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : appDone ? (
              <CheckCircle className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
            {appLoading ? "Generating..." : appDone ? "Downloaded!" : "Download CSV"}
          </Button>
          </AdminPanelContent>
        </AdminPanel>

        {/* Users export */}
        <AdminPanel>
          <AdminPanelHeader>
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-md bg-accent/10 p-2.5 text-accent">
              <Users className="size-5" />
            </div>
            <div>
              <AdminPanelTitle>Users Export</AdminPanelTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                All registered users with name, email, roles, company, and account status
              </p>
            </div>
          </div>
          </AdminPanelHeader>

          <AdminPanelContent>
          {usersError && (
            <p className="mb-3 text-sm text-destructive">{usersError}</p>
          )}

          <Button
            onClick={handleExportUsers}
            disabled={usersLoading}
          >
            {usersLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : usersDone ? (
              <CheckCircle className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
            {usersLoading ? "Generating..." : usersDone ? "Downloaded!" : "Download CSV"}
          </Button>
          </AdminPanelContent>
        </AdminPanel>

        {/* Columns reference */}
        <div className="rounded-lg border bg-muted/30 p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Column Reference
          </h3>
          <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <p className="mb-1 font-medium text-foreground">Applications CSV</p>
              <p className="leading-relaxed">
                id, status, first_name, last_name, email, household_size,
                total_monthly_income, fpl_percentage, estimated_program,
                confidence_score, created_at, submitted_at, decided_at
              </p>
            </div>
            <div>
              <p className="mb-1 font-medium text-foreground">Users CSV</p>
              <p className="leading-relaxed">
                id, email, first_name, last_name, roles, company_name,
                is_active, created_at
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminPageShell>
  )
}
