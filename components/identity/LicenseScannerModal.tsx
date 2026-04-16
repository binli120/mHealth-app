/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * LicenseScannerModal
 *
 * Three scan modes:
 *   1. Camera       — ZXing PDF417 continuous scan via desktop/laptop webcam
 *   2. Upload Photo — fallback image-file decode via ZXing
 *   3. Scan with Phone — QR code handoff: desktop shows QR → phone opens
 *                        /verify/mobile/{token} → phone scans DL barcode →
 *                        desktop polls for completion → Redux updated
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DecodeHintType, NotFoundException } from "@zxing/library"
import { BrowserPDF417Reader } from "@zxing/browser"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Camera,
  Upload,
  Smartphone,
  ScanLine,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  QrCode,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { toUserFacingError } from "@/lib/errors/user-facing"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  closeScanner,
  setLoading,
  setError,
  verificationSucceeded,
  verificationPending,
  verificationFailed,
} from "@/lib/redux/features/identity-verification-slice"

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanMode = "camera" | "upload" | "phone"
type ScanState = "idle" | "scanning" | "processing" | "done"

// Phone-mode states
type PhoneState =
  | "idle"          // not yet started
  | "creating"      // calling POST /api/identity/mobile-session
  | "waiting"       // QR displayed, polling for completion
  | "completed"     // mobile finished

interface VerifyApiResponse {
  ok: boolean
  status?: "verified" | "needs_review" | "failed"
  score?: number
  breakdown?: Record<string, boolean>
  isExpired?: boolean
  extractedName?: string
  verifiedAt?: string | null
  message?: string
  error?: string
}

interface MobileSessionResponse {
  ok: boolean
  token?: string
  expiresAt?: string
  mobileUrl?: string
  error?: string
}

