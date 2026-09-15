import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { afterEach, expect, it, vi } from "vitest"
import bwipjs from "bwip-js/node"
import sharp from "sharp"
import { readPdf417FromImage } from "../pdf417-scanner"
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

// Mirrors the tiling constants in ../pdf417-scanner.ts so the test can
// precompute pixel data for exactly the bands/angles the real code will ask
// the (mocked) canvas for.
const TILE_HEIGHT_THRESHOLD = 1200
const TILE_HEIGHT = 900
const TILE_OVERLAP_RATIO = 0.3
const SWEEP_ANGLES_DEG = [0, -2, 2, -4, 4, -6, 6, -8, 8, -10, 10, -12, 12, -14, 14, -16, 16, -18, 18, -20, 20]

function computeBandOffsets(totalHeight: number): number[] {
  if (totalHeight <= TILE_HEIGHT_THRESHOLD) return [0]
  const step = Math.round(TILE_HEIGHT * (1 - TILE_OVERLAP_RATIO))
  const offsets: number[] = []
  for (let top = 0; top + TILE_HEIGHT < totalHeight; top += step) offsets.push(top)
  offsets.push(totalHeight - TILE_HEIGHT)
  return offsets
}

it("decodes a barcode buried deep in a tall full-frame photo that a single-pass decode would miss", async () => {
  // Reproduces the real failure mode: a phone photo of the whole license
  // (thousands of px tall) where the barcode is only a thin band far from
  // the top — the case a plain single-pass decode over the whole image
  // never found, regardless of resolution, downscale settings, or tilt.
  const subfile = "DLDCSDOE\nDACJANE\nDAQSYNTHETIC\nDBB01011990\nDBA01012030\nDAG123 TEST ST\nDAICONCORD\nDAJNH\nDAK033010000\r"
  const raw = `@\n\x1e\rANSI 636039090001DL0031${String(subfile.length).padStart(4, "0")}${subfile}`
  const barcode = await bwipjs.toBuffer({ bcid: "pdf417", text: raw, scale: 3, columns: 12,
    paddingwidth: 20, paddingheight: 20, backgroundcolor: "FFFFFF" })

  const TOTAL_WIDTH = 1200
  const TOTAL_HEIGHT = 4000
  const BARCODE_TOP = 2600 // deep inside a middle band, nowhere near a band edge
  const fullFrame = await sharp({
    create: { width: TOTAL_WIDTH, height: TOTAL_HEIGHT, channels: 3, background: "white" },
  })
    .composite([{ input: barcode, left: 100, top: BARCODE_TOP }])
    .png()
    .toBuffer()

  const bandOffsets = computeBandOffsets(TOTAL_HEIGHT)
  expect(bandOffsets.length).toBeGreaterThan(1) // sanity: this test actually exercises tiling

  const pixels = new Map<string, ImageData>()
  for (const bandTop of bandOffsets) {
    for (const angle of SWEEP_ANGLES_DEG) {
      const { data, info } = await sharp(fullFrame)
        .extract({ left: 0, top: bandTop, width: TOTAL_WIDTH, height: TILE_HEIGHT })
        .rotate(angle, { background: "white" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      pixels.set(`${bandTop}_${angle}`, { data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: "srgb" })
    }
  }

  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: TOTAL_WIDTH, height: TOTAL_HEIGHT }))
  let currentBandTop = 0
  let currentAngle = 0
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: () => { currentAngle = 0 },
    drawImage: (..._args: unknown[]) => { currentBandTop = _args[2] as number },
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
    rotate: (radians: number) => { currentAngle = Math.round((radians * 180) / Math.PI) },
    getImageData: () => pixels.get(`${currentBandTop}_${currentAngle}`),
  } as unknown as CanvasRenderingContext2D)

  const decoded = await readPdf417FromImage(new Blob([fullFrame]))
  expect(decoded).toBe(raw)

  const parsed = parseAamvaBarcode(decoded!)
  expect(parsed.ok).toBe(true)
  if (parsed.ok) expect(parsed.data).toMatchObject({ firstName: "JANE", lastName: "DOE", licenseNumber: "SYNTHETIC", issuingState: "NH" })
}, 20_000)
