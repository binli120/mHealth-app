/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Live-camera PDF417 scanner built on zxing-wasm (zxing-cpp).
 *
 * Why not @zxing/library? Its JS PDF417 detector only tolerates ~±1° of
 * rotation on a dense AAMVA driver's-license barcode, so hand-held scans
 * essentially never decode. zxing-cpp is better but still tops out around
 * ±2°, so this module additionally re-decodes each frame rotated through
 * a small sweep of angles (±2°…±6°) on a canvas. Combined with the
 * decoder's own tolerance this recovers tilts up to roughly ±7° — enough
 * for a hand-held card aligned against the on-screen guide.
 *
 * The wasm binary is self-hosted at /wasm/zxing_reader.wasm (copied from
 * node_modules by scripts/copy-zxing-wasm.mjs during dev/build).
 */

import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader"
import type { DecodeRequest, DecodeResponse } from "./pdf417-scanner.worker"

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Pdf417ScanOptions {
  /** Mounted <video> element the camera stream is attached to. */
  video: HTMLVideoElement
  /** Called once with the raw barcode text on the first successful decode. */
  onResult: (rawBarcode: string) => void
  /** Called for non-fatal decode-loop errors (scanning continues). */
  onError?: (error: unknown) => void
}

export interface Pdf417ScanControls {
  /** Stop the decode loop and release the camera. Safe to call repeatedly. */
  stop(): void
}

// ─── Module preparation ───────────────────────────────────────────────────────

let modulePrepared = false

function ensureModulePrepared(): void {
  if (modulePrepared) return
  modulePrepared = true
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? "/wasm/zxing_reader.wasm" : prefix + path,
    },
  })
}

// ─── Decode loop tuning ───────────────────────────────────────────────────────

// 0° first (cheapest, most common), then alternating tilts. With the
// decoder's own ~±1–2° tolerance this covers a continuous ±7° band.
const SWEEP_ANGLES_DEG = [0, -2, 2, -4, 4, -6, 6]
// Pause between full sweeps so the main thread can breathe on slow phones.
const SWEEP_PAUSE_MS = 150

const READER_OPTIONS: import("zxing-wasm/reader").ReaderOptions = {
  formats: ["PDF417"],
  tryHarder: true,
  tryRotate: true, // 90°-step orientations (e.g. license held vertically)
  tryDownscale: true,
  // "Plain" keeps real control characters (\n, \x1e). The default "HRI"
  // mode renders them as "<LF>"/"<RS>" placeholders, which breaks AAMVA
  // line splitting in the parser.
  textMode: "Plain",
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// ─── Worker-backed decoding ───────────────────────────────────────────────────
//
// Decoding a 1080p frame takes 100–500ms on mobile CPUs. Done inline that
// starves the main thread (frozen buttons/dialogs while scanning), so frames
// are shipped to a dedicated worker. Falls back to inline decoding when
// workers are unavailable.

interface DecoderHandle {
  decode(imageData: ImageData): Promise<string | null>
  dispose(): void
}

function createWorkerDecoder(): DecoderHandle | null {
  if (typeof Worker === "undefined") return null
  try {
    const worker = new Worker(new URL("./pdf417-scanner.worker.ts", import.meta.url))
    let nextId = 1
    const pending = new Map<number, { resolve: (text: string | null) => void; reject: (err: Error) => void }>()

    worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
      const msg = event.data
      const entry = pending.get(msg.id)
      if (!entry) return
      pending.delete(msg.id)
      if (msg.ok) entry.resolve(msg.text)
      else entry.reject(new Error(msg.error))
    }
    worker.onerror = (event) => {
      const err = new Error(event.message || "PDF417 worker error")
      for (const entry of pending.values()) entry.reject(err)
      pending.clear()
    }

    return {
      decode(imageData) {
        const id = nextId++
        return new Promise<string | null>((resolve, reject) => {
          pending.set(id, { resolve, reject })
          const request: DecodeRequest = { id, imageData, options: READER_OPTIONS }
          // Transfer the pixel buffer instead of copying ~8MB per frame.
          worker.postMessage(request, [imageData.data.buffer])
        })
      },
      dispose() {
        worker.terminate()
        pending.clear()
      },
    }
  } catch {
    return null
  }
}

function createInlineDecoder(): DecoderHandle {
  ensureModulePrepared()
  return {
    async decode(imageData) {
      const results = await readBarcodes(imageData, READER_OPTIONS)
      const hit = results.find((r) => r.isValid && r.text.trim().length > 0)
      return hit ? hit.text : null
    },
    dispose() {},
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Decode a PDF417 barcode from a still image (e.g. an uploaded photo of the
 * back of a license). Returns the raw barcode text, or null when no barcode
 * is found.
 */
export async function readPdf417FromImage(image: Blob): Promise<string | null> {
  ensureModulePrepared()
  const results = await readBarcodes(image, READER_OPTIONS)
  const hit = results.find((r) => r.isValid && r.text.trim().length > 0)
  return hit ? hit.text : null
}

/**
 * Open the rear camera, attach it to `video`, and continuously scan for a
 * PDF417 barcode until one decodes or `stop()` is called.
 *
 * Camera/permission errors reject the returned promise. After a successful
 * decode the loop ends but the stream stays live (so the UI can show a
 * confirmation over the last frames) — the caller stops it via the controls.
 */
export async function startPdf417Scan({
  video,
  onResult,
  onError,
}: Pdf417ScanOptions): Promise<Pdf417ScanControls> {
  const decoder = createWorkerDecoder() ?? createInlineDecoder()

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { min: 1280, ideal: 1920 },
      height: { min: 720, ideal: 1080 },
    },
  })

  let stopped = false
  const stop = () => {
    stopped = true
    decoder.dispose()
    stream.getTracks().forEach((track) => track.stop())
    if (video.srcObject === stream) {
      video.srcObject = null
    }
  }

  try {
    video.srcObject = stream
    await video.play()
  } catch (err) {
    stop()
    throw err
  }

  // Continuous autofocus markedly improves close-range sharpness on devices
  // that expose it (mostly Android). Unsupported devices just skip this.
  const [track] = stream.getVideoTracks()
  const capabilities = track?.getCapabilities?.() as
    | (MediaTrackCapabilities & { focusMode?: string[] })
    | undefined
  if (capabilities?.focusMode?.includes("continuous")) {
    void track
      .applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] })
      .catch(() => {})
  }

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })

  const decodeFrame = async (angleDeg: number): Promise<string | null> => {
    const width = video.videoWidth
    const height = video.videoHeight
    if (!ctx || width === 0 || height === 0) return null

    canvas.width = width
    canvas.height = height
    if (angleDeg === 0) {
      ctx.drawImage(video, 0, 0, width, height)
    } else {
      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.rotate((angleDeg * Math.PI) / 180)
      ctx.drawImage(video, -width / 2, -height / 2, width, height)
      ctx.restore()
    }

    return decoder.decode(ctx.getImageData(0, 0, width, height))
  }

  void (async () => {
    while (!stopped) {
      for (const angle of SWEEP_ANGLES_DEG) {
        if (stopped) return
        try {
          const text = await decodeFrame(angle)
          if (text) {
            if (!stopped) {
              stopped = true // end the loop; caller releases the camera
              onResult(text)
            }
            return
          }
        } catch (err) {
          onError?.(err)
        }
        // Yield between heavy decode attempts to keep the UI responsive.
        await delay(0)
      }
      await delay(SWEEP_PAUSE_MS)
    }
  })()

  return { stop }
}
