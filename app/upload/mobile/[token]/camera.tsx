/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Client component — camera capture and upload for the mobile document page.
 *
 * Features
 * ─────────────────────────────────────────────────────────────────────────────
 * • getUserMedia live feed with a credit-card–shaped overlay frame
 * • Stability-based auto-capture: fills a progress bar while the phone is
 *   held steady, then fires automatically (~1.5 s of stillness)
 * • Manual capture button as a fallback to auto-capture
 * • Dual-side flow for government IDs (front → back → single POST)
 * • Graceful fallback to <label>+<input> file picker when getUserMedia is
 *   unavailable (HTTP dev environment, permission denied, older browsers)
 */

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  Camera,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Constants ─────────────────────────────────────────────────────────────────

/** Document types that require both front and back photos */
const DUAL_SIDE_TYPES = new Set([
  "government_id",
  "government-id",
  "driver_license",
  "drivers_license",
  "driver-license",
  "drivers-license",
  "state_id",
  "state-id",
])

function needsDualSide(documentType: string | null): boolean {
  if (!documentType) return false
  return DUAL_SIDE_TYPES.has(documentType.toLowerCase().replace(/\s+/g, "_"))
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Side = "front" | "back"

type Phase =
  | { name: "camera"; side: Side }
  | { name: "review"; side: Side; blob: Blob; url: string }
  | { name: "uploading" }
  | { name: "success" }
  | { name: "error"; message: string }

// ── Main component ────────────────────────────────────────────────────────────

interface MobileUploadCameraProps {
  token: string
  documentLabel: string | null
  documentType: string | null
}

export function MobileUploadCamera({
  token,
  documentLabel,
  documentType,
}: MobileUploadCameraProps) {
  const dualSide = needsDualSide(documentType)

  const [phase, setPhase] = useState<Phase>({ name: "camera", side: "front" })
  // Hold captured blobs across phase transitions without triggering re-renders
  const capturedRef = useRef<{ front?: Blob; back?: Blob }>({})

  // ── Upload ──────────────────────────────────────────────────────────────────

  const startUpload = useCallback(
    async (front: Blob, back?: Blob) => {
      setPhase({ name: "uploading" })

      const formData = new FormData()
      if (dualSide && back) {
        formData.append("file_front", front, "front.jpg")
        formData.append("file_back", back, "back.jpg")
      } else {
        formData.append("file", front, "document.jpg")
      }

      try {
        const res = await fetch(
          `/api/upload/mobile/${encodeURIComponent(token)}`,
          { method: "POST", body: formData },
        )
        const data = (await res.json()) as { ok: boolean; error?: string }
        if (!data.ok) {
          setPhase({
            name: "error",
            message: data.error ?? "Upload failed. Please try again.",
          })
          return
        }
        setPhase({ name: "success" })
      } catch {
        setPhase({
          name: "error",
          message: "Network error. Please check your connection and try again.",
        })
      }
    },
    [dualSide, token],
  )

  // ── Capture handlers ────────────────────────────────────────────────────────

  const handleCapture = useCallback((side: Side, blob: Blob) => {
    const url = URL.createObjectURL(blob)
    setPhase({ name: "review", side, blob, url })
  }, [])

  const handleConfirm = useCallback(
    (side: Side, blob: Blob) => {
      if (side === "front") {
        capturedRef.current.front = blob
        if (dualSide) {
          setPhase({ name: "camera", side: "back" })
        } else {
          void startUpload(blob)
        }
      } else {
        capturedRef.current.back = blob
        void startUpload(capturedRef.current.front!, blob)
      }
    },
    [dualSide, startUpload],
  )

  const handleRetake = useCallback((side: Side, url: string) => {
    URL.revokeObjectURL(url)
    if (side === "back") {
      capturedRef.current.back = undefined
    } else {
      capturedRef.current = {}
    }
    setPhase({ name: "camera", side })
  }, [])

  const handleRestart = useCallback(() => {
    capturedRef.current = {}
    setPhase({ name: "camera", side: "front" })
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase.name === "success") return <SuccessView />

  if (phase.name === "uploading") return <UploadingView />

  if (phase.name === "error") {
    return <ErrorView message={phase.message} onRetry={handleRestart} />
  }

  if (phase.name === "review") {
    const { side, blob, url } = phase
    return (
      <ReviewView
        imageUrl={url}
        sideLabel={dualSide ? (side === "front" ? "Front" : "Back") : undefined}
        confirmLabel={
          dualSide && side === "front"
            ? "Looks Good — Flip to Back ›"
            : dualSide
              ? "Upload Both Photos"
              : "Use This Photo"
        }
        onRetake={() => handleRetake(side, url)}
        onConfirm={() => handleConfirm(side, blob)}
      />
    )
  }

  const { side } = phase
  return (
    <CameraView
      side={side}
      dualSide={dualSide}
      documentLabel={documentLabel}
      onCapture={(blob) => handleCapture(side, blob)}
    />
  )
}

// ── CameraView ────────────────────────────────────────────────────────────────

interface CameraViewProps {
  side: Side
  dualSide: boolean
  documentLabel: string | null
  onCapture: (blob: Blob) => void
}

function CameraView({ side, dualSide, documentLabel, onCapture }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onCaptureRef = useRef(onCapture)
  useEffect(() => { onCaptureRef.current = onCapture }, [onCapture])

  // Compute camera support once at mount — never changes, so safe as a memo
  // with no deps. This keeps the effect below free of synchronous setState calls.
  const cameraSupported = useMemo(() => {
    if (typeof window === "undefined") return false
    return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia)
  }, [])

  const [camState, setCamState] = useState<"init" | "live" | "failed">(
    cameraSupported ? "init" : "failed",
  )
  const [stability, setStability] = useState(0) // 0–1
  const stableCountRef = useRef(0)
  const prevPixelsRef = useRef<Uint8ClampedArray | null>(null)
  const capturedFiredRef = useRef(false)

  // ── Start camera ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!cameraSupported) return

    let cancelled = false
    capturedFiredRef.current = false
    stableCountRef.current = 0
    prevPixelsRef.current = null

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {
        if (!cancelled) setCamState("failed")
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      // Reset visual state so the loading spinner shows while the next side's stream starts
      setCamState("init")
      setStability(0)
    }
  }, [side, cameraSupported]) // re-init stream when switching front ↔ back

  // ── Capture helpers (declared before the stability effect that calls them) ──

  const doCapture = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => { if (blob) onCaptureRef.current(blob) },
      "image/jpeg",
      0.92,
    )
  }, []) // refs are stable — no deps needed

  const handleManualCapture = useCallback(() => {
    if (capturedFiredRef.current) return
    capturedFiredRef.current = true
    doCapture()
  }, [doCapture])

  // ── Stability-based auto-capture ─────────────────────────────────────────

  useEffect(() => {
    if (camState !== "live") return

    const INTERVAL_MS = 250
    const STABLE_THRESHOLD = 5   // mean abs diff per RGB channel (0–255)
    const STABLE_NEEDED = 6      // consecutive frames ≈ 1.5 s

    const offscreen = document.createElement("canvas")
    offscreen.width = 128
    offscreen.height = 80
    const ctx = offscreen.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    const id = setInterval(() => {
      if (capturedFiredRef.current) return
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      ctx.drawImage(video, 0, 0, 128, 80)
      const { data } = ctx.getImageData(0, 0, 128, 80)
      const prev = prevPixelsRef.current

      if (prev) {
        let sum = 0
        for (let i = 0; i < data.length; i += 4) {
          sum +=
            Math.abs(data[i] - prev[i]) +
            Math.abs(data[i + 1] - prev[i + 1]) +
            Math.abs(data[i + 2] - prev[i + 2])
        }
        const diff = sum / (data.length / 4) / 3

        if (diff < STABLE_THRESHOLD) {
          stableCountRef.current = Math.min(stableCountRef.current + 1, STABLE_NEEDED)
          setStability(stableCountRef.current / STABLE_NEEDED)
          if (stableCountRef.current >= STABLE_NEEDED) {
            capturedFiredRef.current = true
            doCapture()
          }
        } else {
          stableCountRef.current = Math.max(stableCountRef.current - 1, 0)
          setStability(stableCountRef.current / STABLE_NEEDED)
        }
      }

      prevPixelsRef.current = new Uint8ClampedArray(data)
    }, INTERVAL_MS)

    return () => clearInterval(id)
  }, [camState, doCapture])

  // ── Fallback if getUserMedia unavailable ─────────────────────────────────

  if (camState === "failed") {
    return (
      <FileFallback
        side={side}
        dualSide={dualSide}
        documentLabel={documentLabel}
        onCapture={onCapture}
      />
    )
  }

  // ── Camera UI ─────────────────────────────────────────────────────────────

  const sideLabel = dualSide
    ? side === "front"
      ? "Front of ID"
      : "Back of ID"
    : (documentLabel ?? "Document")

  const hint =
    side === "front"
      ? "Align the front of your ID inside the frame"
      : "Flip your ID and align the back inside the frame"

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Step indicator */}
      {dualSide && (
        <div className="flex items-center justify-center gap-2">
          <StepDot active={side === "front"} done={side === "back"} label="Front" />
          <div className="h-px w-8 bg-border" />
          <StepDot active={side === "back"} done={false} label="Back" />
        </div>
      )}

      {/* Live video with overlay */}
      <div
        className="relative w-full overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: "4 / 3" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          onCanPlay={() => setCamState("live")}
        />

        {/* Spinner while camera initialises */}
        {camState === "init" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="text-xs text-white/70">Starting camera…</p>
          </div>
        )}

        {/* Card outline overlay + dark vignette */}
        {camState === "live" && (
          <div className="pointer-events-none absolute inset-0">
            {/* The card rectangle — credit-card ratio 85.6 : 54 ≈ 1.586 */}
            <div
              style={{
                position: "absolute",
                left: "6%",
                right: "6%",
                top: "50%",
                transform: "translateY(-55%)",
                aspectRatio: "1.586",
                borderRadius: 10,
                border: "2.5px solid rgba(255,255,255,0.92)",
                // box-shadow trick creates the darkened area outside the cutout
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.48)",
              }}
            >
              {/* Corner brackets */}
              <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-[6px] border-l-[3px] border-t-[3px] border-white" />
              <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-[6px] border-r-[3px] border-t-[3px] border-white" />
              <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-[6px] border-b-[3px] border-l-[3px] border-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-[6px] border-b-[3px] border-r-[3px] border-white" />

              {/* Side label inside frame */}
              <div className="absolute inset-x-0 top-2 flex justify-center">
                <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
                  {sideLabel}
                </span>
              </div>
            </div>

            {/* Hint text below the card */}
            <div className="absolute bottom-3 inset-x-0 flex justify-center">
              <span className="rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/85">
                {hint}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Auto-capture stability bar */}
      {camState === "live" && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Hold still to auto-capture</span>
            <span className="tabular-nums">{Math.round(stability * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                stability >= 1 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${stability * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Manual capture button */}
      {camState === "live" && (
        <button
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 active:scale-[0.98]"
          onClick={handleManualCapture}
        >
          <Camera className="h-4 w-4" />
          Capture {sideLabel}
        </button>
      )}
    </div>
  )
}

// ── FileFallback ──────────────────────────────────────────────────────────────
// Used when getUserMedia is unavailable (HTTP, permission denied, old browser).
// <label htmlFor> is the only cross-browser reliable way to open a file input
// programmatically on mobile (programmatic .click() is blocked by iOS Safari).

interface FileFallbackProps {
  side: Side
  dualSide: boolean
  documentLabel: string | null
  onCapture: (blob: Blob) => void
}

function FileFallback({ side, dualSide, documentLabel, onCapture }: FileFallbackProps) {
  const sideLabel = dualSide
    ? side === "front" ? "Front of ID" : "Back of ID"
    : (documentLabel ?? "Document")

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onCapture(file)
    e.target.value = ""
  }

  // Unique IDs prevent conflicts if both sides render simultaneously (they don't,
  // but it's good practice)
  const cameraId = `file-capture-${side}-cam`
  const galleryId = `file-capture-${side}-gallery`

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
      {dualSide && (
        <div className="flex items-center justify-center gap-2">
          <StepDot active={side === "front"} done={side === "back"} label="Front" />
          <div className="h-px w-8 bg-border" />
          <StepDot active={side === "back"} done={false} label="Back" />
        </div>
      )}

      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <Camera className="h-10 w-10 text-primary" />
      </div>

      <div>
        <h2 className="text-lg font-semibold">{sideLabel}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {side === "back"
            ? "Flip your ID and photograph the back."
            : "Use your camera to photograph the document."}
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <label
          htmlFor={cameraId}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 active:scale-[0.98]"
        >
          <Camera className="h-4 w-4" />
          Open Camera
        </label>
        <input
          id={cameraId}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleChange}
        />

        <label
          htmlFor={galleryId}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground active:scale-[0.98]"
        >
          <Upload className="h-4 w-4" />
          Choose from Gallery
        </label>
        <input
          id={galleryId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  )
}

