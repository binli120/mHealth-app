"use client"

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { getSafeSupabaseSession, getSupabaseClient } from "@/lib/supabase/client"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { SWSessionProvider } from "@/components/collaborative-sessions/FloatingSessionBar"
import { IdleTimeoutGuard } from "@/components/shared/IdleTimeoutGuard"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Users,
  LogOut,
  UserCheck,
  Menu,
  X,
  Clock,
  Video,
  MessageSquare,
  UserPlus,
  ShieldCheck,
  ShieldPlus,
  Check,
} from "lucide-react"
import { SwChatDialog } from "@/components/chat/sw-chat-dialog"
import { CUSTOMER_SUPPORT_EMAIL, CUSTOMER_SUPPORT_MAILTO } from "@/lib/support/contact"

const NAV_LINKS = [
  { href: "/social-worker/dashboard", label: "Dashboard",   icon: LayoutDashboard },
  { href: "/social-worker/patients",  label: "My Patients", icon: Users },
  { href: "/social-worker/messages",  label: "Messages",    icon: MessageSquare },
  { href: "/social-worker/sessions",  label: "Sessions",    icon: Video },
]

type MfaSetupStep = "idle" | "qr" | "verifying"

interface MfaEnrollData {
  factorId: string
  qrCode: string
  secret: string
}

