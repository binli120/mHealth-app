/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Mail, Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isLocalAuthHelperEnabled, normalizeAuthEmail } from "@/lib/auth/local-auth"
import { ShieldHeartIcon } from "@/lib/icons"
import { getSupabaseClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const localAuthHelperEnabled = isLocalAuthHelperEnabled()
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")
    setIsSubmitting(true)

    try {
      const normalizedEmail = normalizeAuthEmail(email)
      if (!normalizedEmail) {
        setErrorMessage("Email is required.")
        return
      }

      if (localAuthHelperEnabled) {
        if (newPassword.length < 8) {
          setErrorMessage("Password must be at least 8 characters.")
          return
        }

        if (newPassword !== confirmPassword) {
          setErrorMessage("Passwords do not match.")
          return
        }

        const response = await fetch("/api/auth/dev-reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password: newPassword,
          }),
        })

        const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!response.ok || !payload.ok) {
          setErrorMessage(payload.error || "Unable to reset password.")
          return
        }

        setSuccessMessage("Password updated for local development. You can sign in now.")
        setNewPassword("")
        setConfirmPassword("")
        return
      }

      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      setSuccessMessage("If an account exists for that email, a reset link has been sent.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send reset email.")
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
            <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
            <p className="mt-1 text-muted-foreground">We&apos;ll email you a link to choose a new password.</p>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-card-foreground">Forgot your password?</CardTitle>
              <CardDescription>
                {localAuthHelperEnabled
                  ? "Local development does not send email. Reset the password directly for this account."
                  : "Enter the email address associated with your HealthCompass MA account."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="border-input bg-background text-foreground"
                  />
                </div>

                {localAuthHelperEnabled ? (
                  <>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <div className="flex items-start gap-2">
                        <Wrench className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p>Local auth helpers are enabled, so this flow updates the password immediately instead of sending a reset email.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Enter a new password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="border-input bg-background text-foreground"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Re-enter the new password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="border-input bg-background text-foreground"
                      />
                    </div>
                  </>
                ) : null}

                {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  <Mail className="h-4 w-4" />
                  {localAuthHelperEnabled
                    ? isSubmitting ? "Resetting password..." : "Reset Password"
                    : isSubmitting ? "Sending reset link..." : "Send Reset Link"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
