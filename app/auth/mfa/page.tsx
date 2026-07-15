/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSafeAuthNextPath } from "@/lib/auth/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { syncSessionCookie } from "@/lib/supabase/session-cookie"
import { ShieldHeartIcon } from "@/lib/icons"
import type { Factor } from "@supabase/supabase-js"

// ── Recovery sub-form ────────────────────────────────────────────────────────

function RecoveryForm({ onCancel }: { onCancel: () => void }) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/reset-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string }
      if (!data.ok) {
        setError(data.error ?? "Unable to send email. Please try again.")
        return
      }
      setSent(true)
    } catch {
      setError("Unable to send email. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">Check your inbox</p>
          <p className="mt-1 text-xs text-emerald-700">
            If <span className="font-medium">{email}</span> has an account, you&apos;ll receive a
            link to remove your 2FA. Check your spam folder if it doesn&apos;t arrive.
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={onCancel}>
          Back
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSend(e)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the email address for your account. We&apos;ll send a link that removes your
        two-factor authentication so you can sign in again.
      </p>
      <div className="space-y-2">
        <Label htmlFor="recovery-email" className="text-foreground">
          Email address
        </Label>
        <Input
          id="recovery-email"
          type="email"
          placeholder="you@example.com"
          required
          autoFocus
          autoComplete="email"
          className="border-input bg-background text-foreground"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={isLoading || !email}
      >
        {isLoading ? "Sending…" : "Send reset link"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onCancel} disabled={isLoading}>
        Back to verification
      </Button>
    </form>
  )
}

// ── Main MFA page ─────────────────────────────────────────────────────────────

function MFAPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [factors, setFactors] = useState<Factor[]>([])
  const [isLoadingFactors, setIsLoadingFactors] = useState(true)
  const [showRecovery, setShowRecovery] = useState(false)

  const nextPath = useMemo(
    () => getSafeAuthNextPath(searchParams.get("next"), "/admin"),
    [searchParams],
  )

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.auth.mfa
      .listFactors()
      .then(({ data }) => {
        setFactors(data?.totp ?? [])
      })
      .finally(() => setIsLoadingFactors(false))
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return

    setErrorMessage("")
    setIsLoading(true)

    try {
      const supabase = getSupabaseClient()
      const totpFactor = factors[0]
      if (!totpFactor) {
        setErrorMessage("No authenticator app configured. Set up 2FA in the admin panel first.")
        return
      }

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      })
      if (challengeError || !challenge) {
        setErrorMessage(challengeError?.message ?? "Failed to create MFA challenge.")
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: code.trim(),
      })

      if (verifyError) {
        setErrorMessage("Invalid code. Please try again.")
        return
      }

      // mfa.verify() upgrades the session to aal2 in the client SDK's local
      // storage, but the proxy's auth gate reads the sb-access-token cookie
      // server-side — sync it now or router.refresh() below gets bounced
      // back to /auth/login by proxy.ts, causing a login<->MFA loop.
      const { data: refreshedSession } = await supabase.auth.getSession()
      await syncSessionCookie(refreshedSession.session)

      router.push(nextPath)
      router.refresh()
    } catch {
      setErrorMessage("Unable to verify code. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = async () => {
    await getSupabaseClient().auth.signOut({ scope: "local" })
    router.push("/auth/login")
  }

  const cardTitle = showRecovery ? "Reset Two-Factor Authentication" : "Verify Identity"
  const cardDescription = showRecovery
    ? "We'll email you a link to remove your authenticator."
    : "Open your authenticator app and enter the current code."

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link
            href="/auth/login"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Login</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Two-Factor Authentication</h1>
            <p className="mt-1 text-muted-foreground">
              {showRecovery
                ? "Lost access to your authenticator app?"
                : "Enter the 6-digit code from your authenticator app."}
            </p>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-card-foreground">{cardTitle}</CardTitle>
              <CardDescription>{cardDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingFactors ? (
                <p className="text-center text-sm text-muted-foreground">Loading...</p>
              ) : showRecovery ? (
                <RecoveryForm onCancel={() => setShowRecovery(false)} />
              ) : factors.length === 0 ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">
                      No authenticator app configured. Please set up 2FA in the admin panel first,
                      then sign in again.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleCancel}>
                    Back to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={(e) => void handleVerify(e)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-foreground">
                      Authentication Code
                    </Label>
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      required
                      autoFocus
                      autoComplete="one-time-code"
                      className="border-input bg-background text-center text-2xl tracking-[0.5em] text-foreground"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>
                  {errorMessage ? (
                    <p className="text-sm text-destructive">{errorMessage}</p>
                  ) : null}
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading || code.length !== 6}
                  >
                    {isLoading ? "Verifying..." : "Verify"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => void handleCancel()}
                    disabled={isLoading}
                  >
                    Cancel & Sign Out
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Lost access to your authenticator?{" "}
                    <button
                      type="button"
                      className="underline hover:text-foreground"
                      onClick={() => setShowRecovery(true)}
                    >
                      Reset via email
                    </button>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function MFAPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <MFAPageContent />
    </Suspense>
  )
}
