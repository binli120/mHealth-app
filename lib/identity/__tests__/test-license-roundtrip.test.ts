/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Round-trip test for the synthetic test driver license:
 *   build AAMVA payload → render PDF417 (bwip-js) → decode (zxing-wasm)
 *   → parse (aamva-parser) → verify against the demo applicant profile.
 *
 * Guards two failure modes that broke mobile verification in the field:
 *   1. The generated barcode not being decodable at all.
 *   2. The test identity drifting from the seeded demo profile, which made
 *      every successful scan score below the "verified" threshold.
 */

import { describe, expect, it } from "vitest"
import { PNG } from "pngjs"
import { readBarcodes } from "zxing-wasm/reader"
import bwipjs, { type RenderOptions } from "bwip-js/node"
import { buildTestLicensePayload, TEST_LICENSE_PROFILE } from "../test-license-data"
import { parseAamvaBarcode } from "../aamva-parser"
import { verifyLicenseAgainstProfile } from "../verify-license"

async function renderBarcodePng(payload: string): Promise<PNG> {
  // eclevel (PDF417 error-correction level) is a pass-through symbology
  // option not present in bwip-js's RenderOptions type.
  const buf = await bwipjs.toBuffer({
    bcid: "pdf417",
    text: payload,
    scale: 4,
    height: 12,
    eclevel: 2,
    paddingwidth: 20,
    paddingheight: 20,
    backgroundcolor: "FFFFFF",
  } as RenderOptions)
  return PNG.sync.read(buf)
}

describe("test driver license round-trip", () => {
  it("parses straight from the payload and verifies as the demo applicant", () => {
    const parsed = parseAamvaBarcode(buildTestLicensePayload())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.data.firstName).toBe("MARIA")
    expect(parsed.data.lastName).toBe("SANTOS")
    expect(parsed.data.dateOfBirth).toBe("1991-03-15")
    expect(parsed.data.addressZip).toBe("02101")

    const result = verifyLicenseAgainstProfile(parsed.data, TEST_LICENSE_PROFILE)
    expect(result.status).toBe("verified")
    expect(result.score).toBe(100)
    expect(result.isExpired).toBe(false)
  })

  it("survives render → barcode decode → parse → verify", async () => {
    const png = await renderBarcodePng(buildTestLicensePayload())

    const pixels = new Uint8ClampedArray(png.data)
    const imageData =
      typeof ImageData !== "undefined"
        ? new ImageData(pixels, png.width, png.height)
        : { data: pixels, width: png.width, height: png.height }
    // textMode "Plain" keeps real control characters (\n, \x1e) — the default
    // "HRI" mode replaces them with "<LF>"/"<RS>" placeholders, which breaks
    // AAMVA line splitting.
    const results = await readBarcodes(imageData, {
      formats: ["PDF417"],
      tryHarder: true,
      textMode: "Plain",
    })
    expect(results).toHaveLength(1)
    expect(results[0].isValid).toBe(true)

    const parsed = parseAamvaBarcode(results[0].text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const verification = verifyLicenseAgainstProfile(parsed.data, TEST_LICENSE_PROFILE)
    expect(verification.status).toBe("verified")
    expect(verification.score).toBe(100)
  })
})
