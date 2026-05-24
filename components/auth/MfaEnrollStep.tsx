/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Reusable TOTP enrolment card used in two places:
 *   1. Inline inside the registration flow (immediate session, dev mode / auto-confirm)
 *   2. Standalone /setup-mfa page (email-confirmation production flow)
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { ShieldCheck, Copy, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase/client"
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/lib/i18n/languages"
import { getMfaCopy } from "@/lib/auth/mfa-copy"

interface MfaEnrollStepProps {
  /** Displayed in the TOTP issuer line (e.g. user's full name or email). */
  friendlyName?: string
  /** UI language — defaults to English. */
  language?: SupportedLanguage
  /** Called when the code is verified and enrolment is complete. */
  onComplete: () => void
  /** Called when the user cancels — should sign them out and redirect to login. */
  onCancel: () => void
}

interface EnrolData {
  factorId: string
  qrCode: string   // SVG data URL from Supabase
  secret: string   // base-32 backup key
}

export function MfaEnrollStep({ friendlyName, language = DEFAULT_LANGUAGE, onComplete, onCancel }: MfaEnrollStepProps) {
  const copy = useMemo(() => getMfaCopy(language), [language])

  const [enrollData, setEnrollData] = useState<EnrolData | null>(null)
  /** API-provided error message from Supabase, or empty. */
  const [enrollApiError, setEnrollApiError] = useState("")
  /** True when enrolment failed without a specific API message. */
  const [enrollGenericError, setEnrollGenericError] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(true)

  const [code, setCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState("")

  const [secretCopied, setSecretCopied] = useState(false)

  // ── Kick off enrolment as soon as the component mounts ───────────────────
  useEffect(() => {
    let cancelled = false
    setIsEnrolling(true)
    setEnrollApiError("")
    setEnrollGenericError(false)

    getSupabaseClient()
      .auth.mfa.enroll({
        factorType: "totp",
        issuer: "HealthCompass MA",
        friendlyName: friendlyName ?? "HealthCompass MA",
      })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          if (error?.message) setEnrollApiError(error.message)
          else setEnrollGenericError(true)
          return
        }
        setEnrollData({
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        })
      })
      .finally(() => {
        if (!cancelled) setIsEnrolling(false)
      })

    return () => { cancelled = true }
  }, [friendlyName])

  // ── Copy secret to clipboard ──────────────────────────────────────────────
  const handleCopySecret = async () => {
    if (!enrollData) return
    await navigator.clipboard.writeText(enrollData.secret).catch(() => undefined)
    setSecretCopied(true)
    setTimeout(() => setSecretCopied(false), 2000)
  }

  // ── Verify OTP code ───────────────────────────────────────────────────────
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollData || code.length !== 6) return

    setVerifyError("")
    setIsVerifying(true)

    try {
      const { error } = await getSupabaseClient().auth.mfa.challengeAndVerify({
        factorId: enrollData.factorId,
        code: code.trim(),
      })

      if (error) {
        setVerifyError(copy.invalidCode)
        setCode("")
        return
      }

      onComplete()
    } catch {
      setVerifyError(copy.verifyFailed)
    } finally {
      setIsVerifying(false)
    }
  }

  // ── Handle cancel ─────────────────────────────────────────────────────────
  const handleCancel = async () => {
    // If we started enrolment but the user bails, unenrol the pending factor
    // so it doesn't dangle in the account.
    if (enrollData) {
      await getSupabaseClient()
        .auth.mfa.unenroll({ factorId: enrollData.factorId })
        .catch(() => undefined)
    }
    onCancel()
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-xl">{copy.cardTitle}</CardTitle>
            <CardDescription>{copy.cardDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isEnrolling && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{copy.generating}</span>
          </div>
        )}

        {(enrollApiError || enrollGenericError) && !isEnrolling && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {enrollApiError || copy.enrollError}
          </div>
        )}

        {enrollData && !isEnrolling && !enrollApiError && !enrollGenericError && (
          <>
            {/* Step 1 — Scan QR */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
                {copy.step1Label}
              </p>
              <p className="text-xs text-muted-foreground">{copy.step1Help}</p>

              {/* QR code */}
              <div className="flex justify-center rounded-xl border border-border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrollData.qrCode}
                  alt={copy.step1Label}
                  className="h-44 w-44"
                />
              </div>

              {/* Manual entry key */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{copy.cantScan}</p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <code className="flex-1 break-all font-mono text-xs text-foreground">
                    {enrollData.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopySecret()}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={copy.copyKey}
                  >
                    {secretCopied
                      ? <Check className="h-4 w-4 text-emerald-500" />
                      : <Copy className="h-4 w-4" />
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2 — Enter code */}
            <form onSubmit={(e) => void handleVerify(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfa-code" className="text-sm font-medium">
                  <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
                  {copy.step2Label}
                </Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder={copy.codePlaceholder}
                  autoComplete="one-time-code"
                  className="text-center text-xl tracking-[0.4em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoFocus
                />
              </div>

              {verifyError && (
                <p className="text-sm text-destructive">{verifyError}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={code.length !== 6 || isVerifying}
              >
                {isVerifying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{copy.verifying}</>
                ) : (
                  copy.enableButton
                )}
              </Button>
            </form>
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => void handleCancel()}
          disabled={isVerifying}
        >
          {copy.cancelButton}
        </Button>
      </CardContent>
    </Card>
  )
}
