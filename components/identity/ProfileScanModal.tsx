/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * ProfileScanModal
 *
 * Opens a compact scan dialog from the profile "Personal Information" section.
 * Two modes:
 *   1. Camera  — ZXing PDF417 scan → AAMVA parsed client-side → preview card → Apply
 *   2. Phone   — QR handoff (same cross-device session) → desktop polls for
 *                extracted_data → preview card → Apply
 *
 * On Apply the modal calls onApply({ fields, rawBarcode? }).
 *   • fields      → auto-fill values for name / address form inputs
 *   • rawBarcode  → present only in camera mode; used by PersonalSection to
 *                   call /api/identity/verify-license after the profile is saved
 *                   (phone mode: mobile-verify already ran verification server-side)
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library"
import { BrowserMultiFormatReader } from "@zxing/browser"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ScanLine,
  Camera,
  Smartphone,
  CheckCircle2,
  XCircle,
  RefreshCw,
  QrCode,
  Loader2,
  User,
  MapPin,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { parseAamvaBarcode } from "@/lib/identity/aamva-parser"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ScannedProfileFields {
  firstName: string
  lastName: string
  addressLine1: string
  city: string
  state: string
  zip: string
}

export interface ProfileScanResult {
  fields: ScannedProfileFields
  /** Present only for camera scans; absent for phone QR scans */
  rawBarcode?: string
}

interface ProfileScanModalProps {
  open: boolean
  onClose: () => void
  onApply: (result: ProfileScanResult) => void
}

// ─── Internal types ───────────────────────────────────────────────────────────

type ScanMode = "camera" | "phone"
type CameraState = "scanning" | "detected" | "parsed" | "error"
type PhoneState = "idle" | "creating" | "waiting" | "received" | "error"

