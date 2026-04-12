/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShieldHeartIcon } from "@/lib/icons"
import { getSupabaseClient } from "@/lib/supabase/client"

type RecoveryState = "loading" | "ready" | "invalid" | "success"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("loading")

  useEffect(() => {
    const supabase = getSupabaseClient()
    const code = searchParams.get("code")
    let isMounted = true

    const markReadyIfMounted = () => {
      if (isMounted) {
        setRecoveryState("ready")
      }
    }

    const markInvalidIfMounted = () => {
      if (isMounted) {
        setRecoveryState("invalid")
      }
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error || !data.session) {
            markInvalidIfMounted()
            return
          }

          markReadyIfMounted()
        })
      return () => {
        isMounted = false
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return
      }

      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryState("ready")
      }
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return
      }

      if (error || !data.session) {
        setRecoveryState("invalid")
        return
      }

      setRecoveryState("ready")
    })

    const timeout = window.setTimeout(() => {
      if (isMounted) {
        setRecoveryState((currentState) => currentState === "loading" ? "invalid" : currentState)
      }
    }, 5000)

    return () => {
      isMounted = false
      subscription.unsubscribe()
      window.clearTimeout(timeout)
    }
  }, [searchParams])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage("")

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      await supabase.auth.signOut()
      setRecoveryState("success")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update password.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/auth/login" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
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
            <h1 className="text-2xl font-bold text-foreground">Choose a New Password</h1>
            <p className="mt-1 text-muted-foreground">Complete password recovery and return to sign-in.</p>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-card-foreground">Update Password</CardTitle>
              <CardDescription>
                Use a password with at least 8 characters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recoveryState === "loading" ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating recovery link...
                </div>
              ) : null}

              {recoveryState === "invalid" ? (
                <div className="space-y-4 py-2">
                  <p className="text-sm text-destructive">
                    This recovery link is invalid or has expired. Request a new password reset email.
                  </p>
                  <Button asChild className="w-full">
                    <Link href="/auth/forgot-password">Request New Reset Link</Link>
                  </Button>
                </div>
              ) : null}

              {recoveryState === "success" ? (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <p className="text-sm">Your password has been updated.</p>
                  </div>
                  <Button asChild className="w-full">
                    <Link href="/auth/login">Return to Sign In</Link>
                  </Button>
                </div>
              ) : null}

              {recoveryState === "ready" ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter a new password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="border-input bg-background text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Re-enter your new password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="border-input bg-background text-foreground"
                    />
                  </div>

                  {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Updating password..." : "Update Password"}
                  </Button>
                </form>
              ) : null}
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
