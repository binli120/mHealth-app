/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
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
import { ShieldHeartIcon } from "@/lib/icons"
import type { Factor } from "@supabase/supabase-js"

function MFAPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [factors, setFactors] = useState<Factor[]>([])
  const [isLoadingFactors, setIsLoadingFactors] = useState(true)

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
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-card-foreground">Verify Identity</CardTitle>
              <CardDescription>
                Open your authenticator app and enter the current code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingFactors ? (
                <p className="text-center text-sm text-muted-foreground">Loading...</p>
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
