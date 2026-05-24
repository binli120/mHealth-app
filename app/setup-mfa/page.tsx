/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Standalone MFA setup page — reached after email-confirmation in production.
 *
 * Flow:
 *   Register → confirm email → /auth/callback?next=/setup-mfa
 *   → (this page) → MFA enrolment → role-based dashboard
 */

"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { ShieldHeartIcon } from "@/lib/icons"
import { MfaEnrollStep } from "@/components/auth/MfaEnrollStep"
import { getSafeSupabaseSession, getSupabaseClient } from "@/lib/supabase/client"
import { resolvePostAuthRedirect } from "@/lib/auth/navigation"
import { useHydratedLanguage } from "@/lib/i18n/useHydratedLanguage"
import { getMfaCopy } from "@/lib/auth/mfa-copy"

function SetupMfaContent() {
  const router = useRouter()
  const language = useHydratedLanguage()
  const copy = useMemo(() => getMfaCopy(language), [language])

  const [friendlyName, setFriendlyName] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [noSession, setNoSession] = useState(false)

  useEffect(() => {
    getSafeSupabaseSession().then(({ session }) => {
      if (!session) {
        setNoSession(true)
        setIsCheckingSession(false)
        return
      }
      setAccessToken(session.access_token)
      const meta = session.user.user_metadata
      const full = [meta.first_name, meta.last_name].filter(Boolean).join(" ")
      setFriendlyName(full || (session.user.email ?? ""))
      setIsCheckingSession(false)
    })
  }, [])

  const handleComplete = async () => {
    // Determine the right dashboard for this user's role.
    const destination = await resolvePostAuthRedirect(
      "/customer/dashboard",
      accessToken,
    ).catch(() => "/customer/dashboard")
    router.push(destination)
    router.refresh()
  }

  const handleCancel = async () => {
    await getSupabaseClient().auth.signOut({ scope: "local" })
    router.push("/auth/login")
  }

  if (isCheckingSession) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (noSession) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">{copy.sessionExpired}</p>
        <Link
          href="/auth/login"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {copy.goToSignIn}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{copy.pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.pageSubtitle}</p>
        </div>

        <MfaEnrollStep
          friendlyName={friendlyName}
          language={language}
          onComplete={() => void handleComplete()}
          onCancel={() => void handleCancel()}
        />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {copy.pageFootnote}
        </p>
      </div>
    </div>
  )
}

function SetupMfaHeader() {
  const language = useHydratedLanguage()
  const copy = useMemo(() => getMfaCopy(language), [language])

  return (
    <header className="border-b border-border bg-card px-4 py-4">
      <div className="mx-auto flex max-w-7xl items-center gap-4">
        <Link
          href="/auth/login"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">{copy.backToLogin}</span>
        </Link>
      </div>
    </header>
  )
}

export default function SetupMfaPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SetupMfaHeader />

      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        }
      >
        <SetupMfaContent />
      </Suspense>
    </div>
  )
}
