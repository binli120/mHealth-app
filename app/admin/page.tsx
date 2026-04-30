"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Building2, UserCheck, Users } from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  AdminMetricCard,
  AdminPageHeader,
  AdminPageShell,
  AdminPanel,
  AdminPanelContent,
  AdminPanelHeader,
  AdminPanelTitle,
} from "@/components/admin/admin-ui"
import type { QuickActionProps, Stats } from "./page.types"

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authenticatedFetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setStats(data.stats)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Dashboard"
        description="System overview and quick actions"
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Total Users"
          value={loading ? "—" : String(stats?.totalUsers ?? 0)}
          icon={Users}
          href="/admin/users"
          tone="primary"
        />
        <AdminMetricCard
          label="Pending SW Approvals"
          value={loading ? "—" : String(stats?.pendingSwApprovals ?? 0)}
          icon={UserCheck}
          href="/admin/social-workers?status=pending"
          tone="warning"
          alert={(stats?.pendingSwApprovals ?? 0) > 0}
        />
        <AdminMetricCard
          label="Total Companies"
          value={loading ? "—" : String(stats?.totalCompanies ?? 0)}
          icon={Building2}
          href="/admin/companies"
          tone="success"
        />
        <AdminMetricCard
          label="Pending Companies"
          value={loading ? "—" : String(stats?.pendingCompanies ?? 0)}
          icon={Building2}
          href="/admin/companies?status=pending"
          tone="warning"
          alert={(stats?.pendingCompanies ?? 0) > 0}
        />
      </div>

      {/* Quick actions */}
      <AdminPanel>
        <AdminPanelHeader>
          <AdminPanelTitle>Quick Actions</AdminPanelTitle>
        </AdminPanelHeader>
        <AdminPanelContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction href="/admin/social-workers?status=pending" label="Review Pending Social Workers" />
          <QuickAction href="/admin/companies?status=pending" label="Approve Pending Companies" />
          <QuickAction href="/admin/users" label="Manage All Users" />
        </div>
        </AdminPanelContent>
      </AdminPanel>
    </AdminPageShell>
  )
}

function QuickAction({ href, label }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-14 items-center justify-between rounded-lg border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
    >
      {label}
      <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" />
    </Link>
  )
}