// ── ReviewView ────────────────────────────────────────────────────────────────

function ReviewView({
  imageUrl,
  sideLabel,
  confirmLabel,
  onRetake,
  onConfirm,
}: {
  imageUrl: string
  sideLabel?: string
  confirmLabel: string
  onRetake: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      {sideLabel && (
        <p className="text-center text-sm font-medium text-muted-foreground">
          {sideLabel} — Review Photo
        </p>
      )}

      {/* Preview — uses credit-card aspect ratio so the photo isn't distorted */}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border bg-secondary"
        style={{ aspectRatio: "1.586" }}
      >
        <Image
          src={imageUrl}
          alt="Captured document"
          fill
          unoptimized
          className="object-contain"
        />
      </div>

      <div className="flex gap-3">
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          onClick={onRetake}
        >
          <RotateCcw className="h-4 w-4" />
          Retake
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ── UploadingView ─────────────────────────────────────────────────────────────

function UploadingView() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm font-medium">Uploading your document…</p>
      <p className="text-xs text-muted-foreground">Please keep this page open.</p>
    </div>
  )
}

// ── SuccessView ───────────────────────────────────────────────────────────────

function SuccessView() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" />
      </div>
      <h2 className="text-lg font-semibold">Upload Complete!</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        Your document has been uploaded successfully. You can now return to the
        desktop to continue your application.
      </p>
    </div>
  )
}

// ── ErrorView ─────────────────────────────────────────────────────────────────

function ErrorView({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Upload Failed</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{message}</p>
      </div>
      <button
        className="flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        onClick={onRetry}
      >
        <RotateCcw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  )
}

// ── StepDot ───────────────────────────────────────────────────────────────────

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean
  done: boolean
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
          done && "bg-emerald-500 text-white",
          active && !done && "bg-primary text-primary-foreground",
          !active && !done && "bg-muted text-muted-foreground",
        )}
      >
        {done ? "✓" : "●"}
      </div>
      <span
        className={cn(
          "text-xs",
          active ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  )
}
