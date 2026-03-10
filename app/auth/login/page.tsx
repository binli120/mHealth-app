"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase/client"
import { isLocalAuthHelperEnabled, normalizeAuthEmail } from "@/lib/auth/local-auth"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"
import { ShieldHeartIcon } from "@/lib/icons"

interface DevAutoConfirmResponse {
  ok?: boolean
  error?: string
}

interface DevRegisterResponse {
  ok?: boolean
  error?: string
}

function getSafeNextPath(nextPath: string | null, fallback: string): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.startsWith("/auth/")) {
    return fallback
  }

  return nextPath
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const nextPath = useMemo(
    () => getSafeNextPath(searchParams.get("next"), "/customer/dashboard"),
    [searchParams],
  )
  const registerHref = useMemo(
    () => `/auth/register?next=${encodeURIComponent(nextPath)}`,
    [nextPath],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage("")
    setIsLoading(true)

    try {
      const supabase = getSupabaseClient()
      const normalizedEmail = normalizeAuthEmail(email)
      const localAuthHelperEnabled = isLocalAuthHelperEnabled()

      if (!normalizedEmail) {
        setErrorMessage("Email is required.")
        return
      }

      const tryDevRepairAndSignIn = async (params: { email: string; password: string }) => {
        if (!localAuthHelperEnabled) {
          return { ok: false as const, error: "Local auth helper is disabled." }
        }

        const registerResponse = await fetch("/api/auth/dev-register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: params.email,
            password: params.password,
            firstName: "Local",
            lastName: "User",
            phone: "",
          }),
        })

        const registerPayload = (await registerResponse.json().catch(() => ({}))) as DevRegisterResponse
        if (!registerResponse.ok || !registerPayload.ok) {
          return {
            ok: false as const,
            error: registerPayload.error || "Unable to repair local account.",
          }
        }

        const retry = await supabase.auth.signInWithPassword({
          email: normalizeAuthEmail(params.email),
          password: params.password,
        })

        if (retry.error) {
          return {
            ok: false as const,
            error: retry.error.message,
          }
        }

        return { ok: true as const }
      }

      const signIn = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (signIn.error) {
        const looksUnconfirmed = /not confirmed|not verified/i.test(signIn.error.message)
        if (localAuthHelperEnabled && looksUnconfirmed) {
          const confirmResponse = await fetch("/api/auth/dev-auto-confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: normalizedEmail }),
          })

          const confirmPayload = (await confirmResponse.json().catch(() => ({}))) as DevAutoConfirmResponse
          if (confirmResponse.ok && confirmPayload.ok) {
            const retry = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            })

            if (!retry.error) {
              router.push(nextPath)
              router.refresh()
              return
            }

            setErrorMessage(retry.error.message)
            return
          }

          setErrorMessage(confirmPayload.error || signIn.error.message)
          return
        }

        if (localAuthHelperEnabled) {
          const repaired = await tryDevRepairAndSignIn({
            email: normalizedEmail,
            password,
          })

          if (repaired.ok) {
            router.push(nextPath)
            router.refresh()
            return
          }

          setErrorMessage(repaired.error || signIn.error.message)
          return
        }

        setErrorMessage(signIn.error.message)
        return
      }

      router.push(nextPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
            <p className="mt-1 text-muted-foreground">Sign in to your MassHealth account</p>
          </div>

          {/* Login Card */}
          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-card-foreground">Sign In</CardTitle>
              <CardDescription>
                Enter your credentials to access your account
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
                    className="border-input bg-background text-foreground"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground">Password</Label>
                    <Link 
                      href="/auth/forgot-password" 
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      required
                      className="border-input bg-background pr-10 text-foreground"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                <Button 
                  type="submit" 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="rounded-lg border border-border bg-secondary/50 p-3">
                    <p className="text-center text-sm text-muted-foreground">
                      Returning user? Enter last 4 digits of SSN
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Input 
                        placeholder="Last 4 of SSN" 
                        maxLength={4}
                        className="border-input bg-background text-center text-foreground"
                      />
                      <Button variant="secondary" className="shrink-0">
                        Verify
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {"Don't have an account? "}
                <Link href={registerHref} className="font-medium text-primary hover:underline">
                  Create one
                </Link>
              </p>
            </CardContent>
          </Card>

          {/* Help Text */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need help? Call <span className="font-medium text-foreground">1-800-841-2900</span>
          </p>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginPageContent />
    </Suspense>
  )
}
