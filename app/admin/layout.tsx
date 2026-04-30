"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { getSafeSupabaseSession, getSupabaseClient } from "@/lib/supabase/client"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { IdleTimeoutGuard } from "@/components/shared/IdleTimeoutGuard"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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
  BarChart2,
  Download,
  KeyRound,
  Monitor,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

type NavGroup = {
  title: string | null   // null = no section header (top-level)
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: "People & Access",
    items: [
      { href: "/admin/users",          label: "Users",          icon: Users },
      { href: "/admin/companies",      label: "Companies",      icon: Building2 },
      { href: "/admin/social-workers", label: "Social Workers", icon: UserCheck },
      { href: "/admin/roles",          label: "Roles",          icon: KeyRound },
    ],
  },
  {
    title: "Analytics & Reports",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
      { href: "/admin/reports",   label: "Reports",   icon: Download },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/sessions",  label: "Sessions",     icon: Monitor },
      { href: "/admin/phi-audit", label: "PHI Audit Log", icon: ShieldCheck },
    ],
  },
]

type AuthState = "loading" | "unauthenticated" | "not-admin" | "ready"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [granting, setGranting] = useState(false)

  useEffect(() => {
    getSafeSupabaseSession()
      .then(async ({ session }) => {
        if (!session) {
          router.replace("/auth/login?next=/admin")
          return
        }
        setAdminEmail(session.user.email ?? null)

        // Verify admin role by probing the stats endpoint
        const res = await authenticatedFetch("/api/admin/stats")
        if (res.status === 403) {
          setAuthState("not-admin")
        } else {
          setAuthState("ready")
        }
      })
      .catch(() => {
        router.replace("/auth/login?next=/admin")
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
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading...
      </div>
    )
  }

  if (authState === "not-admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 size-10 text-warning" />
          <h2 className="mb-2 text-lg font-semibold text-foreground">Admin Role Required</h2>
          <p className="mb-1 text-sm text-muted-foreground">
            Logged in as: <span className="font-medium text-foreground">{adminEmail}</span>
          </p>
          <p className="mb-6 text-sm text-muted-foreground">
            This account does not have the admin role.
          </p>
          <Button
            onClick={handleGrantAdmin}
            disabled={granting}
            className="mb-3 w-full"
          >
            {granting ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
            Grant Admin Role (Dev Only)
          </Button>
          <Button onClick={handleLogout} variant="ghost" size="sm">
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh bg-background">
      <IdleTimeoutGuard />
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Admin sidebar"
        className={cn(
          "fixed left-0 top-0 z-30 flex h-svh w-72 transform flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 lg:sticky lg:z-auto lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          desktopSidebarOpen ? "lg:translate-x-0" : "lg:hidden",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Shield className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">HealthCompass MA</div>
            <div className="text-xs text-sidebar-foreground/65">Admin Portal</div>
          </div>
          <button
            className="ml-auto rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close admin menu"
          >
            <X className="size-5" />
          </button>
          <button
            className="ml-auto hidden rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:inline-flex"
            onClick={() => setDesktopSidebarOpen(false)}
            aria-label="Hide admin sidebar"
            title="Hide sidebar"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-5" : ""}>
              {group.title && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/45 select-none">
                  {group.title}
                </p>
              )}
              {group.items.map(({ href, label, icon: Icon, exact }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "mb-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(href, exact)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-3 pb-4 pt-4">
          {adminEmail && (
            <p className="mb-2 truncate px-3 text-xs text-sidebar-foreground/55">{adminEmail}</p>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header
          className={cn(
            "sticky top-0 z-10 flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur",
            desktopSidebarOpen ? "lg:hidden" : "lg:flex",
          )}
        >
          <button
            onClick={() => {
              setSidebarOpen(true)
              setDesktopSidebarOpen(true)
            }}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open admin menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Admin Portal</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