interface PollResponse {
  ok: boolean
  status?: "pending" | "completed" | "failed" | "expired"
  verifyStatus?: "verified" | "needs_review" | "failed"
  verifyScore?: number
  verifyBreakdown?: Record<string, boolean>
  error?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LicenseScannerModal() {
  const dispatch = useAppDispatch()
  const { scannerOpen, loading, error } = useAppSelector((s) => s.identityVerification)

  const [mode, setMode] = useState<ScanMode>("phone")
  const [scanState, setScanState] = useState<ScanState>("idle")
  const [apiResult, setApiResult] = useState<VerifyApiResponse | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  // Brief "✓ Barcode detected!" flash before the API call starts
  const [barcodeFlash, setBarcodeFlash] = useState(false)

  // Phone-mode state
  const [phoneState, setPhoneState] = useState<PhoneState>("idle")
  const [mobileToken, setMobileToken] = useState<string | null>(null)
  const [mobileUrl, setMobileUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number>(600)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop(): void } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Stop camera ─────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  // ── Stop polling ─────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }, [])

  // ── Close modal ──────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    stopCamera()
    stopPolling()
    setScanState("idle")
    setApiResult(null)
    setCameraError(null)
    setPhoneState("idle")
    setMobileToken(null)
    setMobileUrl(null)
    setExpiresAt(null)
    dispatch(closeScanner())
  }, [dispatch, stopCamera, stopPolling])

  // ── Handle verification API result (shared by camera/upload/phone) ───────
  const handleVerifyResult = useCallback(
    (data: VerifyApiResponse | PollResponse, fromPhone = false) => {
      const status = "verifyStatus" in data ? data.verifyStatus : data.status
      const score = "verifyScore" in data ? data.verifyScore : (data as VerifyApiResponse).score

      if (!data.ok || !status) {
        const msg = toUserFacingError(data.error, "Verification failed.")
        dispatch(setError(msg))
        return
      }

      if (status === "verified") {
        dispatch(verificationSucceeded({
          score: score ?? 100,
          verifiedAt: new Date().toISOString(),
        }))
        if (fromPhone) setPhoneState("completed")
      } else if (status === "needs_review") {
        dispatch(verificationPending({ score: score ?? 0 }))
        if (fromPhone) setPhoneState("completed")
      } else {
        dispatch(verificationFailed({
          score: score ?? 0,
          error: "Identity could not be confirmed. Please ensure your profile matches your license.",
        }))
        if (fromPhone) setPhoneState("completed")
      }
    },
    [dispatch],
  )

  // ── Submit barcode (camera / upload path) ────────────────────────────────
  const submitBarcode = useCallback(
    async (rawBarcode: string) => {
      setScanState("processing")
      dispatch(setLoading(true))
      try {
        const res = await authenticatedFetch("/api/identity/verify-license", {
          method: "POST",
          body: JSON.stringify({ rawBarcode }),
        })
        const data = (await res.json().catch(() => ({}))) as VerifyApiResponse
        setApiResult(data)
        handleVerifyResult(data)
        setScanState("done")
      } catch (err) {
        const msg = toUserFacingError(err, "Verification failed.")
        dispatch(setError(msg))
        setScanState("done")
      }
    },
    [dispatch, handleVerifyResult],
  )

  // ── Camera scan ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return
    setCameraError(null)
    setScanState("scanning")

    // BrowserPDF417Reader is purpose-built for PDF417 — no multi-format overhead.
    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserPDF417Reader(hints, { delayBetweenScanAttempts: 50 })

    try {
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            // Request the highest resolution the camera supports.
            width:  { min: 1280, ideal: 1920 },
            height: { min:  720, ideal: 1080 },
          },
        },
        videoRef.current,
        (result, err) => {
          if (result) {
            controlsRef.current?.stop()
            setBarcodeFlash(true)
            const raw = result.getText()
            setTimeout(() => {
              setBarcodeFlash(false)
              void submitBarcode(raw)
            }, 750)
          } else if (err && !(err instanceof NotFoundException)) {
            console.warn("[LicenseScanner]", err)
          }
        },
      )
      controlsRef.current = controls
    } catch (err) {
      const msg = err instanceof Error && err.name === "NotAllowedError"
        ? "Camera access was denied. Please allow camera access or use the upload option."
        : "Could not access the camera. Please try uploading an image instead."
      setCameraError(msg)
      setScanState("idle")
    }
  }, [submitBarcode])

  // Auto-start camera when tab is selected
  useEffect(() => {
    if (scannerOpen && mode === "camera" && scanState === "idle") void startCamera()
    return () => { if (!scannerOpen) stopCamera() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen, mode])

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setScanState("scanning")
      setCameraError(null)
      const hints = new Map<DecodeHintType, unknown>()
      hints.set(DecodeHintType.TRY_HARDER, true)
      const reader = new BrowserPDF417Reader(hints)
      const url = URL.createObjectURL(file)
      try {
        const result = await reader.decodeFromImageUrl(url)
        void submitBarcode(result.getText())
      } catch {
        setCameraError("Could not find a barcode in the image. Make sure you photographed the back of the license clearly.")
        setScanState("idle")
      } finally {
        URL.revokeObjectURL(url)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [submitBarcode],
  )

  // ── Phone mode: create session + start polling ───────────────────────────
  const startPhoneSession = useCallback(async () => {
    setPhoneState("creating")
    try {
      const res = await authenticatedFetch("/api/identity/mobile-session", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as MobileSessionResponse
      if (!data.ok || !data.token || !data.mobileUrl) {
        dispatch(setError(toUserFacingError(data.error, "Could not create phone session.")))
        setPhoneState("idle")
        return
      }

      setMobileToken(data.token)
      setMobileUrl(data.mobileUrl)
      const exp = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 600_000)
      setExpiresAt(exp)
      setSecondsLeft(Math.max(0, Math.round((exp.getTime() - Date.now()) / 1000)))
      setPhoneState("waiting")

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) { stopPolling(); setPhoneState("idle"); return 0 }
          return s - 1
        })
      }, 1000)

      // Poll every 2 seconds
      pollRef.current = setInterval(async () => {
        try {
          const r = await authenticatedFetch(
            `/api/identity/mobile-session?token=${encodeURIComponent(data.token!)}`,
            { method: "GET" },
          )
          const poll = (await r.json().catch(() => ({}))) as PollResponse

          if (!poll.ok) return
          if (poll.status === "completed") {
            stopPolling()
            handleVerifyResult(poll, true)
          } else if (poll.status === "expired" || poll.status === "failed") {
            stopPolling()
            setPhoneState("idle")
          }
        } catch { /* non-fatal */ }
      }, 2000)

    } catch (err) {
      const msg = toUserFacingError(err, "Could not create phone session.")
      dispatch(setError(msg))
      setPhoneState("idle")
    }
  }, [dispatch, handleVerifyResult, stopPolling])

  // Cleanup on unmount / close
  useEffect(() => () => { stopPolling() }, [stopPolling])

  const handleRetry = useCallback(() => {
    stopPolling()
    setApiResult(null)
    setCameraError(null)
    setScanState("idle")
    setBarcodeFlash(false)
    setPhoneState("idle")
    setMobileToken(null)
    setMobileUrl(null)
    if (mode === "camera") void startCamera()
  }, [mode, startCamera, stopPolling])

  const switchMode = useCallback((m: ScanMode) => {
    stopCamera()
    stopPolling()
    setMode(m)
    setScanState("idle")
    setCameraError(null)
    setApiResult(null)
    setPhoneState("idle")
    setMobileToken(null)
    setMobileUrl(null)
  }, [stopCamera, stopPolling])

  const isDone = scanState === "done" || phoneState === "completed"
  const qrUrl = mobileUrl
    ? `/api/identity/qrcode?url=${encodeURIComponent(mobileUrl)}`
    : null

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, "0")}`
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={scannerOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verify Your Identity
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Scan the <strong>PDF417 barcode on the back</strong> of your US driver&apos;s
            license or REAL ID card.
          </DialogDescription>
        </DialogHeader>

        {/* Mode tabs */}
        {!isDone && (
          <div className="flex border-b border-border">
            {(["phone", "camera", "upload"] as ScanMode[]).map((m) => {
              const Icon = m === "phone" ? Smartphone : m === "camera" ? Camera : Upload
              const label = m === "phone" ? "Scan with Phone" : m === "camera" ? "Camera" : "Upload"
              return (
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
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              )
            })}
          </div>
        )}

        <div className="px-6 pb-6 pt-4 space-y-4">

          {/* ════════════════ PHONE MODE ════════════════ */}
          {mode === "phone" && !isDone && (
            <div className="space-y-4">
              {phoneState === "idle" && (
                <div className="flex flex-col items-center gap-4 text-center py-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Smartphone className="h-7 w-7 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Use your phone&apos;s camera</p>
                    <p className="text-sm text-muted-foreground">
                      A QR code will appear. Scan it with your phone to open a page
                      where you can scan your license barcode using your phone&apos;s rear camera.
                    </p>
                  </div>
                  <Button className="w-full gap-2" onClick={startPhoneSession}>
                    <QrCode className="h-4 w-4" />
                    Generate QR Code
                  </Button>
                </div>
              )}

              {phoneState === "creating" && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Creating secure session…</p>
                </div>
              )}

              {phoneState === "waiting" && qrUrl && (
                <div className="flex flex-col items-center gap-4">
                  {/* QR code */}
                  <div className="relative">
                    <div className="rounded-xl border-2 border-primary/30 bg-white p-3 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrUrl}
                        alt="Scan with phone QR code"
                        width={200}
                        height={200}
                        className="block"
                      />
                    </div>
                    {/* Animated scan pulse ring */}
                    <div className="pointer-events-none absolute inset-0 rounded-xl animate-ping border-2 border-primary/20 duration-1000" />
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Scan this QR code with your phone
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Point your phone camera at the QR code to open the verification page
                    </p>
                  </div>

                  {/* Step instructions */}
                  <ol className="w-full space-y-2 text-xs text-muted-foreground">
                    {[
                      "Scan QR code with your phone camera",
                      "Allow camera access on the page that opens",
                      "Point your phone at the barcode on the back of your license",
                      "This desktop will update automatically",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>

                  {/* Polling indicator + countdown */}
                  <div className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Waiting for phone scan…
                    </span>
                    <span className={cn("font-mono font-medium tabular-nums", secondsLeft < 60 && "text-destructive")}>
                      {formatCountdown(secondsLeft)}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => { stopPolling(); setPhoneState("idle"); setMobileToken(null); setMobileUrl(null) }}
                  >
                    Cancel / Regenerate
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ CAMERA MODE ════════════════ */}
          {mode === "camera" && scanState !== "done" && (
            <>
              <style>{`
                @keyframes dl-scanline {
                  0%   { top: 4px }
                  50%  { top: calc(100% - 5px) }
                  100% { top: 4px }
                }
                .dl-scanline { animation: dl-scanline 1.8s ease-in-out infinite; }
              `}</style>

              <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

                {/* ── Guide overlay — dark surround with transparent cutout ── */}
                {scanState === "scanning" && !barcodeFlash && (
                  <div className="pointer-events-none absolute inset-0">
                    {/* The guide rect: box-shadow creates the dark surround */}
                    <div
                      className="absolute rounded-sm border border-white/30"
                      style={{
                        top: "18%", left: "7%", right: "7%", bottom: "18%",
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.58)",
                      }}
                    >
                      {/* L-shaped corner accents */}
                      <span className="absolute -top-px -left-px h-5 w-5 border-t-[3px] border-l-[3px] border-primary rounded-tl-sm" />
                      <span className="absolute -top-px -right-px h-5 w-5 border-t-[3px] border-r-[3px] border-primary rounded-tr-sm" />
                      <span className="absolute -bottom-px -left-px h-5 w-5 border-b-[3px] border-l-[3px] border-primary rounded-bl-sm" />
                      <span className="absolute -bottom-px -right-px h-5 w-5 border-b-[3px] border-r-[3px] border-primary rounded-br-sm" />
                      {/* Animated scan line */}
                      <div
                        className="dl-scanline absolute left-3 right-3 h-[2px] rounded-full bg-primary"
                        style={{ boxShadow: "0 0 8px 2px hsl(var(--primary) / 0.7)" }}
                      />
                    </div>
                    {/* Hint label */}
                    <div className="absolute left-0 right-0 flex flex-col items-center gap-0.5" style={{ top: "calc(82% + 6px)" }}>
                      <p className="text-center text-[11px] text-white/75">
                        Back of license · barcode side up · fill the frame
                      </p>
                      <p className="text-center text-[10px] text-white/50">
                        Good lighting required — barcode is 6–12 in. from lens
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Barcode detected flash ───────────────────────────────── */}
                {barcodeFlash && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-emerald-500/20">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50">
                      <CheckCircle2 className="h-8 w-8 text-white" />
                    </div>
                    <span className="rounded-full bg-emerald-600/90 px-4 py-1.5 text-sm font-semibold text-white shadow">
                      Barcode detected!
                    </span>
                  </div>
                )}

                {/* ── Verifying overlay ────────────────────────────────────── */}
                {scanState === "processing" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65">
                    <Spinner className="h-9 w-9 text-white" />
                    <span className="text-sm font-medium text-white">Verifying identity…</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════════════════ UPLOAD MODE ════════════════ */}
          {mode === "upload" && scanState !== "done" && (
            <div className="space-y-3">
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-10 transition-colors hover:border-primary/50 hover:bg-muted/30"
                onClick={() => fileInputRef.current?.click()}
              >
                {scanState === "scanning"
                  ? <Spinner className="h-8 w-8 text-muted-foreground" />
                  : <Upload className="h-8 w-8 text-muted-foreground" />
                }
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {scanState === "scanning" ? "Scanning barcode…" : "Click to upload an image"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Photo of the back of your license</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {/* ════════════════ ERRORS ════════════════ */}
          {(cameraError || (error && !apiResult && phoneState !== "waiting")) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{cameraError ?? error}</AlertDescription>
            </Alert>
          )}

          {/* ════════════════ RESULT (camera/upload) ════════════════ */}
          {scanState === "done" && apiResult && (
            <div className="space-y-4">
              <ResultCard result={apiResult} />
              {apiResult.status !== "verified" && (
                <Button variant="outline" className="w-full" onClick={handleRetry}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Try Again
                </Button>
              )}
              <Button className="w-full" onClick={handleClose} variant={apiResult.status === "verified" ? "default" : "ghost"}>
                {apiResult.status === "verified" ? "Continue" : "Close"}
              </Button>
            </div>
          )}

          {/* ════════════════ RESULT (phone) ════════════════ */}
          {phoneState === "completed" && (
            <PhoneResultCard dispatch={dispatch} onClose={handleClose} onRetry={handleRetry} />
          )}

          {/* Privacy note */}
          {!isDone && (
            <p className="text-center text-xs text-muted-foreground">
              Your license data is only used to confirm your identity and is{" "}
              <strong>never stored in plain text</strong>.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Result card (camera / upload) ───────────────────────────────────────────

function ResultCard({ result }: { result: VerifyApiResponse }) {
  const cfg = {
    verified: {
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />,
      title: "Identity Verified",
      badge: <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Verified</Badge>,
      bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
    },
    needs_review: {
      icon: <Clock className="h-6 w-6 text-amber-600" />,
      title: "Under Review",
      badge: <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending Review</Badge>,
      bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    },
    failed: {
      icon: <XCircle className="h-6 w-6 text-destructive" />,
      title: "Verification Failed",
      badge: <Badge variant="destructive">Failed</Badge>,
      bg: "bg-destructive/5 border-destructive/20",
    },
  }[result.status ?? "failed"]

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", cfg.bg)}>
      <div className="flex items-center gap-3">
        {cfg.icon}
        <div className="flex-1">
          <p className="font-semibold text-foreground">{cfg.title}</p>
          {result.extractedName && <p className="text-sm text-muted-foreground">{result.extractedName}</p>}
        </div>
        {cfg.badge}
      </div>
      {typeof result.score === "number" && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Match score</span>
            <span className="font-medium">{result.score}/100</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all",
                result.score >= 70 ? "bg-emerald-500" : result.score >= 50 ? "bg-amber-500" : "bg-destructive")}
              style={{ width: `${result.score}%` }}
            />
          </div>
        </div>
      )}
      {result.breakdown && (
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(result.breakdown).map(([field, matched]) => (
            <div key={field} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {matched ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              <span className="capitalize">{field.replace(/([A-Z])/g, " $1").trim()}</span>
            </div>
          ))}
        </div>
      )}
      {result.message && <p className="text-xs text-muted-foreground">{result.message}</p>}
      {result.isExpired && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">Your license appears to be expired.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// ─── Phone result card ────────────────────────────────────────────────────────

function PhoneResultCard({
  dispatch,
  onClose,
  onRetry,
}: {
  dispatch: ReturnType<typeof useAppDispatch>
  onClose: () => void
  onRetry: () => void
}) {
  const { status, score } = useAppSelector((s) => s.identityVerification)
  const isVerified = status === "verified"
  const isPending = status === "pending"

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-4",
      isVerified ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
        : isPending ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
          : "bg-destructive/5 border-destructive/20"
    )}>
      <div className="flex items-center gap-3">
        {isVerified
          ? <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          : isPending
            ? <Clock className="h-7 w-7 text-amber-600" />
            : <XCircle className="h-7 w-7 text-destructive" />
        }
        <div>
          <p className="font-semibold text-foreground">
            {isVerified ? "Identity Verified!" : isPending ? "Under Review" : "Verification Failed"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isVerified ? "Your phone scan was successful."
              : isPending ? "A staff member will confirm shortly."
                : "The scan did not match your profile."}
          </p>
        </div>
      </div>

      {typeof score === "number" && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Match score</span>
            <span className="font-medium">{score}/100</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-destructive")}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      )}

      {!isVerified && !isPending && (
        <Button variant="outline" className="w-full" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try Again
        </Button>
      )}
      <Button className="w-full" onClick={onClose} variant={isVerified ? "default" : "ghost"}>
        {isVerified ? "Continue" : "Close"}
      </Button>
    </div>
  )
}
