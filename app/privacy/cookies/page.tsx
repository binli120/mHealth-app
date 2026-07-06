/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Cookie, ShieldCheck } from "lucide-react"

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "HealthCompass cookie policy and usage information.",
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto w-full max-w-6xl sm:w-2/3">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Privacy Statement
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:w-2/3">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Cookie className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Cookie Policy
          </h1>
          <p className="mb-8 text-muted-foreground">
            Information about how HealthCompass uses cookies and similar
            technologies.
          </p>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Required cookies</h2>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              These cookies are necessary for authentication, passkey challenges, session hints, security
              controls, and application workflow continuity. They are not used for advertising and cannot be
              disabled through the cookie banner because the service depends on them.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">Optional analytics and referral cookies</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              If you accept optional cookies, HealthCompass may load configured analytics tools such as Google
              Analytics, Mixpanel, or OpenObserve RUM. We also may store a first-party referral cookie
              (<code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">hc_ref</code>) when you arrive
              with a referral code. These tools help us measure page usage, diagnose product issues, and
              understand referral performance.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">Your choice</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              The cookie banner records your choice in a first-party consent cookie
              (<code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">hc_cookie_consent</code>) for up to
              180 days. Declining optional cookies does not affect sign-in, eligibility screening, application
              intake, document upload, or account security features.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">Questions</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              For privacy questions or to request assistance changing your cookie preference, contact{" "}
              <a href="mailto:privacy@healthcompass.cloud" className="text-primary hover:underline">
                privacy@healthcompass.cloud
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
