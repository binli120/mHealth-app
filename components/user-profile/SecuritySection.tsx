/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useEffect, useState } from "react"
import { startRegistration } from "@simplewebauthn/browser"
import { toast } from "sonner"
import {
  Check,
  Eye,
  EyeOff,
  Key,
  KeyRound,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldPlus,
  Smartphone,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getSupabaseClient } from "@/lib/supabase/client"
import type { Factor } from "@supabase/supabase-js"

// ── Types ────────────────────────────────────────────────────────────────────

interface PasskeyInfo {
  id: string
  name: string | null
  device_type: string
  backed_up: boolean
  created_at: string
}

type TotpStep = "idle" | "qr" | "verifying" | "removing"

interface MfaEnrollData {
  factorId: string
  qrCode: string
  secret: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// ── TotpActivePanel ───────────────────────────────────────────────────────────

function TotpActivePanel({ factor, onRemoved }: { factor: Factor; onRemoved: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success("Two-factor authentication removed.")
      onRemoved()
    } catch {
      toast.error("Unable to remove 2FA. Please try again.")
    } finally {
      setRemoving(false)
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-800">2FA is active</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Your account is protected. You&apos;ll be prompted for a code on each sign-in.
          </p>
        </div>
        {!confirming && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setConfirming(true)}
          >
            Remove
          </Button>
        )}
      </div>

      {confirming && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm text-destructive font-medium">Remove two-factor authentication?</p>
          <p className="text-xs text-muted-foreground">
            Your account will be less secure without 2FA. You can re-enable it at any time.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void handleRemove()}
              disabled={removing}
              className="gap-1"
            >
              {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {removing ? "Removing…" : "Yes, remove 2FA"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={removing}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SecuritySection ───────────────────────────────────────────────────────────

export function SecuritySection() {
  // ── Password state ─────────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false)
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const [pwShowCurrent, setPwShowCurrent] = useState(false)
  const [pwShowNew, setPwShowNew] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState("")

  // ── TOTP state ─────────────────────────────────────────────────────────────
  const [totpFactors, setTotpFactors] = useState<Factor[]>([])
  const [totpLoading, setTotpLoading] = useState(true)
  const [totpStep, setTotpStep] = useState<TotpStep>("idle")
  const [enrollData, setEnrollData] = useState<MfaEnrollData | null>(null)
  const [totpCode, setTotpCode] = useState("")
  const [totpError, setTotpError] = useState("")

  // ── Passkey state ──────────────────────────────────────────────────────────
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [passkeysLoading, setPasskeysLoading] = useState(true)
  const [addingPasskey, setAddingPasskey] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [newPasskeyName, setNewPasskeyName] = useState("")

  // ── Password change ────────────────────────────────────────────────────────

  const resetPwForm = () => {
    setPwOpen(false)
    setPwCurrent("")
    setPwNew("")
    setPwConfirm("")
    setPwError("")
    setPwShowCurrent(false)
    setPwShowNew(false)
  }

  const handleChangePassword = async () => {
    setPwError("")
    if (pwNew.length < 8) {
      setPwError("New password must be at least 8 characters.")
      return
    }
    if (pwNew !== pwConfirm) {
      setPwError("Passwords do not match.")
      return
    }

    setPwSaving(true)
    try {
      const supabase = getSupabaseClient()

      // Re-authenticate with the current password first so we don't allow
      // a session-hijack to silently change credentials.
      const { data: sessionData } = await supabase.auth.getSession()
      const email = sessionData.session?.user?.email
      if (!email) {
        setPwError("Unable to verify your identity. Please sign in again.")
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: pwCurrent,
      })
      if (signInError) {
        setPwError("Current password is incorrect.")
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: pwNew })
      if (updateError) {
        setPwError(updateError.message)
        return
      }

      toast.success("Password updated successfully.")
      resetPwForm()
    } catch {
      setPwError("Unable to update password. Please try again.")
    } finally {
      setPwSaving(false)
    }
  }

  // ── Load on mount ──────────────────────────────────────────────────────────

  const loadTotpFactors = async () => {
    setTotpLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.auth.mfa.listFactors()
      setTotpFactors(data?.totp ?? [])
    } finally {
      setTotpLoading(false)
    }
  }

