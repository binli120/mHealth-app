/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * MfaBanner
 *
 * Shown on the customer dashboard when the signed-in user has no verified
 * TOTP factor. Prompts them to set up two-factor authentication.
 *
 * Renders nothing while the MFA status is loading or when the user already
 * has 2FA enabled.
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase/client"

interface MfaBannerProps {
  /** Extra Tailwind classes for the wrapper */
  className?: string
}

type LoadState = "loading" | "needs_mfa" | "has_mfa"

export function MfaBanner({ className }: MfaBannerProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading")

  useEffect(() => {
    let cancelled = false

    const checkMfa = async () => {
      try {
        const { data } = await getSupabaseClient().auth.mfa.listFactors()
        if (cancelled) return
        const hasVerified = (data?.totp ?? []).some((f) => f.status === "verified")
        setLoadState(hasVerified ? "has_mfa" : "needs_mfa")
      } catch {
        // Network error — don't show the banner so we don't create false urgency.
        setLoadState("has_mfa")
      }
    }

    void checkMfa()
    return () => { cancelled = true }
  }, [])

  if (loadState === "loading" || loadState === "has_mfa") {
    return null
  }

  return (
    <Alert
      className={cn(
        "flex items-start gap-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

      <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <AlertTitle className="text-sm font-semibold leading-snug">
            Two-Factor Authentication Not Enabled
          </AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            Protect your account with an extra layer of security. Set up 2FA in under a minute.
          </AlertDescription>
        </div>

        <Button size="sm" asChild>
          <Link href="/setup-mfa">Enable 2FA</Link>
        </Button>
      </div>
    </Alert>
  )
}
