/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Standalone MFA setup page — reached after email-confirmation in production.
 *
 * Flow:
 *   Register → confirm email → /auth/callback?next=/setup-mfa
 *   → (this page) → MFA enrolment → role-based dashboard
 *
 * Layout:
 *   Left column  — step-by-step guide (what to download, how it works)
 *   Right column — MfaEnrollStep card (QR code + code entry)
 */

"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, Loader2, QrCode, ShieldCheck, Smartphone } from "lucide-react"
import Link from "next/link"
import { ShieldHeartIcon } from "@/lib/icons"
import { MfaEnrollStep } from "@/components/auth/MfaEnrollStep"
import { getSafeSupabaseSession, getSupabaseClient } from "@/lib/supabase/client"
import { resolvePostAuthRedirect } from "@/lib/auth/navigation"
import { useHydratedLanguage } from "@/lib/i18n/useHydratedLanguage"
import { getMfaCopy, type MfaCopy } from "@/lib/auth/mfa-copy"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"

// ─── App download links (language-agnostic) ───────────────────────────────────

const APP_LINKS = {
  google: "https://support.google.com/accounts/answer/1066447",
  microsoft: "https://www.microsoft.com/en-us/security/mobile-authenticator-app",
  authy: "https://authy.com/download/",
}

// ─── Step-by-step guide ───────────────────────────────────────────────────────

interface GuideProps {
  copy: MfaCopy
}

function SetupGuide({ copy }: GuideProps) {
  const steps = [
    {
      icon: Smartphone,
      title: copy.guideStep1Title,
      desc: copy.guideStep1Desc,
      extra: (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-foreground">{copy.guideAppLabel}</p>
          <div className="flex flex-col gap-1.5">
            {([
              { label: copy.guideAppGoogle,    href: APP_LINKS.google },
              { label: copy.guideAppMicrosoft, href: APP_LINKS.microsoft },
              { label: copy.guideAppAuthy,     href: APP_LINKS.authy },
            ] as const).map(({ label, href }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Download className="h-3 w-3 shrink-0" />
                {label}
              </a>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: QrCode,
      title: copy.guideStep2Title,
      desc: copy.guideStep2Desc,
      extra: null,
    },
    {
      icon: ShieldCheck,
      title: copy.guideStep3Title,
      desc: copy.guideStep3Desc,
      extra: null,
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-5 text-base font-semibold text-foreground">{copy.guideTitle}</h2>

      <ol className="space-y-5">
        {steps.map(({ icon: Icon, title, desc, extra }, idx) => (
          <li key={idx} className="flex gap-4">
            {/* Step number + icon */}
            <div className="flex flex-col items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              {idx < steps.length - 1 && (
                <div className="mt-1 w-px flex-1 bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="pb-5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {idx + 1}
                </span>
                <p className="text-sm font-semibold text-foreground">{title}</p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              {extra}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Main content ─────────────────────────────────────────────────────────────

function SetupMfaContent() {
  const router = useRouter()
  const language = useHydratedLanguage()
  const copy = useMemo(() => getMfaCopy(language), [language])

  const [friendlyName, setFriendlyName] = useState("")
  const [accessToken, setAccessToken] = useState("")
  // "checking" → validating session + cleaning up stale factors
  // "ready"    → clean; MfaEnrollStep can mount safely
  // "done"     → verified factor already exists; redirect in-progress
  // "no-session" → session missing
  const [pageState, setPageState] = useState<"checking" | "ready" | "done" | "no-session">("checking")

  useEffect(() => {
    const supabase = getSupabaseClient()
    let cancelled = false

    const prepare = async () => {
      const { session } = await getSafeSupabaseSession()

      if (!session) {
        if (!cancelled) setPageState("no-session")
        return
      }

      // Derive the friendly name that MfaEnrollStep will use, so we can
      // clean up any stale factor with that exact name before mounting.
      const meta = session.user.user_metadata as Record<string, unknown>
      const full = [meta.first_name, meta.last_name].filter(Boolean).join(" ")
      const name = (typeof full === "string" && full.trim()) || (session.user.email ?? "")

      // Check existing TOTP factors before showing the enrollment UI.
      const { data: factorList } = await supabase.auth.mfa.listFactors()
      const allFactors = factorList?.all ?? []

      // If the user already has a verified factor → skip setup, go to dashboard.
      const hasVerified = allFactors.some(
        (f) => f.factor_type === "totp" && f.status === "verified",
      )
      if (hasVerified) {
        if (!cancelled) setPageState("done")
        return
      }

      // Unenroll every stale unverified TOTP factor so MfaEnrollStep starts
      // with a clean slate and won't hit "friendly name already exists".
      const stale = allFactors.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )
      await Promise.all(
        stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => undefined)),
      )

      if (cancelled) return
      setAccessToken(session.access_token)
      setFriendlyName(name)
      setPageState("ready")
    }

    void prepare()
    return () => { cancelled = true }
  }, [])

  const handleComplete = async () => {
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

  // Redirect to dashboard once we know a verified factor already exists.
  useEffect(() => {
    if (pageState === "done") void handleComplete()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState])

  if (pageState === "checking" || pageState === "done") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (pageState === "no-session") {
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      {/* Page heading */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{copy.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.pageSubtitle}</p>
      </div>

      {/* Two-column layout: guide on the left, enrollment card on the right */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SetupGuide copy={copy} />

        <div className="flex flex-col gap-4">
          <MfaEnrollStep
            friendlyName={friendlyName}
            language={language}
            onComplete={() => void handleComplete()}
            onCancel={() => void handleCancel()}
          />

          <p className="text-center text-xs text-muted-foreground">
            {copy.pageFootnote}
          </p>
        </div>
      </div>
    </main>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function SetupMfaHeader() {
  const language = useHydratedLanguage()
  const copy = useMemo(() => getMfaCopy(language), [language])

  return (
    <header className="border-b border-border bg-card px-4 py-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <Link
          href="/auth/login"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">{copy.backToLogin}</span>
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
