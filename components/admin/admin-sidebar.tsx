"use client"

/**
 * Admin sidebar: navigation groups, MFA enrollment, passkey registration,
 * and sign-out. All nav/UX state is lifted to AdminLayout; this component is
 * purely presentational aside from the sub-components it composes.
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCheck,
  LogOut,
  Shield,
  X,
  BarChart2,
  Download,
  KeyRound,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminMfaEnrollFlow } from "./admin-mfa-enroll-flow"
import { AdminPasskeyButton } from "./admin-passkey-button"

// ── Nav structure ─────────────────────────────────────────────────────────────

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

type NavGroup = {
  title: string | null // null = no section header
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
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
      { href: "/admin/phi-audit", label: "PHI Audit Log", icon: ShieldCheck },
    ],
  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  adminEmail: string | null
  mfaHasFactor: boolean
  onMfaSuccess: () => void
  onLogout: () => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  desktopSidebarOpen: boolean
  setDesktopSidebarOpen: (open: boolean) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminSidebar({
  adminEmail,
  mfaHasFactor,
  onMfaSuccess,
  onLogout,
  sidebarOpen,
  setSidebarOpen,
  desktopSidebarOpen,
  setDesktopSidebarOpen,
}: Props) {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside
      aria-label="Admin sidebar"
      className={cn(
        "fixed left-0 top-0 z-30 flex h-svh w-72 transform flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 lg:sticky lg:z-auto lg:shadow-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        desktopSidebarOpen ? "lg:translate-x-0" : "lg:hidden",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Shield className="size-5" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">HealthCompass MA</div>
          <div className="text-xs text-sidebar-foreground/65">Admin Portal</div>
        </div>
        {/* Mobile close */}
        <button
          className="ml-auto rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close admin menu"
        >
          <X className="size-5" />
        </button>
        {/* Desktop collapse */}
        <button
          className="ml-auto hidden rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:inline-flex"
          onClick={() => setDesktopSidebarOpen(false)}
          aria-label="Hide admin sidebar"
          title="Hide sidebar"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Navigation */}
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

      {/* Footer: email + MFA + passkey + logout */}
      <div className="border-t border-sidebar-border px-3 pb-4 pt-4">
        {adminEmail && (
          <p className="mb-2 truncate px-3 text-xs text-sidebar-foreground/55">{adminEmail}</p>
        )}
        <AdminMfaEnrollFlow hasFactor={mfaHasFactor} onEnrollSuccess={onMfaSuccess} />
        <AdminPasskeyButton />
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
