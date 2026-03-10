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
import { formatPhoneNumber } from "@/lib/utils/input-format"
import { Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react"
import { ShieldHeartIcon } from "@/lib/icons"

type RegisterStep = "form" | "verify"

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

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<RegisterStep>("form")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const nextPath = useMemo(
    () => getSafeNextPath(searchParams.get("next"), "/application/type"),
    [searchParams],
  )
  const loginHref = useMemo(
    () => `/auth/login?next=${encodeURIComponent(nextPath)}`,
    [nextPath],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage("")
    setInfoMessage("")
    const normalizedEmail = normalizeAuthEmail(email)
    const localAuthHelperEnabled = isLocalAuthHelperEnabled()

    if (!normalizedEmail) {
      setErrorMessage("Email is required.")
      return
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.")
      return
    }

    setIsLoading(true)

    try {
      const supabase = getSupabaseClient()

      const tryDevRegisterAndSignIn = async (params: {
        email: string
        password: string
        firstName: string
        lastName: string
        phone: string
      }) => {
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
            firstName: params.firstName,
            lastName: params.lastName,
            phone: params.phone,
          }),
        })

        const registerPayload = (await registerResponse.json().catch(() => ({}))) as DevRegisterResponse
        if (!registerResponse.ok || !registerPayload.ok) {
          return {
            ok: false as const,
            error: registerPayload.error || "Unable to create local account in development mode.",
          }
        }

        const signInResult = await supabase.auth.signInWithPassword({
          email: normalizeAuthEmail(params.email),
          password: params.password,
        })
        if (signInResult.error) {
          return {
            ok: false as const,
            error: signInResult.error.message,
          }
        }

        return { ok: true as const }
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone,
          },
        },
      })

      if (error) {
        if (localAuthHelperEnabled) {
          const recovered = await tryDevRegisterAndSignIn({
            email: normalizedEmail,
            password,
            firstName,
            lastName,
            phone,
          })

          if (recovered.ok) {
            router.push(nextPath)
            return
          }

          setErrorMessage(recovered.error || error.message)
          return
        }

        setErrorMessage(error.message)
        return
      }

      const looksLikeExistingUser =
        Array.isArray(data.user?.identities) && data.user.identities.length === 0

      if (looksLikeExistingUser) {
        if (localAuthHelperEnabled) {
          const recovered = await tryDevRegisterAndSignIn({
            email: normalizedEmail,
            password,
            firstName,
            lastName,
            phone,
          })

          if (recovered.ok) {
            router.push(nextPath)
            return
          }

          setErrorMessage(recovered.error || "An account with this email already exists. Please sign in instead.")
          return
        }

        setErrorMessage("An account with this email already exists. Please sign in instead.")
        return
      }

      if (!data.user?.id) {
        setErrorMessage("Sign-up did not return a user record. Please try again.")
        return
      }

      if (data.session) {
        router.push(nextPath)
        return
      }

      // Local development fallback: auto-confirm email and sign in.
      if (localAuthHelperEnabled) {
        const recovered = await tryDevRegisterAndSignIn({
          email: normalizedEmail,
          password,
          firstName,
          lastName,
          phone,
        })

        if (recovered.ok) {
          router.push(nextPath)
          return
        }

        setErrorMessage(recovered.error || "Local auto-confirm failed.")
        return
      }

      setStep("verify")
      setInfoMessage("Account created. Please check your email for a confirmation link.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Registration failed.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setErrorMessage("")
    setInfoMessage("")
    setIsLoading(true)

    try {
      const supabase = getSupabaseClient()
      const normalizedEmail = normalizeAuthEmail(email)
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
      })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      setInfoMessage("Confirmation email resent.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to resend confirmation email.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
            <p className="mt-1 text-muted-foreground">Start your MassHealth application</p>
          </div>

          {step === "form" ? (
            <Card className="border-border bg-card">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl text-card-foreground">Account Information</CardTitle>
                <CardDescription>Create an account to save your progress</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-foreground">
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        required
                        className="border-input bg-background text-foreground"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-foreground">
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        required
                        className="border-input bg-background text-foreground"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      className="border-input bg-background text-foreground"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555)123-4567"
                      required
                      className="border-input bg-background text-foreground"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                      maxLength={13}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">
                      Create Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        required
                        className="border-input bg-background pr-10 text-foreground"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      At least 8 characters with a number and special character
                    </p>
                  </div>

                  {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                  {infoMessage ? <p className="text-sm text-accent">{infoMessage}</p> : null}

                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href={loginHref} className="font-medium text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card">
              <CardHeader className="space-y-1 pb-4">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <CheckCircle2 className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-center text-xl text-card-foreground">Verify Your Email</CardTitle>
                <CardDescription className="text-center">
                  We sent a confirmation link to <span className="font-medium">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                {infoMessage ? <p className="text-sm text-accent">{infoMessage}</p> : null}

                <Button
                  type="button"
                  onClick={handleResend}
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Resend Confirmation Email"}
                </Button>
                <Link href={loginHref} className="block">
                  <Button type="button" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Go to Sign In
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need help? Call <span className="font-medium text-foreground">1-800-841-2900</span>
          </p>
        </div>
      </main>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterPageContent />
    </Suspense>
  )
}
