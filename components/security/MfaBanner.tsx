/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * MfaBanner
 *
 * Shown on the customer dashboard when the signed-in user has no verified
 * TOTP factor. Prompts them to set up two-factor authentication.
 *
 * Dismissal is stored in sessionStorage so the nudge reappears on the next
 * login but doesn't nag repeatedly within the same session.
 *
 * Renders nothing while the MFA status is loading or when the user already
 * has 2FA enabled.
 */

"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { ShieldAlert, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase/client"

const DISMISSED_KEY = "healthcompass.mfaBannerDismissed"

// ─── SSR-safe sessionStorage read ────────────────────────────────────────────
// Server snapshot always returns false (not dismissed).
// Client snapshot reads the actual sessionStorage value.
// This avoids calling setState() directly inside a useEffect, which is
// forbidden by the project's react-hooks/set-state-in-effect lint rule.

function subscribeToStorage(_callback: () => void): () => void {
  // sessionStorage does not fire storage events for same-tab changes,
  // so there is nothing to subscribe to. The value is re-read on every
  // render and on mount via useSyncExternalStore's snapshot mechanism.
  return () => undefined
}

function getStorageSnapshot(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

function getServerSnapshot(): boolean {
  return false
}

function useSessionDismissed(): boolean {
  return useSyncExternalStore(subscribeToStorage, getStorageSnapshot, getServerSnapshot)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MfaBannerProps {
  /** Extra Tailwind classes for the wrapper */
  className?: string
}

type LoadState = "loading" | "needs_mfa" | "has_mfa"

export function MfaBanner({ className }: MfaBannerProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading")

  // Tracks whether the user clicked ✕ during this render cycle.
  // Combined with sessionDismissed so the banner hides immediately on click
  // even though sessionStorage doesn't fire a re-render.
  const [runtimeDismissed, setRuntimeDismissed] = useState(false)

  // True when sessionStorage already has the dismissed flag from an earlier
  // point in this browser session (SSR-safe via useSyncExternalStore).
  const sessionDismissed = useSessionDismissed()

  useEffect(() => {
    // Skip the Supabase round-trip if the user already dismissed this session.
    if (sessionDismissed) return

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
  }, [sessionDismissed])

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1")
    } catch {
      // sessionStorage may be unavailable in restricted contexts.
    }
    setRuntimeDismissed(true)
  }

  if (loadState === "loading" || loadState === "has_mfa" || sessionDismissed || runtimeDismissed) {
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

        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/setup-mfa">Enable 2FA</Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  )
}
