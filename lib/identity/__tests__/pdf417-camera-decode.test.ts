import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { afterEach, expect, it, vi } from "vitest"
import bwipjs from "bwip-js/node"
import sharp from "sharp"
import { startPdf417Scan } from "../pdf417-scanner"
import { parseAamvaBarcode } from "../aamva-parser"

// Keep the real decoder; only replace its network-dependent WASM loading.
vi.mock("zxing-wasm/reader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("zxing-wasm/reader")>()
  return {
    ...actual,
    prepareZXingModule: () => actual.prepareZXingModule({ overrides: {
      wasmBinary: readFileSync(createRequire(import.meta.url).resolve("zxing-wasm/reader/zxing_reader.wasm")),
    } }),
  }
})

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it("decodes and extracts a synthetic NH payload from a camera frame tilted 12 degrees", async () => {
  const subfile = "DLDCSDOE\nDACJANE\nDAQSYNTHETIC\nDBB01011990\nDBA01012030\nDAG123 TEST ST\nDAICONCORD\nDAJNH\nDAK033010000\r"
  const raw = `@\n\x1e\rANSI 636039090001DL0031${String(subfile.length).padStart(4, "0")}${subfile}`
  const barcode = await bwipjs.toBuffer({ bcid: "pdf417", text: raw, scale: 3, columns: 12,
    paddingwidth: 20, paddingheight: 20, backgroundcolor: "FFFFFF" })
  const frame = await sharp(barcode).rotate(12, { background: "white" }).png().toBuffer()
  // Emulate canvas rotation with real pixels. No decoder results are mocked.
  const pixels = new Map<number, ImageData>()
  for (let angle = -20; angle <= 20; angle += 2) {
    const { data, info } = await sharp(frame).rotate(angle, { background: "white" })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    pixels.set(angle, { data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: "srgb" })
  }
  let rotation = 0
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
    rotate: (radians: number) => { rotation = Math.round(radians * 180 / Math.PI) },
    getImageData: () => pixels.get(rotation),
  } as unknown as CanvasRenderingContext2D)
  vi.stubGlobal("Worker", undefined)
  const stop = vi.fn()
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
    getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }], getVideoTracks: () => [] }),
  } })
  const video = document.createElement("video")
  Object.defineProperties(video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } })
  vi.spyOn(video, "play").mockResolvedValue()
  let resolveResult!: (value: string) => void
  let rejectResult!: (reason: unknown) => void
  const result = new Promise<string>((resolve, reject) => { resolveResult = resolve; rejectResult = reject })
  const controls = await startPdf417Scan({ video, onResult: resolveResult, onError: rejectResult })
  let deadline: ReturnType<typeof setTimeout> | undefined
  try {
    const decoded = await Promise.race([result, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Tilted camera frame did not decode")), 2000)
    })])
    expect(decoded).toBe(raw)
    const parsed = parseAamvaBarcode(decoded)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data).toMatchObject({ firstName: "JANE", lastName: "DOE", licenseNumber: "SYNTHETIC", issuingState: "NH" })
  } finally { clearTimeout(deadline); controls.stop() }
})
