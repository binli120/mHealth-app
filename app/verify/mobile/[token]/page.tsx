/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * /verify/mobile/[token]
 *
 * Mobile-optimised page that opens the camera to scan the PDF417 barcode
 * on the back of a US driver's license. No login required — the session
 * token acts as a short-lived credential.
 *
 * Flow:
 *   1. Validate token (GET to check session status)
 *   2. Open camera → scan DL barcode (ZXing PDF417)
 *   3. POST barcode to /api/identity/mobile-verify/[token]
 *   4. Show success / failure — tell user to return to desktop
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { DecodeHintType, NotFoundException } from "@zxing/library"
import { BrowserPDF417Reader } from "@zxing/browser"
import { ShieldCheck, ScanLine, XCircle, CheckCircle2, Clock, Loader2, AlertTriangle, Flashlight, FlashlightOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState =
  | "loading"       // checking token validity
  | "expired"       // token expired or already used
  | "ready"         // waiting for user to tap Start
  | "scanning"      // camera active, looking for barcode
  | "processing"    // barcode found, calling API
  | "success"       // verified / pending review
  | "failed"        // low match score

interface ApiResponse {
  ok: boolean
  status?: "verified" | "needs_review" | "failed"
  score?: number
  extractedName?: string
  message?: string
  error?: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MobileVerifyPage() {
  const { token } = useParams<{ token: string }>()

  // Initialise to "expired" immediately when there is no token so the effect
  // never has to call setState synchronously in its body.
  const [pageState, setPageState] = useState<PageState>(() => (!token ? "expired" : "loading"))
  const [apiResult, setApiResult] = useState<ApiResponse | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  // Brief green flash after barcode is detected, before API call
  const [barcodeFlash, setBarcodeFlash] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop(): void } | null>(null)
  // Signals the useEffect below that it should actually start the camera once
  // the video element has been mounted (pageState flip happens first, then render,
  // then the effect runs — at that point videoRef.current is guaranteed non-null).
  const shouldStartCameraRef = useRef(false)

  // ── Validate token on mount ────────────────────────────────────────────────
  useEffect(() => {
    // pageState is already "expired" when token is falsy (set via useState initialiser).
    if (!token) return

    let cancelled = false
    // Use the public (no-auth) GET on the mobile-verify route — the mobile
    // device has no session cookie so the authenticated poll endpoint returns 401.
    fetch(`/api/identity/mobile-verify/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; status?: string }) => {
        if (cancelled) return
        if (!data.ok || data.status === "expired" || data.status === "failed") {
          setPageState("expired")
        } else if (data.status === "completed") {
          setPageState("success")
        } else {
          setPageState("ready")
        }
      })
      .catch(() => {
        if (!cancelled) setPageState("expired")
      })

    return () => { cancelled = true }
  }, [token])

  // ── Stop camera helper ─────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  // ── Submit barcode to API ──────────────────────────────────────────────────
  const submitBarcode = useCallback(
    async (rawBarcode: string) => {
      setPageState("processing")
      stopCamera()

      try {
        const res = await fetch(`/api/identity/mobile-verify/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawBarcode }),
        })
        const data = (await res.json()) as ApiResponse
        setApiResult(data)

        if (!data.ok || data.status === "failed") {
          setPageState("failed")
        } else {
          setPageState("success")
        }
      } catch {
        setApiResult({ ok: false, error: "Network error. Please try again." })
        setPageState("failed")
      }
    },
    [token, stopCamera],
  )

  // ── Torch toggle ──────────────────────────────────────────────────────────
  const toggleTorch = useCallback(async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    const track = stream?.getVideoTracks()[0]
    if (!track) return
    try {
      const next = !torchOn
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorchOn(next)
    } catch {
      // torch not supported on this device — hide the button
      setTorchAvailable(false)
    }
  }, [torchOn])

  // ── Start camera (click handler) ───────────────────────────────────────────
  // Only sets state to "scanning" so React re-renders and mounts the <video>
  // element. The useEffect below does the real work once the ref is non-null.
  const startCamera = useCallback(() => {
    setScanError(null)
    shouldStartCameraRef.current = true
    setPageState("scanning")
  }, [])

  // ── Camera initialisation effect ────────────────────────────────────────────
  // Runs after every render where pageState === "scanning". On the first render
  // after startCamera() is called the <video> element is now in the DOM, so
  // videoRef.current is guaranteed non-null here.
  useEffect(() => {
    if (pageState !== "scanning" || !shouldStartCameraRef.current) return
    shouldStartCameraRef.current = false

    const videoEl = videoRef.current
    if (!videoEl) return

    const hints = new Map<DecodeHintType, unknown>()
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserPDF417Reader(hints, { delayBetweenScanAttempts: 50 })

    let cancelled = false

    reader.decodeFromConstraints(
      {
        video: {
          facingMode: { ideal: "environment" },
          width:  { min: 1280, ideal: 1920 },
          height: { min:  720, ideal: 1080 },
        },
      },
      videoEl,
      (result, err) => {
        if (cancelled) return
        if (result) {
          controlsRef.current?.stop()
          setBarcodeFlash(true)
          const raw = result.getText()
          setTimeout(() => {
            setBarcodeFlash(false)
            void submitBarcode(raw)
          }, 750)
        } else if (err && !(err instanceof NotFoundException)) {
          console.warn("[MobileVerify] scan warning:", err)
        }
      },
    )
      .then((controls) => {
        if (cancelled) { controls.stop(); return }
        controlsRef.current = controls
        // Detect torch capability after stream starts
        const track = (videoEl.srcObject as MediaStream | null)?.getVideoTracks()[0]
        if (track) {
          const caps = track.getCapabilities() as Record<string, unknown>
          if (caps.torch) setTorchAvailable(true)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera access was denied. Please allow camera access in your browser settings and try again."
            : "Could not start the camera. Please make sure you are using a modern browser."
        setScanError(msg)
        setPageState("ready")
      })

    return () => { cancelled = true }
  }, [pageState, submitBarcode])

  // Cleanup on unmount
  useEffect(() => () => { stopCamera() }, [stopCamera])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">HealthCompass MA</p>
          <p className="text-xs text-muted-foreground">Identity Verification</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8 gap-6">

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {pageState === "loading" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Validating session…</p>
          </div>
        )}

        {/* ── Expired ──────────────────────────────────────────────────────── */}
        {pageState === "expired" && (
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Link Expired</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                This verification link has expired or already been used. Please go back to your
                desktop and request a new QR code.
              </p>
            </div>
          </div>
        )}

        {/* ── Ready ────────────────────────────────────────────────────────── */}
        {pageState === "ready" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <ScanLine className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Scan Your License</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Flip your driver&apos;s license over and hold the{" "}
                <strong>PDF417 barcode</strong> (the wide striped barcode on the back) up to
                the camera.
              </p>
            </div>

            {scanError && (
              <Alert variant="destructive" className="text-left">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{scanError}</AlertDescription>
              </Alert>
            )}

            <Button className="w-full h-12 text-base" onClick={startCamera}>
              Start Camera
            </Button>

            <p className="text-xs text-muted-foreground">
              Your license data is only used to verify your identity and is never stored in plain text.
            </p>
          </div>
        )}

        {/* ── Scanning ─────────────────────────────────────────────────────── */}
        {pageState === "scanning" && (
          <div className="flex w-full flex-col gap-3">
            <style>{`
              @keyframes dl-scanline {
                0%   { top: 5px }
                50%  { top: calc(100% - 6px) }
                100% { top: 5px }
              }
              .dl-scanline { animation: dl-scanline 1.8s ease-in-out infinite; }
            `}</style>

            <p className="text-center text-sm font-medium text-foreground px-4">
              Align the barcode on the <strong>back</strong> of your license inside the frame
            </p>

            {/* Camera viewport — full width on mobile */}
            <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

              {/* ── Guide overlay (box-shadow cutout) ──────────────────── */}
              {!barcodeFlash && (
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="absolute rounded-sm border border-white/20"
                    style={{
                      top: "26%", left: "5%", right: "5%", bottom: "26%",
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.58)",
                    }}
                  >
                    {/* L-shaped corner accents */}
                    <span className="absolute -top-px -left-px h-6 w-6 border-t-[3px] border-l-[3px] border-primary rounded-tl-sm" />
                    <span className="absolute -top-px -right-px h-6 w-6 border-t-[3px] border-r-[3px] border-primary rounded-tr-sm" />
                    <span className="absolute -bottom-px -left-px h-6 w-6 border-b-[3px] border-l-[3px] border-primary rounded-bl-sm" />
                    <span className="absolute -bottom-px -right-px h-6 w-6 border-b-[3px] border-r-[3px] border-primary rounded-br-sm" />
                    {/* Animated scan line */}
                    <div
                      className="dl-scanline absolute left-3 right-3 h-[3px] rounded-full bg-primary"
                      style={{ boxShadow: "0 0 10px 3px hsl(var(--primary) / 0.75)" }}
                    />
                  </div>
                  {/* Hint below the guide rect */}
                  <div className="absolute left-0 right-0 flex flex-col items-center gap-1" style={{ top: "calc(74% + 8px)" }}>
                    <p className="text-center text-xs text-white/75">
                      Hold barcode <strong className="text-white">6–10 in.</strong> from camera · hold steady
                    </p>
                    <p className="text-center text-[11px] text-white/50">
                      Barcode is on the <strong className="text-white/70">back</strong> · good lighting required
                    </p>
                  </div>
                  {/* Torch button — only shown when supported */}
                  {torchAvailable && (
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={toggleTorch}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-md transition-colors",
                          torchOn
                            ? "bg-yellow-400 text-yellow-900"
                            : "bg-black/60 text-white/80 border border-white/20"
                        )}
                      >
                        {torchOn ? <Flashlight className="h-3.5 w-3.5" /> : <FlashlightOff className="h-3.5 w-3.5" />}
                        {torchOn ? "Light on" : "Light off"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Barcode detected flash ──────────────────────────────── */}
              {barcodeFlash && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-emerald-500/25">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/50">
                    <CheckCircle2 className="h-9 w-9 text-white" />
                  </div>
                  <span className="rounded-full bg-emerald-600/90 px-5 py-2 text-base font-bold text-white shadow-lg">
                    Barcode detected!
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => { stopCamera(); setBarcodeFlash(false); setPageState("ready") }}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* ── Processing ───────────────────────────────────────────────────── */}
        {pageState === "processing" && (
          <div className="flex w-full flex-col items-center gap-5 text-center">
            {/* Keep the frozen camera visible with a verifying overlay */}
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="h-full w-full object-cover opacity-40" playsInline muted />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-semibold text-foreground">Verifying identity…</p>
                <p className="text-xs text-muted-foreground">This only takes a moment.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Success ──────────────────────────────────────────────────────── */}
        {pageState === "success" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
            <div
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full",
                apiResult?.status === "needs_review"
                  ? "bg-amber-100 dark:bg-amber-900/30"
                  : "bg-emerald-100 dark:bg-emerald-900/30",
              )}
            >
              {apiResult?.status === "needs_review" ? (
                <Clock className="h-10 w-10 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {apiResult?.status === "needs_review" ? "Submitted for Review" : "Identity Verified!"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {apiResult?.message ??
                  "You can now return to the desktop. The page there will update automatically."}
              </p>
              {apiResult?.extractedName && (
                <p className="mt-3 text-base font-medium text-foreground">{apiResult.extractedName}</p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 px-5 py-4 text-sm text-muted-foreground w-full">
              ✓ Return to your desktop — it will update automatically.
            </div>
          </div>
        )}

        {/* ── Failed ───────────────────────────────────────────────────────── */}
        {pageState === "failed" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Verification Failed</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {apiResult?.message ?? apiResult?.error ?? "Please try again."}
              </p>
            </div>
            <Button className="w-full" onClick={() => { setApiResult(null); setPageState("ready") }}>
              Try Again
            </Button>
          </div>
        )}

      </main>
    </div>
  )
}
