"use client"

/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Building2, UserCheck, AlertCircle, ArrowRight } from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

interface Stats {
  totalUsers: number
  pendingSwApprovals: number
  totalCompanies: number
  pendingCompanies: number
}

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
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">System overview and quick actions</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Users"
          value={loading ? "—" : String(stats?.totalUsers ?? 0)}
          icon={<Users className="w-5 h-5 text-blue-500" />}
          href="/admin/users"
          bg="bg-blue-50"
        />
        <StatCard
          label="Pending SW Approvals"
          value={loading ? "—" : String(stats?.pendingSwApprovals ?? 0)}
          icon={<UserCheck className="w-5 h-5 text-amber-500" />}
          href="/admin/social-workers?status=pending"
          bg="bg-amber-50"
          alert={(stats?.pendingSwApprovals ?? 0) > 0}
        />
        <StatCard
          label="Total Companies"
          value={loading ? "—" : String(stats?.totalCompanies ?? 0)}
          icon={<Building2 className="w-5 h-5 text-emerald-500" />}
          href="/admin/companies"
          bg="bg-emerald-50"
        />
        <StatCard
          label="Pending Companies"
          value={loading ? "—" : String(stats?.pendingCompanies ?? 0)}
          icon={<Building2 className="w-5 h-5 text-orange-500" />}
          href="/admin/companies?status=pending"
          bg="bg-orange-50"
          alert={(stats?.pendingCompanies ?? 0) > 0}
        />
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction href="/admin/social-workers?status=pending" label="Review Pending Social Workers" />
          <QuickAction href="/admin/companies?status=pending" label="Approve Pending Companies" />
          <QuickAction href="/admin/users" label="Manage All Users" />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  href,
  bg,
  alert,
}: {
  label: string
  value: string
  icon: React.ReactNode
  href: string
  bg: string
  alert?: boolean
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow group"
    >
      <div className={`${bg} p-2.5 rounded-lg`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 flex items-center gap-1.5">
          {value}
          {alert && <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
        </div>
        <div className="text-xs text-gray-500 truncate">{label}</div>
      </div>
    </Link>
  )
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group text-sm font-medium text-gray-700"
    >
      {label}
      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
    </Link>
  )
}
