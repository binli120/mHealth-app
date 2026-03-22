"use client"

/**
 * /auth/invite/[token]
 * Accept an admin invitation: user sets their name + password, then is redirected to login.
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Building2, CheckCircle, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react"

interface InvitationInfo {
  email: string
  company_id: string | null
  company_name: string | null
  role: string
  expires_at: string
}

type PageState = "loading" | "ready" | "invalid" | "submitting" | "done"

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token

  const [pageState, setPageState] = useState<PageState>("loading")
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      const res = await fetch(`/api/auth/invite/${token}`)
      const data = await res.json()
      if (data.ok) {
        setInvitation(data.invitation)
        setPageState("ready")
      } else {
        setErrorMsg(data.error ?? "Invalid invitation.")
        setPageState("invalid")
      }
    }
    void verify()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.")
      return
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.")
      return
    }
    setErrorMsg(null)
    setPageState("submitting")

    const res = await fetch(`/api/auth/invite/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, password }),
    })
    const data = await res.json()
    if (data.ok) {
      setPageState("done")
    } else {
      setErrorMsg(data.error ?? "Failed to create account.")
      setPageState("ready")
    }
  }

  const roleLabel: Record<string, string> = {
    applicant: "Applicant",
    social_worker: "Social Worker",
    reviewer: "Reviewer",
    admin: "Admin",
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // ── Invalid / expired ──────────────────────────────────────────────────────
  if (pageState === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation Invalid</h1>
          <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
          <a
            href="/auth/login"
            className="inline-block text-sm text-blue-600 font-medium hover:underline"
          >
            Back to login
          </a>
        </div>
      </div>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (pageState === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your account has been set up. You can now sign in with your email and password.
          </p>
          <button
            onClick={() => router.push("/auth/login")}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-4">
            <Building2 className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Accept Invitation</h1>
          <p className="text-gray-500 text-sm mt-1">
            You&apos;ve been invited to join HealthCompass MA
          </p>
        </div>

        {/* Invitation details */}
        {invitation && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm">
            <div className="text-blue-900 font-medium mb-1">Invitation details</div>
            <div className="text-blue-700 space-y-0.5">
              <div><span className="text-blue-500">Email:</span> {invitation.email}</div>
              {invitation.company_name && (
                <div><span className="text-blue-500">Company:</span> {invitation.company_name}</div>
              )}
              <div>
                <span className="text-blue-500">Role:</span>{" "}
                {roleLabel[invitation.role] ?? invitation.role}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={invitation?.email ?? ""}
              disabled
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-gray-400 font-normal">(min. 8 characters)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Create a strong password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat your password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={pageState === "submitting"}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {pageState === "submitting" && <Loader2 className="w-4 h-4 animate-spin" />}
            {pageState === "submitting" ? "Creating account…" : "Create Account"}
          </button>

          <p className="text-center text-xs text-gray-400">
            Already have an account?{" "}
            <a href="/auth/login" className="text-blue-600 hover:underline">Sign in</a>
          </p>
        </form>
      </div>
    </div>
  )
}
