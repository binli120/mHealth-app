/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase/client"
import { ShieldHeartIcon } from "@/lib/icons"

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get("code")
  const missingCodeError = "Invalid or missing reset link. Please request a new one."
  const [status, setStatus] = useState<"loading" | "success" | "error">(code ? "loading" : "error")
  const [errorMsg, setErrorMsg] = useState("")
  const displayError = errorMsg || missingCodeError

  useEffect(() => {
    if (!code) {
      return
    }

    const run = async () => {
      const supabase = getSupabaseClient()

      // Exchange PKCE code for a session (proves email ownership).
      const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeErr || !data.session) {
        setErrorMsg("Reset link is invalid or has expired. Please request a new one.")
        setStatus("error")
        return
      }

      // Call server-side API to unenroll all TOTP factors and sign out.
      const res = await fetch("/api/auth/reset-mfa/confirm", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })
      const json = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string }

      if (!json.ok) {
        setErrorMsg(json.error ?? "Unable to reset 2FA. Please try again or contact support.")
        setStatus("error")
        return
      }

      // Sign out locally and redirect to login with success indicator.
      await supabase.auth.signOut({ scope: "local" })
      setStatus("success")
      setTimeout(() => router.push("/auth/login?notice=2fa-reset"), 2500)
    }

    void run()
  }, [code, router])

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying and removing 2FA…</p>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Two-factor authentication removed</h2>
        <p className="text-sm text-muted-foreground">
          You can now sign in with just your password. You&apos;ll be redirected to login shortly.
        </p>
        <Button asChild>
          <Link href="/auth/login">Go to Sign In</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Reset failed</h2>
      <p className="text-sm text-muted-foreground">{displayError}</p>
      <Button asChild variant="outline">
        <Link href="/auth/mfa">Back</Link>
      </Button>
    </div>
  )
}

export default function ResetMfaConfirmPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/auth/login" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <span className="text-sm">← Back to Sign In</span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
          <ConfirmContent />
        </Suspense>
      </main>
    </div>
  )
}
