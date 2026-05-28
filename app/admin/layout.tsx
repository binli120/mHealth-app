"use client"

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Admin layout shell.
 *
 * Responsibilities kept here:
 *   • Auth resolution (Supabase session → MFA check → admin role probe)
 *   • Sidebar + mobile-overlay visibility state
 *   • Dev "grant admin" action
 *
 * UI concerns delegated to sub-components:
 *   • AdminAuthGate  — loading / not-admin screens
 *   • AdminSidebar   — nav + MFA enroll + passkey + logout
 *   • (MFA and passkey logic live inside AdminSidebar's sub-components)
 */

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Menu, Shield } from "lucide-react"
import { getSafeSupabaseSession, getSupabaseClient } from "@/lib/supabase/client"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { IdleTimeoutGuard } from "@/components/shared/IdleTimeoutGuard"
import { cn } from "@/lib/utils"
import { AdminAuthGate, type AdminAuthState } from "@/components/admin/admin-auth-gate"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

interface AuthMeResponse {
  ok?: boolean
  roles?: string[]
  email?: string | null
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // ── Auth state ──────────────────────────────────────────────────────────────
  const [authState, setAuthState] = useState<AdminAuthState>("loading")
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [granting, setGranting] = useState(false)
  const [mfaHasFactor, setMfaHasFactor] = useState(false)

  // ── Sidebar visibility ──────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)

  // ── Auth resolution ─────────────────────────────────────────────────────────
  useEffect(() => {
    getSafeSupabaseSession()
      .then(async ({ session }) => {
        if (!session) {
          // Passkey / proxy-auth path: validate via /api/auth/me
          const res = await authenticatedFetch("/api/auth/me", { cache: "no-store" })
          if (!res.ok) {
            router.replace("/auth/login?next=/admin")
            return
          }
          const payload = (await res.json().catch(() => ({}))) as AuthMeResponse
          if (!payload.roles?.includes("admin")) {
            setAuthState("not-admin")
            return
          }
          setAdminEmail(payload.email ?? null)
          setAuthState("ready")
          return
        }

        setAdminEmail(session.user.email ?? null)

        // Enforce MFA challenge if the user has a TOTP factor enrolled.
        const supabase = getSupabaseClient()
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aalData?.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
          router.replace("/auth/mfa?next=/admin")
          return
        }

        // Track whether MFA is already enrolled (for the sidebar button label).
        const { data: factorsData } = await supabase.auth.mfa.listFactors()
        setMfaHasFactor((factorsData?.totp?.length ?? 0) > 0)

        // Verify admin role by probing the stats endpoint.
        const res = await authenticatedFetch("/api/admin/stats")
        if (res.status === 403) {
          const body = (await res.json().catch(() => ({}))) as {
            mfa_required?: boolean
            mfa_enrollment_required?: boolean
          }
          if (body.mfa_enrollment_required) {
            router.replace("/setup-mfa?next=/admin")
            return
          }
          if (body.mfa_required) {
            router.replace("/auth/mfa?next=/admin")
            return
          }
          setAuthState("not-admin")
        } else {
          setAuthState("ready")
        }
      })
      .catch(() => {
        router.replace("/auth/login?next=/admin")
      })
  }, [router])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleGrantAdmin = async () => {
    setGranting(true)
    try {
      const res = await authenticatedFetch("/api/auth/dev-grant-admin", { method: "POST" })
      const data = (await res.json()) as { ok?: boolean }
      if (data.ok) setAuthState("ready")
    } finally {
      setGranting(false)
    }
  }

  const handleLogout = async () => {
    await Promise.allSettled([
      getSupabaseClient().auth.signOut(),
      fetch("/api/auth/passkey/logout", { method: "POST" }),
    ])
    router.replace("/auth/login")
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AdminAuthGate
      authState={authState}
      adminEmail={adminEmail}
      granting={granting}
      onGrantAdmin={() => void handleGrantAdmin()}
      onLogout={() => void handleLogout()}
    >
      <div className="flex min-h-svh bg-background">
        <IdleTimeoutGuard />

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/45 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <AdminSidebar
          adminEmail={adminEmail}
          mfaHasFactor={mfaHasFactor}
          onMfaSuccess={() => setMfaHasFactor(true)}
          onLogout={() => void handleLogout()}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          desktopSidebarOpen={desktopSidebarOpen}
          setDesktopSidebarOpen={setDesktopSidebarOpen}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar — visible only when sidebar is collapsed */}
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

          <main className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthGate>
  )
}
