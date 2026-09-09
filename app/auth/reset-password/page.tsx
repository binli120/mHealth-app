/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 *
 * Landing page for the Supabase password-recovery email link.
 *
 * `forgot-password` sends the recovery email with
 *   redirectTo = `${origin}/auth/reset-password`
 * so Supabase appends `#access_token=…&type=recovery` to THIS url. The
 * browser Supabase client (detectSessionInUrl is on by default) consumes
 * that hash on init and emits PASSWORD_RECOVERY / SIGNED_IN — at which
 * point we have a short-lived aal1 session that is only good for
 * `auth.updateUser({ password })`. No current password is required here:
 * the whole point of recovery is that the user does not have one.
 */

"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSafeSupabaseSession, getSupabaseClient } from "@/lib/supabase/client"
import { syncSessionCookie } from "@/lib/supabase/session-cookie"
import { toUserFacingError } from "@/lib/errors/user-facing"
import { ShieldHeartIcon } from "@/lib/icons"

type Phase = "checking" | "ready" | "expired" | "done"

function ResetPasswordContent() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("checking")
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseClient()
    let settled = false

    const markReady = () => {
      if (settled) return
      settled = true
      setPhase("ready")
    }

    // Catch the event the client fires once it has parsed the recovery hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        markReady()
      }
    })

    // The hash may already be consumed by the time this component mounts.
    void getSafeSupabaseSession().then(({ session }) => {
      if (session) {
        markReady()
        return
      }
      // Give detectSessionInUrl a beat, then re-check before giving up.
      setTimeout(() => {
        if (settled) return
        void getSafeSupabaseSession().then(({ session: retry }) => {
          if (settled) return
          if (retry) markReady()
          else {
            settled = true
            setPhase("expired")
          }
        })
      }, 1500)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrorMessage("")

    if (pwNew.length < 8) {
      setErrorMessage("New password must be at least 8 characters.")
      return
    }
    if (pwNew !== pwConfirm) {
      setErrorMessage("Passwords do not match.")
      return
    }

    setIsSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        setPhase("expired")
        return
      }

      const { error } = await supabase.auth.updateUser({ password: pwNew })
      if (error) {
        setErrorMessage(toUserFacingError(error, { fallback: "Unable to update password.", context: "auth" }))
        return
      }

      // proxy.ts gates protected routes on the sb-access-token cookie, not the
      // SDK's local session — sync it before we push into an authed route.
      await syncSessionCookie({ access_token: sessionData.session.access_token })
      setPhase("done")
      setTimeout(() => {
        router.push("/customer/dashboard")
        router.refresh()
      }, 1200)
    } catch (error) {
      setErrorMessage(toUserFacingError(error, { fallback: "Unable to update password.", context: "auth" }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/auth/login" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <span className="text-sm">Back to Sign In</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Choose a new password</h1>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-card-foreground">Reset Password</CardTitle>
              <CardDescription>
                {phase === "expired"
                  ? "This reset link is invalid or has expired."
                  : phase === "done"
                    ? "Password updated. Redirecting…"
                    : "Enter a new password for your account."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {phase === "checking" ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying your reset link…
                </div>
              ) : phase === "expired" ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Request a fresh link and use it within the hour.
                  </p>
                  <Button asChild className="w-full">
                    <Link href="/auth/forgot-password">Request a new link</Link>
                  </Button>
                </div>
              ) : phase === "done" ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing you in…
                </div>
              ) : (
                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pwNew" className="text-foreground">New Password</Label>
                    <div className="relative">
                      <Input
                        id="pwNew"
                        type={showPw ? "text" : "password"}
                        required
                        minLength={8}
                        className="border-input bg-background pr-10 text-foreground"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pwConfirm" className="text-foreground">Confirm New Password</Label>
                    <Input
                      id="pwConfirm"
                      type={showPw ? "text" : "password"}
                      required
                      minLength={8}
                      className="border-input bg-background text-foreground"
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isSaving}
                  >
                    {isSaving ? "Updating…" : "Update Password"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background" />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
