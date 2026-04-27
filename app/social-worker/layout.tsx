"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { getSupabaseClient } from "@/lib/supabase/client"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { SWSessionProvider }  from "@/components/collaborative-sessions/FloatingSessionBar"
import { IdleTimeoutGuard } from "@/components/shared/IdleTimeoutGuard"
import {
  LayoutDashboard,
  Users,
  LogOut,
  UserCheck,
  Menu,
  X,
  Clock,
  Video,
} from "lucide-react"
import { SwChatDialog } from "@/components/chat/sw-chat-dialog"

const NAV_LINKS = [
  { href: "/social-worker/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/social-worker/patients",  label: "My Patients", icon: Users },
  { href: "/social-worker/sessions",  label: "Sessions", icon: Video },
]

export default function SocialWorkerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [swStatus, setSwStatus] = useState<"loading" | "approved" | "pending" | "rejected" | "none">("loading")
  const [userEmail, setUserEmail] = useState<string | null>(null)
  // messageBadge removed — SwChatDialog manages its own badge polling

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/auth/login?next=/social-worker/dashboard")
        return
      }
      setUserEmail(data.session.user.email ?? null)

      // Check SW profile status
      const res = await authenticatedFetch("/api/social-worker/profile")
      if (res.ok) {
        const json = await res.json()
        setSwStatus(json.profile?.status ?? "none")
      } else {
        setSwStatus("none")
      }
    })
  }, [router])

  // Badge polling removed — SwChatDialog handles its own unread/request counts

  const handleLogout = async () => {
    await getSupabaseClient().auth.signOut()
    router.replace("/auth/login")
  }

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
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">
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
            Your social worker account application was not approved. Please contact support for more information.
          </p>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <IdleTimeoutGuard />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-slate-800 text-white z-30
          transform transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700">
          <UserCheck className="w-5 h-5 text-blue-400" />
          <div>
            <div className="text-sm font-semibold leading-tight">HealthCompass MA</div>
            <div className="text-xs text-slate-400">Social Worker Portal</div>
          </div>
          <button className="ml-auto lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-3 py-4 flex-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
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
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-700 pt-4">
          {userEmail && <p className="text-xs text-slate-400 px-3 mb-2 truncate">{userEmail}</p>}
          <button
            onClick={handleLogout}
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

      {/* Floating chat dialog — replaces the /messages full-page route */}
      {swStatus === "approved" && <SwChatDialog />}
    </div>
  )
}
