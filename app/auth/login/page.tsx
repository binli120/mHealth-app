/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

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

/**
 * After a successful Supabase sign-in, pick the right landing dashboard.
 * Requires the JWT access token so the server-side API can authenticate the call.
 */
async function resolveRedirect(explicitNext: string, accessToken: string): Promise<string> {
  // If the user navigated to login with an explicit ?next= (e.g. from a deep link),
  // always honour it — don't override with a role-based redirect.
  if (explicitNext !== "/customer/dashboard") return explicitNext

  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return explicitNext
    const data = (await res.json()) as { roles: string[]; swStatus: string | null }

    if (data.roles.includes("admin")) return "/admin"
    if (data.roles.includes("social_worker"))
      return "/social-worker/dashboard" // layout handles pending/rejected screens
  } catch {
    // Fall through to default
  }
  return explicitNext
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

  const handleGoogleSignIn = async () => {
    setErrorMessage("")
    setIsLoading(true)
    try {
      const supabase = getSupabaseClient()
      await supabase.auth.signOut({ scope: "local" })
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      })
      if (error) setErrorMessage(error.message)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in with Google.")
    } finally {
      setIsLoading(false)
    }
  }

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

      // Clear any stale local session before attempting sign-in.
      // This prevents "Invalid Refresh Token" console errors that appear when
      // localStorage still holds a refresh token from a previous session that
      // is no longer valid server-side (e.g. after a DB reset or long inactivity).
      await supabase.auth.signOut({ scope: "local" })

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

        return { ok: true as const, accessToken: retry.data.session?.access_token ?? "" }
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
              router.push(await resolveRedirect(nextPath, retry.data.session?.access_token ?? ""))
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
            router.push(await resolveRedirect(nextPath, repaired.accessToken))
            router.refresh()
            return
          }

          setErrorMessage(repaired.error || signIn.error.message)
          return
        }

        setErrorMessage(signIn.error.message)
        return
      }

      router.push(await resolveRedirect(nextPath, signIn.data.session?.access_token ?? ""))
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
            <p className="mt-1 text-muted-foreground">Sign in to your HealthCompass MA account</p>
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
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-input"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Sign in with Google
                  </Button>

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
