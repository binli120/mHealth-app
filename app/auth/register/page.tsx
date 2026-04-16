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
import { getSafeAuthNextPath } from "@/lib/auth/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { isLocalAuthHelperEnabled, normalizeAuthEmail } from "@/lib/auth/local-auth"
import { toUserFacingError } from "@/lib/errors/user-facing"
import { formatPhoneNumber } from "@/lib/utils/input-format"
import {
  Eye, EyeOff, ArrowLeft, CheckCircle2,
  UserRound, UserCheck, Search, Building2, Loader2,
} from "lucide-react"
import { ShieldHeartIcon } from "@/lib/icons"
import type { RegisterStep, AccountRole, CompanyResult, DevRegisterResponse } from "./page.types"

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<RegisterStep>("role-select")
  const [role, setRole] = useState<AccountRole>("applicant")

  // Form fields
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [infoMessage, setInfoMessage] = useState("")

  // Social worker fields
  const [swCompany, setSwCompany] = useState<CompanyResult | null>(null)
  const [swLicense, setSwLicense] = useState("")
  const [swJobTitle, setSwJobTitle] = useState("")

  // Company search
  const [companyQuery, setCompanyQuery] = useState("")
  const [companyResults, setCompanyResults] = useState<CompanyResult[]>([])
  const [companySearching, setCompanySearching] = useState(false)

  const nextPath = useMemo(
    () => getSafeAuthNextPath(searchParams.get("next"), "/application/type"),
    [searchParams],
  )
  const loginHref = useMemo(
    () => `/auth/login?next=${encodeURIComponent(nextPath)}`,
    [nextPath],
  )

  const searchCompanies = async () => {
    if (companyQuery.length < 2) return
    setCompanySearching(true)
    const res = await fetch(`/api/companies/search?q=${encodeURIComponent(companyQuery)}`)
    const data = await res.json()
    setCompanyResults(data.results ?? [])
    setCompanySearching(false)
  }

  const selectCompany = (c: CompanyResult) => {
    setSwCompany(c)
    setStep("form")
    setErrorMessage("")
  }

  const handleGoogleSignUp = async () => {
    setErrorMessage("")
    setIsLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      })
      if (error) setErrorMessage(toUserFacingError(error, { fallback: "Unable to sign up with Google.", context: "auth" }))
    } catch (error) {
      setErrorMessage(toUserFacingError(error, { fallback: "Unable to sign up with Google.", context: "auth" }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleSelect = (selectedRole: AccountRole) => {
    setRole(selectedRole)
    setErrorMessage("")
    if (selectedRole === "social_worker") {
      setStep("company-search")
    } else {
      setStep("form")
    }
  }

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

    // Validate email domain for social workers
    if (role === "social_worker" && swCompany?.email_domain) {
      const emailDomain = normalizedEmail.split("@")[1]?.toLowerCase()
      if (emailDomain !== swCompany.email_domain.toLowerCase()) {
        setErrorMessage(
          `Your email must use your company domain (@${swCompany.email_domain}).`,
        )
        return
      }
    }

    if (role === "social_worker" && !swCompany) {
      setErrorMessage("Please select your company first.")
      setStep("company-search")
      return
    }

    setIsLoading(true)

    try {
      const supabase = getSupabaseClient()
      const swExtra =
        role === "social_worker"
          ? {
              role: "social_worker",
              companyId: swCompany?.id,
              companyName: swCompany?.name,
              companyNpi: swCompany?.npi,
              companyAddress: swCompany?.address,
              companyCity: swCompany?.city,
              companyState: swCompany?.state,
              companyZip: swCompany?.zip,
              companyEmailDomain: swCompany?.email_domain,
              licenseNumber: swLicense,
              jobTitle: swJobTitle,
            }
          : {}

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: params.email,
            password: params.password,
            firstName: params.firstName,
            lastName: params.lastName,
            phone: params.phone,
            ...swExtra,
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
          return { ok: false as const, error: signInResult.error.message }
        }

        return { ok: true as const }
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          // `role` is read by the handle_new_auth_user trigger to decide
          // whether to create an applicants row. Social workers get their
          // identity stored in social_worker_profiles instead.
          data: { first_name: firstName, last_name: lastName, phone, role },
        },
      })

      if (error) {
        if (localAuthHelperEnabled) {
          const recovered = await tryDevRegisterAndSignIn({
            email: normalizedEmail, password, firstName, lastName, phone,
          })
          if (recovered.ok) {
            router.push(role === "social_worker" ? "/social-worker/dashboard" : nextPath)
            return
          }
          setErrorMessage(toUserFacingError(recovered.error || error, { fallback: "Registration failed.", context: "auth" }))
          return
        }
        setErrorMessage(toUserFacingError(error, { fallback: "Registration failed.", context: "auth" }))
        return
      }

      const looksLikeExistingUser =
        Array.isArray(data.user?.identities) && data.user.identities.length === 0

      if (looksLikeExistingUser) {
        if (localAuthHelperEnabled) {
          const recovered = await tryDevRegisterAndSignIn({
            email: normalizedEmail, password, firstName, lastName, phone,
          })
          if (recovered.ok) {
            router.push(role === "social_worker" ? "/social-worker/dashboard" : nextPath)
            return
          }
          setErrorMessage(toUserFacingError(recovered.error || "An account with this email already exists.", {
            fallback: "An account with this email already exists. Please sign in instead.",
            context: "auth",
          }))
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
        router.push(role === "social_worker" ? "/social-worker/dashboard" : nextPath)
        return
      }

      if (localAuthHelperEnabled) {
        const recovered = await tryDevRegisterAndSignIn({
          email: normalizedEmail, password, firstName, lastName, phone,
        })
        if (recovered.ok) {
          router.push(role === "social_worker" ? "/social-worker/dashboard" : nextPath)
          return
        }
        setErrorMessage(toUserFacingError(recovered.error || "Local auto-confirm failed.", {
          fallback: "Registration failed.",
          context: "auth",
        }))
        return
      }

      setStep("verify")
      setInfoMessage("Account created. Please check your email for a confirmation link.")
    } catch (error) {
      setErrorMessage(toUserFacingError(error, { fallback: "Registration failed.", context: "auth" }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setErrorMessage("")
    setInfoMessage("")
    setIsLoading(true)
    try {
      const { error } = await getSupabaseClient().auth.resend({
        type: "signup",
        email: normalizeAuthEmail(email),
      })
      if (error) {
        setErrorMessage(toUserFacingError(error, { fallback: "Unable to resend confirmation email.", context: "auth" }))
        return
      }
      setInfoMessage("Confirmation email resent.")
    } catch (error) {
      setErrorMessage(toUserFacingError(error, { fallback: "Unable to resend confirmation email.", context: "auth" }))
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
            <p className="mt-1 text-muted-foreground">HealthCompass MA</p>
          </div>

          {/* Step: Role Selection */}
          {step === "role-select" && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">I am…</CardTitle>
                <CardDescription>Choose how you want to use HealthCompass MA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleRoleSelect("applicant")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <UserRound className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">Applying for Benefits</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      I want to apply for MassHealth or other benefit programs
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleSelect("social_worker")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">Social Worker / Case Manager</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      I help clients apply for benefits at a licensed agency
                    </div>
                  </div>
                </button>

                <div className="relative pt-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or sign up quickly</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-input"
                  onClick={handleGoogleSignUp}
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
                  Continue with Google
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Google sign-up creates a benefit applicant account
                </p>

                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

                <p className="text-center text-sm text-muted-foreground pt-1">
                  Already have an account?{" "}
                  <Link href={loginHref} className="font-medium text-primary hover:underline">Sign in</Link>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step: Company Search (Social Worker) */}
          {step === "company-search" && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <button
                  onClick={() => setStep("role-select")}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
                >
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
                <CardTitle className="text-xl">Find Your Agency</CardTitle>
                <CardDescription>
                  Search for the social work agency or organization you work for
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Agency name (e.g. 'Boston Medical')"
                    value={companyQuery}
                    onChange={(e) => setCompanyQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchCompanies()}
                    className="border-input"
                  />
                  <Button
                    type="button"
                    onClick={searchCompanies}
                    disabled={companySearching || companyQuery.length < 2}
                    variant="outline"
                    size="icon"
                  >
                    {companySearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {companyResults.length > 0 && (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {companyResults.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectCompany(c)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                      >
                        <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {[c.address, c.city, c.state].filter(Boolean).join(", ")}
                            {c.source === "local" && (
                              <span className="ml-1.5 text-emerald-600 font-medium">✓ Approved</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {companyResults.length === 0 && companyQuery.length >= 2 && !companySearching && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No results yet — click search or press Enter
                  </p>
                )}

                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
              </CardContent>
            </Card>
          )}

          {/* Step: Account Form */}
          {step === "form" && (
            <Card className="border-border bg-card">
              <CardHeader className="space-y-1 pb-4">
                {role === "social_worker" && swCompany && (
                  <button
                    onClick={() => setStep("company-search")}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back
                  </button>
                )}
                <CardTitle className="text-xl text-card-foreground">
                  {role === "social_worker" ? "Social Worker Account" : "Account Information"}
                </CardTitle>
                {role === "social_worker" && swCompany && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mt-1">
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-medium">{swCompany.name}</span>
                    {swCompany.email_domain && (
                      <span className="text-emerald-600 ml-auto">@{swCompany.email_domain}</span>
                    )}
                  </div>
                )}
                <CardDescription>
                  {role === "social_worker"
                    ? "Use your company email address to register"
                    : "Create an account to save your progress"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email Address
                      {role === "social_worker" && swCompany?.email_domain && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (must end in @{swCompany.email_domain})
                        </span>
                      )}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={
                        role === "social_worker" && swCompany?.email_domain
                          ? `you@${swCompany.email_domain}`
                          : "you@example.com"
                      }
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555)123-4567"
                      required
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                      maxLength={13}
                      inputMode="numeric"
                    />
                  </div>

                  {/* Social worker specific fields */}
                  {role === "social_worker" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="jobTitle">Job Title</Label>
                        <Input
                          id="jobTitle"
                          placeholder="e.g. Case Manager, Social Worker"
                          value={swJobTitle}
                          onChange={(e) => setSwJobTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="license">
                          License Number <span className="text-muted-foreground text-xs">(optional)</span>
                        </Label>
                        <Input
                          id="license"
                          placeholder="e.g. LCSW-123456"
                          value={swLicense}
                          onChange={(e) => setSwLicense(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password">Create Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        required
                        className="pr-10"
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
                    <p className="text-xs text-muted-foreground">At least 8 characters</p>
                  </div>

                  {role === "social_worker" && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                      Your account will be reviewed by an admin before you can access the social worker portal.
                    </div>
                  )}

                  {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                  {infoMessage && <p className="text-sm text-accent">{infoMessage}</p>}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating Account…" : "Create Account"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href={loginHref} className="font-medium text-primary hover:underline">Sign in</Link>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step: Verify email */}
          {step === "verify" && (
            <Card className="border-border bg-card">
              <CardHeader className="space-y-1 pb-4">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <CheckCircle2 className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-center text-xl">Verify Your Email</CardTitle>
                <CardDescription className="text-center">
                  We sent a confirmation link to <span className="font-medium">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {role === "social_worker" && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800 text-center">
                    After email verification, an admin will review and approve your account.
                  </div>
                )}
                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                {infoMessage && <p className="text-sm text-accent">{infoMessage}</p>}
                <Button
                  type="button"
                  onClick={handleResend}
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending…" : "Resend Confirmation Email"}
                </Button>
                <Link href={loginHref} className="block">
                  <Button type="button" className="w-full">Go to Sign In</Button>
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
