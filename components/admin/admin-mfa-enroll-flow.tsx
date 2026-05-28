"use client"

/**
 * Self-contained inline MFA (TOTP) enrollment widget for the admin sidebar.
 *
 * Renders either:
 *   • A "Set up 2FA" / "2FA Enabled" button (idle state)
 *   • An inline QR + code-input form during active enrollment
 *
 * All local state (step, enrollData, code, error) is private — the parent
 * only needs to know when enrollment succeeds so it can update `hasFactor`.
 */

import { useState } from "react"
import { Check, Loader2, ShieldCheck, ShieldPlus } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type MfaSetupStep = "idle" | "qr" | "verifying"

interface MfaEnrollData {
  factorId: string
  qrCode: string
  secret: string
}

interface Props {
  hasFactor: boolean
  onEnrollSuccess: () => void
}

export function AdminMfaEnrollFlow({ hasFactor, onEnrollSuccess }: Props) {
  const [step, setStep] = useState<MfaSetupStep>("idle")
  const [enrollData, setEnrollData] = useState<MfaEnrollData | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  const handleSetup = async () => {
    const supabase = getSupabaseClient()
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Admin 2FA",
    })
    if (enrollError || !data) {
      window.alert(enrollError?.message ?? "Failed to start 2FA setup.")
      return
    }
    setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setCode("")
    setError("")
    setStep("qr")
  }

  const handleVerify = async () => {
    if (!enrollData || code.length !== 6) return
    setStep("verifying")

    const supabase = getSupabaseClient()
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollData.factorId,
      code,
    })

    if (verifyError) {
      setError("Invalid code. Please try again.")
      setStep("qr")
      return
    }

    onEnrollSuccess()
    setStep("idle")
    setEnrollData(null)
    setCode("")
  }

  const cancel = () => {
    setStep("idle")
    setEnrollData(null)
    setCode("")
    setError("")
  }

  if (step !== "idle" && enrollData) {
    return (
      <div className="mb-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 p-3">
        <p className="mb-2 text-xs font-semibold text-sidebar-foreground">Set up 2FA</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enrollData.qrCode}
          alt="Scan with your authenticator app"
          className="mb-1 w-full rounded"
        />
        <p className="mb-2 break-all text-[10px] text-sidebar-foreground/60">
          {enrollData.secret}
        </p>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="mb-2 h-8 text-center text-base tracking-[0.4em]"
          autoFocus
        />
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={code.length !== 6 || step === "verifying"}
            onClick={() => void handleVerify()}
          >
            {step === "verifying" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => void handleSetup()}
      className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {hasFactor ? (
        <ShieldCheck className="size-4 text-green-500" />
      ) : (
        <ShieldPlus className="size-4" />
      )}
      {hasFactor ? "2FA Enabled" : "Set up 2FA"}
    </button>
  )
}