interface MobileSessionResp {
  ok: boolean; token?: string; expiresAt?: string; mobileUrl?: string; error?: string
}
interface PollResp {
  ok: boolean
  status?: "pending" | "completed" | "expired" | "failed"
  extractedData?: ScannedProfileFields
  error?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileScanModal({ open, onClose, onApply }: ProfileScanModalProps) {
  const [mode, setMode] = useState<ScanMode>("camera")

  // Camera state
  const [cameraState, setCameraState] = useState<CameraState>("scanning")
  const [barcodeFlash, setBarcodeFlash] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [parsedFields, setParsedFields] = useState<ScannedProfileFields | null>(null)
  const [pendingRaw, setPendingRaw] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  // Phone state
  const [phoneState, setPhoneState] = useState<PhoneState>("idle")
  const [mobileUrl, setMobileUrl] = useState<string | null>(null)
  const [mobileToken, setMobileToken] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(600)
  const [phoneFields, setPhoneFields] = useState<ScannedProfileFields | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop(): void } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Camera helpers ──────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    if (videoRef.current) {
      const s = videoRef.current.srcObject as MediaStream | null
      s?.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }, [])

  // ── Full reset ──────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    stopCamera()
    stopPolling()
    setCameraState("scanning")
    setBarcodeFlash(false)
    setCameraError(null)
    setParsedFields(null)
    setPendingRaw(null)
    setParseError(null)
    setPhoneState("idle")
    setMobileUrl(null)
    setMobileToken(null)
    setSecondsLeft(600)
    setPhoneFields(null)
    setPhoneError(null)
  }, [stopCamera, stopPolling])

  const handleClose = useCallback(() => { resetAll(); onClose() }, [resetAll, onClose])

  // ── Start camera ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return
    setCameraError(null)
    setParsedFields(null)
    setPendingRaw(null)
    setParseError(null)
    setCameraState("scanning")

    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417])
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 200 })

    try {
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current,
        (result, err) => {
          if (result) {
            controlsRef.current?.stop()
            const raw = result.getText()
            setBarcodeFlash(true)
            setTimeout(() => {
              setBarcodeFlash(false)
              // Parse client-side
              const parsed = parseAamvaBarcode(raw)
              if (!parsed.ok) {
                setParseError(parsed.error)
                setCameraState("error")
                return
              }
              const d = parsed.data
              setParsedFields({
                firstName: d.firstName,
                lastName: d.lastName,
                addressLine1: d.addressStreet,
                city: d.addressCity,
                state: d.addressState,
                zip: d.addressZip,
              })
              setPendingRaw(raw)
              setCameraState("parsed")
            }, 750)
          } else if (err && !(err instanceof NotFoundException)) {
            console.warn("[ProfileScan]", err)
          }
        },
      )
      controlsRef.current = controls
    } catch (err) {
      const msg = err instanceof Error && err.name === "NotAllowedError"
        ? "Camera access denied. Please allow camera access and try again."
        : "Could not start camera."
      setCameraError(msg)
    }
  }, [])

  // Auto-start camera when modal opens on camera tab
  useEffect(() => {
    if (open && mode === "camera" && cameraState === "scanning" && !parsedFields) {
      void startCamera()
    }
    if (!open) { stopCamera(); stopPolling() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  // ── Phone QR session ────────────────────────────────────────────────────────
  const startPhoneSession = useCallback(async () => {
    setPhoneState("creating")
    setPhoneError(null)
    try {
      const res = await authenticatedFetch("/api/identity/mobile-session", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as MobileSessionResp
      if (!data.ok || !data.token || !data.mobileUrl) {
        setPhoneError(data.error ?? "Could not create session.")
        setPhoneState("error")
        return
      }
      setMobileToken(data.token)
      setMobileUrl(data.mobileUrl)
      const exp = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 600_000)
      setSecondsLeft(Math.max(0, Math.round((exp.getTime() - Date.now()) / 1000)))
      setPhoneState("waiting")

      // Countdown
      countdownRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) { stopPolling(); setPhoneState("idle"); return 0 }
          return s - 1
        })
      }, 1000)

      // Poll
      pollRef.current = setInterval(async () => {
        try {
          const r = await authenticatedFetch(
            `/api/identity/mobile-session?token=${encodeURIComponent(data.token!)}`,
          )
          const poll = (await r.json().catch(() => ({}))) as PollResp
          if (!poll.ok) return
          if (poll.status === "completed") {
            stopPolling()
            if (poll.extractedData) {
              setPhoneFields(poll.extractedData)
              setPhoneState("received")
            } else {
              setPhoneError("Phone scan completed but no field data returned.")
              setPhoneState("error")
            }
          } else if (poll.status === "expired" || poll.status === "failed") {
            stopPolling(); setPhoneState("idle")
          }
        } catch { /* non-fatal */ }
      }, 2000)
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Network error")
      setPhoneState("error")
    }
  }, [stopPolling])

  useEffect(() => () => { stopPolling() }, [stopPolling])

  const switchMode = useCallback((m: ScanMode) => {
    stopCamera(); stopPolling(); resetAll(); setMode(m)
  }, [stopCamera, stopPolling, resetAll])

  const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  const qrUrl = mobileUrl
    ? `/api/identity/qrcode?url=${encodeURIComponent(mobileUrl)}`
    : null

  const hasResult = (mode === "camera" && cameraState === "parsed" && !!parsedFields) ||
    (mode === "phone" && phoneState === "received" && !!phoneFields)

  const resultFields = mode === "camera" ? parsedFields : phoneFields

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-5 w-5 text-primary" />
            Auto-Fill from License
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Scan the <strong>PDF417 barcode on the back</strong> of your driver&apos;s license
            to fill in your name and address automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Mode tabs — hidden once we have a result */}
        {!hasResult && (
          <div className="flex border-b border-border">
            {(["camera", "phone"] as ScanMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                  mode === m
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "camera" ? <Camera className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                {m === "camera" ? "Camera" : "Scan with Phone"}
              </button>
            ))}
          </div>
        )}

        <div className="px-6 py-4 space-y-4">

          {/* ══════════════ CAMERA MODE ══════════════ */}
          {mode === "camera" && !hasResult && (
            <>
              <style>{`
                @keyframes profile-scanline {
                  0%   { top: 4px } 50% { top: calc(100% - 5px) } 100% { top: 4px }
                }
                .profile-scanline { animation: profile-scanline 1.8s ease-in-out infinite; }
              `}</style>

              <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

                {/* Guide overlay */}
                {cameraState === "scanning" && !barcodeFlash && (
                  <div className="pointer-events-none absolute inset-0">
                    <div
                      className="absolute rounded-sm border border-white/20"
                      style={{
                        top: "18%", left: "7%", right: "7%", bottom: "18%",
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.58)",
                      }}
                    >
                      <span className="absolute -top-px -left-px h-5 w-5 border-t-[3px] border-l-[3px] border-primary rounded-tl-sm" />
                      <span className="absolute -top-px -right-px h-5 w-5 border-t-[3px] border-r-[3px] border-primary rounded-tr-sm" />
                      <span className="absolute -bottom-px -left-px h-5 w-5 border-b-[3px] border-l-[3px] border-primary rounded-bl-sm" />
                      <span className="absolute -bottom-px -right-px h-5 w-5 border-b-[3px] border-r-[3px] border-primary rounded-br-sm" />
                      <div
                        className="profile-scanline absolute left-3 right-3 h-[2px] rounded-full bg-primary"
                        style={{ boxShadow: "0 0 8px 2px hsl(var(--primary)/0.7)" }}
                      />
                    </div>
                    <div className="absolute left-0 right-0" style={{ top: "calc(82% + 6px)" }}>
                      <p className="text-center text-[11px] text-white/75">
                        Align barcode on the <strong className="text-white">back</strong> of your license
                      </p>
                    </div>
                  </div>
                )}

                {/* Barcode detected flash */}
                {barcodeFlash && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-emerald-500/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50">
                      <CheckCircle2 className="h-7 w-7 text-white" />
                    </div>
                    <span className="rounded-full bg-emerald-600/90 px-4 py-1.5 text-sm font-semibold text-white">
                      Barcode detected!
                    </span>
                  </div>
                )}
              </div>

              {cameraError && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {cameraError}
                </p>
              )}
              {parseError && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Could not read barcode: {parseError}.
                  <button type="button" className="underline" onClick={() => { setParsedFields(null); setParseError(null); setCameraState("scanning"); void startCamera() }}>
                    Try again
                  </button>
                </p>
              )}
            </>
          )}

          {/* ══════════════ PHONE MODE ══════════════ */}
          {mode === "phone" && !hasResult && (
            <div className="space-y-4">
              {phoneState === "idle" && (
                <div className="flex flex-col items-center gap-4 text-center py-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Smartphone className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Generate a QR code, scan it with your phone, then point your phone camera at
                    your license barcode. The fields will auto-fill here.
                  </p>
                  <Button className="w-full gap-2" onClick={startPhoneSession}>
                    <QrCode className="h-4 w-4" /> Generate QR Code
                  </Button>
                </div>
              )}

              {phoneState === "creating" && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Creating session…</p>
                </div>
              )}

              {phoneState === "waiting" && qrUrl && (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="rounded-xl border-2 border-primary/30 bg-white p-3 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrUrl} alt="Scan QR code with your phone" width={180} height={180} className="block" />
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-xl animate-ping border-2 border-primary/20 duration-1000" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">Scan with your phone camera</p>
                    <p className="text-xs text-muted-foreground">Then scan your license barcode on the page that opens</p>
                  </div>
                  <div className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Waiting for phone scan…
                    </span>
                    <span className={cn("font-mono font-medium tabular-nums", secondsLeft < 60 && "text-destructive")}>
                      {formatCountdown(secondsLeft)}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { stopPolling(); setPhoneState("idle"); setMobileToken(null); setMobileUrl(null) }}>
                    Cancel / Regenerate
                  </Button>
                </div>
              )}

              {phoneState === "error" && (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-destructive">{phoneError ?? "Something went wrong."}</p>
                  <Button variant="outline" size="sm" onClick={() => { setPhoneState("idle"); setPhoneError(null) }}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Try again
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ RESULT PREVIEW ══════════════ */}
          {hasResult && resultFields && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm font-semibold text-foreground">License read successfully</p>
                  <Badge className="ml-auto bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                    {mode === "phone" ? "Phone scan" : "Camera scan"}
                  </Badge>
                </div>

                <Separator className="bg-emerald-200 dark:bg-emerald-800" />

                {/* Name preview */}
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <User className="h-3.5 w-3.5" /> Name
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {[resultFields.firstName, resultFields.lastName].filter(Boolean).join(" ") || <span className="text-muted-foreground italic">Not found</span>}
                  </p>
                </div>

                {/* Address preview */}
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <MapPin className="h-3.5 w-3.5" /> Address
                  </p>
                  {resultFields.addressLine1 ? (
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {resultFields.addressLine1}<br />
                      {[resultFields.city, resultFields.state].filter(Boolean).join(", ")}{resultFields.zip ? ` ${resultFields.zip}` : ""}
                    </p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">Address not found on barcode</p>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Review the fields above — you can adjust them after applying.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => { resetAll(); if (mode === "camera") void startCamera() }}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Re-scan
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    onApply({
                      fields: resultFields,
                      rawBarcode: mode === "camera" ? (pendingRaw ?? undefined) : undefined,
                    })
                    handleClose()
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Apply to Profile
                </Button>
              </div>
            </div>
          )}

          {/* Privacy note */}
          {!hasResult && (
            <p className="text-center text-[11px] text-muted-foreground">
              Barcode data is used only to fill this form and is <strong>never stored in plain text</strong>.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