  const loadPasskeys = async () => {
    setPasskeysLoading(true)
    try {
      const res = await authenticatedFetch("/api/user/passkey")
      const data = await res.json().catch(() => ({ ok: false, passkeys: [] }))
      if (data.ok) setPasskeys(data.passkeys ?? [])
    } catch {
      // non-critical — silently show empty list
    } finally {
      setPasskeysLoading(false)
    }
  }

  useEffect(() => {
    // Load initial data — async helpers defined outside to allow reuse in event handlers
    void (async () => {
      await Promise.all([loadTotpFactors(), loadPasskeys()])
    })()
  }, [])

  // ── TOTP enrollment ────────────────────────────────────────────────────────

  const handleStartTotp = async () => {
    setTotpError("")
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    })
    if (error || !data) {
      toast.error(error?.message ?? "Could not start 2FA setup.")
      return
    }
    setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setTotpCode("")
    setTotpStep("qr")
  }

  const handleVerifyTotp = async () => {
    if (!enrollData || totpCode.length !== 6) return
    setTotpStep("verifying")
    setTotpError("")

    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollData.factorId,
      code: totpCode,
    })

    if (error) {
      setTotpError("Invalid code. Please try again.")
      setTotpStep("qr")
      return
    }

    toast.success("Two-factor authentication enabled!")
    setTotpStep("idle")
    setEnrollData(null)
    setTotpCode("")
    await loadTotpFactors()
  }

  const cancelTotpSetup = () => {
    setTotpStep("idle")
    setEnrollData(null)
    setTotpCode("")
    setTotpError("")
  }

  // ── Passkey enrollment ─────────────────────────────────────────────────────

  const handleAddPasskey = async () => {
    setAddingPasskey(true)
    try {
      // 1. Get options from server
      const optRes = await authenticatedFetch("/api/user/passkey/register/options", {
        method: "POST",
      })
      const optData = await optRes.json().catch(() => ({ ok: false, error: "Unexpected server response." }))
      if (!optRes.ok || !optData.ok) {
        toast.error(optData.error ?? "Could not start passkey registration.")
        return
      }

      // 2. Trigger browser WebAuthn flow
      const credential = await startRegistration({ optionsJSON: optData.options })

      // 3. Verify on server
      const verRes = await authenticatedFetch("/api/user/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: credential,
          name: newPasskeyName.trim() || null,
        }),
      })
      const verData = await verRes.json().catch(() => ({ ok: false, error: "Unexpected server response." }))
      if (!verRes.ok || !verData.ok) {
        toast.error(verData.error ?? "Could not save passkey.")
        return
      }

      toast.success("Passkey added successfully!")
      setNewPasskeyName("")
      await loadPasskeys()
    } catch (err) {
      // User cancelled the browser dialog or the device doesn't support passkeys
      const msg = err instanceof Error ? err.message : "Passkey registration failed."
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("abort")) {
        toast.error(msg)
      }
    } finally {
      setAddingPasskey(false)
    }
  }

  const handleRemovePasskey = async (id: string) => {
    setRemovingId(id)
    try {
      const res = await authenticatedFetch(`/api/user/passkey/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({ ok: false, error: "Unexpected server response." }))
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not remove passkey.")
        return
      }
      toast.success("Passkey removed.")
      setPasskeys((prev) => prev.filter((p) => p.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasTotpFactor = totpFactors.length > 0

  return (
    <div className="space-y-6">

      {/* ── Change Password ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle>Password</CardTitle>
            </div>
            {!pwOpen && (
              <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>
                Change password
              </Button>
            )}
          </div>
          <CardDescription>
            Update your password. You&apos;ll need to enter your current password to confirm.
          </CardDescription>
        </CardHeader>

        {pwOpen && (
          <CardContent className="space-y-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <label htmlFor="pw-current" className="text-sm font-medium">
                Current password
              </label>
              <div className="relative">
                <Input
                  id="pw-current"
                  type={pwShowCurrent ? "text" : "password"}
                  placeholder="Enter current password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  className="pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setPwShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {pwShowCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <label htmlFor="pw-new" className="text-sm font-medium">
                New password
              </label>
              <div className="relative">
                <Input
                  id="pw-new"
                  type={pwShowNew ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setPwShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {pwShowNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label htmlFor="pw-confirm" className="text-sm font-medium">
                Confirm new password
              </label>
              <Input
                id="pw-confirm"
                type="password"
                placeholder="Re-enter new password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {pwError && <p className="text-sm text-destructive">{pwError}</p>}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => void handleChangePassword()}
                disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
                className="gap-1"
              >
                {pwSaving
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  : <><Check className="h-4 w-4" /> Update password</>
                }
              </Button>
              <Button variant="ghost" onClick={resetPwForm} disabled={pwSaving}>
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Two-Factor Authentication ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
            {!totpLoading && (
              hasTotpFactor
                ? <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                    <Check className="h-3 w-3" /> Enabled
                  </Badge>
                : <Badge variant="outline" className="text-muted-foreground">Not set up</Badge>
            )}
          </div>
          <CardDescription>
            Add an extra layer of security. After enabling, you&apos;ll enter a code from your
            authenticator app each time you sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totpLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : hasTotpFactor ? (
            <TotpActivePanel
              factor={totpFactors[0]}
              onRemoved={() => {
                setTotpFactors([])
                setTotpStep("idle")
              }}
            />
          ) : totpStep === "idle" ? (
            <Button
              onClick={() => void handleStartTotp()}
              variant="outline"
              className="gap-2"
            >
              <ShieldPlus className="h-4 w-4" />
              Set up authenticator app
            </Button>
          ) : (
            /* QR / verify flow */
            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Install an authenticator app (Google Authenticator, Authy, 1Password…)</li>
                <li>Scan the QR code below or enter the manual key</li>
                <li>Enter the 6-digit code to confirm</li>
              </ol>

              {enrollData && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={enrollData.qrCode}
                    alt="2FA QR code"
                    className="w-44 h-44 rounded-lg border bg-white p-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Manual key:{" "}
                    <span className="font-mono rounded bg-muted px-1 py-0.5 text-foreground">
                      {enrollData.secret}
                    </span>
                  </p>
                </>
              )}

              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="w-32 text-center tracking-widest text-lg"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoFocus
                />
                <Button
                  onClick={() => void handleVerifyTotp()}
                  disabled={totpCode.length !== 6 || totpStep === "verifying"}
                  className="gap-1"
                >
                  {totpStep === "verifying"
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
                    : <><Check className="h-4 w-4" /> Confirm</>
                  }
                </Button>
                <Button variant="ghost" onClick={cancelTotpSetup}>Cancel</Button>
              </div>
              {totpError && <p className="text-sm text-destructive">{totpError}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Passkeys ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>Passkeys</CardTitle>
          </div>
          <CardDescription>
            Sign in faster and more securely using your device&apos;s biometrics (Face ID,
            fingerprint, Windows Hello) instead of a password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {passkeysLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : passkeys.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border">
              {passkeys.map((pk) => (
                <li key={pk.id} className="flex items-center gap-3 px-4 py-3">
                  <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {pk.name ?? "Passkey"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pk.device_type === "multiDevice" ? "Synced across devices · " : "This device only · "}
                      Added {formatDate(pk.created_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={removingId === pk.id}
                    onClick={() => void handleRemovePasskey(pk.id)}
                  >
                    {removingId === pk.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <Separator className={passkeys.length === 0 ? "hidden" : ""} />

          {/* Add passkey */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Passkey name (optional — e.g. My iPhone)"
                value={newPasskeyName}
                onChange={(e) => setNewPasskeyName(e.target.value)}
                className="max-w-xs"
              />
              <Button
                onClick={() => void handleAddPasskey()}
                disabled={addingPasskey}
                variant="outline"
                className="gap-2 shrink-0"
              >
                {addingPasskey
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
                  : <><Key className="h-4 w-4" /> Add a passkey</>
                }
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your browser or device will ask you to verify with biometrics or a PIN.
              Passkeys are stored securely on your device.
            </p>
          </div>

        </CardContent>
      </Card>

    </div>
  )
}
