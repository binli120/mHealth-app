/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * IdentityVerificationBanner
 *
 * A persistent, context-aware banner that shows the user's current identity
 * verification status and lets them open the LicenseScannerModal.
 *
 * Renders nothing when:
 *   - status is "verified"  (unless showWhenVerified prop is true)
 *   - the identity status is still loading
 *
 * Used on:
 *   - Customer dashboard (soft nudge)
 *   - Application form validate-and-submit step (hard gate)
 */

"use client"

import { useEffect } from "react"
import { ShieldCheck, ShieldAlert, ShieldOff, Clock, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  openScanner,
  setIdentityStatus,
} from "@/lib/redux/features/identity-verification-slice"
import { LicenseScannerModal } from "@/components/identity/LicenseScannerModal"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

// ─── Types ────────────────────────────────────────────────────────────────────

interface IdentityVerificationBannerProps {
  /** When true, renders a compact success badge instead of hiding */
  showWhenVerified?: boolean
  /** Extra Tailwind classes for the wrapper */
  className?: string
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  unverified: {
    variant: "default" as const,
    icon: ShieldAlert,
    iconColor: "text-amber-600",
    wrapperClass: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    title: "Identity Not Verified",
    description:
      "Scan your driver's license barcode to verify your identity before submitting an application.",
    cta: "Verify Now",
    ctaVariant: "default" as const,
  },
  pending: {
    variant: "default" as const,
    icon: Clock,
    iconColor: "text-blue-600",
    wrapperClass: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
    title: "Identity Under Review",
    description:
      "Your identity scan is being reviewed by our team. You'll be notified once confirmed.",
    cta: "Re-scan",
    ctaVariant: "outline" as const,
  },
  verified: {
    variant: "default" as const,
    icon: ShieldCheck,
    iconColor: "text-emerald-600",
    wrapperClass: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
    title: "Identity Verified",
    description: "Your identity has been confirmed. You're ready to submit applications.",
    cta: null,
    ctaVariant: "outline" as const,
  },
  failed: {
    variant: "destructive" as const,
    icon: ShieldOff,
    iconColor: "text-destructive",
    wrapperClass: "border-destructive/30 bg-destructive/5",
    title: "Verification Failed",
    description:
      "We couldn't confirm your identity. Please try scanning again or contact support.",
    cta: "Try Again",
    ctaVariant: "destructive" as const,
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IdentityVerificationBanner({
  showWhenVerified = false,
  className,
}: IdentityVerificationBannerProps) {
  const dispatch = useAppDispatch()
  const { status, loading } = useAppSelector((s) => s.identityVerification)

  // ── Hydrate status from API on first render ──────────────────────────────
  useEffect(() => {
    let cancelled = false

    const fetchStatus = async () => {
      try {
        const res = await authenticatedFetch("/api/identity/verify-license", {
          method: "GET",
          cache: "no-store",
        })
        const data = await res.json().catch(() => ({})) as {
          ok?: boolean
          status?: string
          score?: number | null
          verifiedAt?: string | null
        }

        if (!cancelled && data.ok) {
          dispatch(
            setIdentityStatus({
              status: (data.status as "unverified" | "pending" | "verified" | "failed") ?? "unverified",
              score: data.score ?? null,
              verifiedAt: data.verifiedAt ?? null,
            }),
          )
        }
      } catch {
        // Non-fatal — banner will show default "unverified" state
      }
    }

    void fetchStatus()
    return () => { cancelled = true }
  }, [dispatch])

  // ── Don't render while loading or if verified and not explicitly shown ──
  if (loading) return null
  if (status === "verified" && !showWhenVerified) return null

  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon

  return (
    <>
      <LicenseScannerModal />

      <Alert className={cn("flex items-start gap-4", cfg.wrapperClass, className)}>
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", cfg.iconColor)} />

        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <AlertTitle className="text-sm font-semibold leading-snug">
              {cfg.title}
            </AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              {cfg.description}
            </AlertDescription>
          </div>

          {cfg.cta && (
            <Button
              size="sm"
              variant={cfg.ctaVariant}
              onClick={() => dispatch(openScanner())}
              className="shrink-0 gap-1.5"
            >
              <ScanLine className="h-3.5 w-3.5" />
              {cfg.cta}
            </Button>
          )}
        </div>
      </Alert>
    </>
  )
}
