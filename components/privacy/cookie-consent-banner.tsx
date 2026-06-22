/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Cookie } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_VALUES,
  type CookieConsentValue,
} from "@/lib/privacy/cookie-consent"

interface CookieConsentBannerProps {
  initialConsent?: CookieConsentValue | null
}

function writeConsentCookie(value: CookieConsentValue) {
  document.cookie = [
    `${COOKIE_CONSENT_COOKIE}=${value}`,
    `Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    window.location.protocol === "https:" ? "Secure" : "",
  ].filter(Boolean).join("; ")
}

// Paths where showing a cookie banner would break the flow (no auth session,
// camera active, reload on accept would lose the scan token).
const SUPPRESS_PATHS = ["/verify/mobile/", "/upload/mobile/"]

export function CookieConsentBanner({ initialConsent = null }: CookieConsentBannerProps) {
  const pathname = usePathname()
  const [consent, setConsent] = useState<CookieConsentValue | null>(initialConsent)

  function saveConsent(value: CookieConsentValue) {
    writeConsentCookie(value)
    setConsent(value)

    if (value === COOKIE_CONSENT_VALUES.accepted) {
      window.location.reload()
    }
  }

  if (consent) return null
  if (pathname && SUPPRESS_PATHS.some((p) => pathname.startsWith(p))) return null

  return (
    <section
      aria-label="Cookie consent"
      className="fixed right-3 bottom-3 left-3 z-50 rounded-lg border border-border bg-card p-4 shadow-lg sm:right-auto sm:left-4 sm:w-[28rem] sm:p-5"
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Cookie className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold tracking-normal text-foreground">
              Cookies on HealthCompass MA
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              We use required cookies for sign-in, security, and application workflows. With your consent, we
              also use analytics and referral cookies to understand usage and improve the service.
            </p>
            <Link href="/privacy/cookies" className="inline-flex text-sm font-medium text-primary hover:underline">
              Cookie policy
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" size="sm" onClick={() => saveConsent(COOKIE_CONSENT_VALUES.accepted)}>
            Accept optional cookies
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => saveConsent(COOKIE_CONSENT_VALUES.declined)}
          >
            Decline optional
          </Button>
        </div>
      </div>
    </section>
  )
}
