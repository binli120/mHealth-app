/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Handles both OAuth flows Supabase JS v2 may use:
 *   - PKCE  → ?code=... in query params (exchangeCodeForSession)
 *   - Implicit → #access_token=... in hash (auto-detected by client)
 */

"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getSafeAuthNextPath, resolvePostAuthRedirect } from "@/lib/auth/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { ShieldHeartIcon } from "@/lib/icons"
import { Loader2 } from "lucide-react"
import Link from "next/link"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseClient()
    const next = getSafeAuthNextPath(searchParams.get("next"), "/customer/dashboard")
    let redirected = false

    const doRedirect = async (accessToken: string) => {
      if (redirected) return
      redirected = true
      const destination = await resolvePostAuthRedirect(next, accessToken)
      router.push(destination)
      router.refresh()
    }

    // ── PKCE flow ──────────────────────────────────────────────────────────────
    // Supabase returns ?code=... when using PKCE (default in newer versions).
    // We must exchange it for a session explicitly.
    const code = searchParams.get("code")
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error: exchangeError }) => {
          if (exchangeError) {
            setError(exchangeError.message)
            return
          }
          if (data.session) {
            doRedirect(data.session.access_token)
          }
        })
      return
    }

    // ── Implicit flow ──────────────────────────────────────────────────────────
    // Supabase returns #access_token=... in the URL hash.
    // The client auto-detects it; we just wait for the session to appear.

    // Subscribe first so we never miss the SIGNED_IN event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        doRedirect(session.access_token)
      }
    })

    // Also check in case the session was already set before we subscribed.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) doRedirect(session.access_token)
    })

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (!redirected) {
        setError("Sign-in timed out. Please try again.")
      }
    }, 15000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router, searchParams])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">Authentication Failed</h1>
        <p className="mb-6 text-sm text-muted-foreground">{error}</p>
        <Link
          href="/auth/login"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
        <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-primary-foreground" />
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background" />}>
      <CallbackContent />
    </Suspense>
  )
}
