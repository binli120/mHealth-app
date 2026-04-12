"use client"

/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { getSupabaseClient } from "@/lib/supabase/client"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCheck,
  LogOut,
  Shield,
  Menu,
  X,
  AlertCircle,
  Loader2,
  HeartPulse,
  Flag,
  ClipboardList,
  BarChart3,
  Bell,
  Lock,
  FileDown,
} from "lucide-react"

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/companies", label: "Companies", icon: Building2 },
  { href: "/admin/social-workers", label: "Social Workers", icon: UserCheck },
]

const SYSTEM_NAV_LINKS = [
  { href: "/admin/system-health", label: "System Health", icon: HeartPulse },
  { href: "/admin/feature-flags", label: "Feature Flags", icon: Flag },
]

const COMING_SOON_LINKS = [
  { href: "#", label: "Applications", icon: ClipboardList },
  { href: "#", label: "Analytics", icon: BarChart3 },
  { href: "#", label: "Audit Log", icon: Lock },
  { href: "#", label: "Notifications", icon: Bell },
  { href: "#", label: "Reports & Export", icon: FileDown },
]

type AuthState = "loading" | "unauthenticated" | "not-admin" | "ready"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [granting, setGranting] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/auth/login?next=/admin")
        return
      }
      setAdminEmail(data.session.user.email ?? null)

      // Verify admin role by probing the stats endpoint
      const res = await authenticatedFetch("/api/admin/stats")
      if (res.status === 403) {
        setAuthState("not-admin")
      } else {
        setAuthState("ready")
      }
    })
  }, [router])

  const handleGrantAdmin = async () => {
    setGranting(true)
    try {
      const res = await authenticatedFetch("/api/auth/dev-grant-admin", { method: "POST" })
      const data = await res.json()
      if (data.ok) {
        setAuthState("ready")
      }
    } finally {
      setGranting(false)
    }
  }

  const handleLogout = async () => {
    await getSupabaseClient().auth.signOut()
    router.replace("/auth/login")
  }

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (authState === "not-admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-xl border border-amber-200 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Admin Role Required</h2>
          <p className="text-sm text-gray-500 mb-1">
            Logged in as: <span className="font-medium text-gray-700">{adminEmail}</span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            This account does not have the admin role.
          </p>
          <button
            onClick={handleGrantAdmin}
            disabled={granting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mb-3"
          >
            {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Grant Admin Role (Dev Only)
          </button>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-30
          transform transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700">
          <Shield className="w-5 h-5 text-blue-400" />
          <div>
            <div className="text-sm font-semibold leading-tight">HealthCompass MA</div>
            <div className="text-xs text-slate-400">Admin Portal</div>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-3 py-4 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Management</p>
          {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors
                ${isActive(href, exact)
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mt-5 mb-2">System</p>
          {SYSTEM_NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors
                ${isActive(href)
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mt-5 mb-2">Coming Soon</p>
          {COMING_SOON_LINKS.map(({ href, label, icon: Icon }) => (
            <span
              key={label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium text-slate-600 cursor-not-allowed select-none"
              title="Coming soon"
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              <span className="ml-auto text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">soon</span>
            </span>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-700 pt-4">
          {adminEmail && (
            <p className="text-xs text-slate-400 px-3 mb-2 truncate">{adminEmail}</p>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">Admin Portal</span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