export default function SocialWorkerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [swStatus, setSwStatus] = useState<"loading" | "approved" | "pending" | "rejected" | "none">("loading")
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [pendingInvitations, setPendingInvitations] = useState(0)
  const [acceptingPatients, setAcceptingPatients] = useState(true)
  const [togglingAccepting, setTogglingAccepting] = useState(false)

  // 2FA state
  const [mfaHasFactor, setMfaHasFactor] = useState(false)
  const [mfaSetupStep, setMfaSetupStep] = useState<MfaSetupStep>("idle")
  const [mfaEnrollData, setMfaEnrollData] = useState<MfaEnrollData | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const [mfaError, setMfaError] = useState("")

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    getSafeSupabaseSession()
      .then(async ({ session }) => {
        if (!session) {
          router.replace("/auth/login?next=/social-worker/dashboard")
          return
        }
        setUserEmail(session.user.email ?? null)

        // Block admin accounts — they have their own portal.
        const meRes = await authenticatedFetch("/api/auth/me", { cache: "no-store" })
        if (meRes.ok) {
          const meData = (await meRes.json()) as { roles?: string[] }
          if (meData.roles?.includes("admin")) {
            router.replace("/admin")
            return
          }
        }

        // Enforce MFA: if the SW has a TOTP factor enrolled but hasn't verified
        // it this session (aal1 → aal2 upgrade needed), redirect to the MFA page.
        const supabase = getSupabaseClient()
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aalData?.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
          router.replace("/auth/mfa?next=/social-worker/dashboard")
          return
        }

        // Track whether the SW already has 2FA set up.
        const { data: factorsData } = await supabase.auth.mfa.listFactors()
        setMfaHasFactor((factorsData?.totp?.length ?? 0) > 0)

        // Check SW profile status.
        const res = await authenticatedFetch("/api/social-worker/profile")
        if (res.ok) {
          const json = (await res.json()) as { profile?: { status: string; accepting_patients?: boolean } }
          const status = json.profile?.status ?? "none"
          setSwStatus(status as typeof swStatus)
          setAcceptingPatients(json.profile?.accepting_patients ?? true)

          // Start polling pending invitations once approved.
          if (status === "approved") {
            const fetchPending = async () => {
              try {
                const r = await authenticatedFetch("/api/social-worker/engagement-requests")
                if (r.ok) {
                  const d = (await r.json()) as { requests?: unknown[] }
                  setPendingInvitations(d.requests?.length ?? 0)
                }
              } catch { /* non-critical */ }
            }
            await fetchPending()
            pollRef.current = setInterval(() => void fetchPending(), 30_000)
          }
        } else {
          setSwStatus("none")
        }
      })
      .catch(() => {
        router.replace("/auth/login?next=/social-worker/dashboard")
      })

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [router])

  // ── Accepting-patients toggle ────────────────────────────────────────────────

  const handleToggleAccepting = async () => {
    const next = !acceptingPatients
    setTogglingAccepting(true)
    try {
      const res = await authenticatedFetch("/api/social-worker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepting_patients: next }),
      })
      if (res.ok) setAcceptingPatients(next)
    } catch { /* non-critical */ } finally {
      setTogglingAccepting(false)
    }
  }

  // ── 2FA enrollment handlers ──────────────────────────────────────────────────

  const handleSetupMfa = async () => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Social Worker 2FA",
    })
    if (error || !data) {
      setMfaError(error?.message ?? "Failed to start 2FA setup.")
      return
    }
    setMfaEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setMfaCode("")
    setMfaError("")
    setMfaSetupStep("qr")
  }

  const handleVerifyMfaEnrollment = async () => {
    if (!mfaEnrollData || mfaCode.length !== 6) return
    setMfaSetupStep("verifying")

    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaEnrollData.factorId,
      code: mfaCode,
    })

    if (error) {
      setMfaError("Invalid code. Please try again.")
      setMfaSetupStep("qr")
      return
    }

    setMfaHasFactor(true)
    setMfaSetupStep("idle")
    setMfaEnrollData(null)
    setMfaCode("")
    setMfaError("")
  }

  const cancelMfaSetup = () => {
    setMfaSetupStep("idle")
    setMfaEnrollData(null)
    setMfaCode("")
    setMfaError("")
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    if (pollRef.current) clearInterval(pollRef.current)
    await getSupabaseClient().auth.signOut()
    router.replace("/auth/login")
  }

  // ── Status screens ───────────────────────────────────────────────────────────

  if (swStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  if (swStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-amber-200 p-8 text-center">
          <Clock className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Pending Approval</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your social worker account is under review. You&apos;ll be notified by email once an admin approves your account.
          </p>
          <button onClick={() => void handleLogout()} className="text-sm text-gray-400 hover:text-gray-600">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (swStatus === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-red-200 p-8 text-center">
          <UserCheck className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Not Approved</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your social worker account application was not approved. Email{" "}
            <a href={CUSTOMER_SUPPORT_MAILTO} className="font-medium text-gray-700 hover:underline">
              {CUSTOMER_SUPPORT_EMAIL}
            </a>{" "}
            for more information.
          </p>
          <button onClick={() => void handleLogout()} className="text-sm text-gray-400 hover:text-gray-600">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (swStatus === "none") {
    router.replace("/auth/register")
    return null
  }

  const isActive = (href: string) => pathname.startsWith(href)

  // Hide the floating chat dialog on the dedicated messages page to avoid duplication.
  const showFloatingChat = !pathname.startsWith("/social-worker/messages")

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <IdleTimeoutGuard />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — sticky on desktop so it always spans the full viewport height */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-64 bg-slate-800 text-white z-30
          flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:sticky lg:translate-x-0 lg:z-auto
        `}
      >
        {/* Brand header */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700 shrink-0">
          <UserCheck className="w-5 h-5 text-blue-400" />
          <div>
            <div className="text-sm font-semibold leading-tight">HealthCompass MA</div>
            <div className="text-xs text-slate-400">Social Worker Portal</div>
          </div>
          <button className="ml-auto lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav — flex-1 pushes footer to bottom */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const badge = href === "/social-worker/messages" && pendingInvitations > 0
              ? pendingInvitations
              : null

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors
                  ${isActive(href)
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {badge !== null && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer — anchored at bottom */}
        <div className="shrink-0 border-t border-slate-700 px-3 pt-4 pb-4 space-y-2">
          {userEmail && <p className="text-xs text-slate-400 px-3 truncate">{userEmail}</p>}

          {/* ── 2FA enrollment panel ─────────────────────────────────────── */}
          {mfaSetupStep === "qr" && mfaEnrollData ? (
            <div className="rounded-lg bg-slate-700 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-200">Scan with your authenticator app</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mfaEnrollData.qrCode} alt="2FA QR code" className="w-full rounded bg-white p-1" />
              <p className="text-[10px] text-slate-400 break-all">
                Manual key: <span className="font-mono">{mfaEnrollData.secret}</span>
              </p>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit code"
                className="h-8 text-center tracking-widest bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
              {mfaError && <p className="text-xs text-red-400">{mfaError}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={mfaCode.length !== 6}
                  onClick={() => void handleVerifyMfaEnrollment()}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-slate-400 hover:text-white"
                  onClick={cancelMfaSetup}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void (mfaHasFactor ? undefined : handleSetupMfa())}
              disabled={mfaHasFactor}
              className={`
                flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${mfaHasFactor
                  ? "text-emerald-400 cursor-default"
                  : "text-slate-400 hover:bg-slate-700 hover:text-white"
                }
              `}
              title={mfaHasFactor ? "Two-factor authentication is enabled" : "Set up two-factor authentication"}
            >
              {mfaHasFactor
                ? <ShieldCheck className="w-4 h-4 shrink-0" />
                : <ShieldPlus className="w-4 h-4 shrink-0" />
              }
              <span className="flex-1 text-left">
                {mfaHasFactor ? "2FA Enabled" : "Set up 2FA"}
              </span>
              {mfaHasFactor && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          )}

          {/* ── Accepting patients toggle ─────────────────────────────────── */}
          <button
            type="button"
            onClick={() => void handleToggleAccepting()}
            disabled={togglingAccepting}
            className={`
              flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${acceptingPatients
                ? "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
              }
              disabled:opacity-60
            `}
            title={acceptingPatients ? "You are visible to patients — click to stop accepting" : "You are hidden from patients — click to start accepting"}
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">
              {acceptingPatients ? "Accepting Patients" : "Not Accepting"}
            </span>
            <span className={`
              inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent px-0.5 transition-colors
              ${acceptingPatients ? "bg-emerald-500 justify-end" : "bg-slate-600 justify-start"}
            `}>
              <span className="h-3.5 w-3.5 rounded-full bg-white shadow-sm" />
            </span>
          </button>

          {/* ── Sign out ─────────────────────────────────────────────────── */}
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-700">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">Social Worker Portal</span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <SWSessionProvider>{children}</SWSessionProvider>
        </main>
      </div>

      {showFloatingChat && <SwChatDialog />}
    </div>
  )
}
