/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * generate-test-license.ts
 *
 * Generates a fake Massachusetts driver's license for scanner testing.
 * Outputs two files into public/:
 *   - test-license-barcode.svg   PDF417 barcode only (for quick scanning)
 *   - test-license.html          Full DL mockup (front + back with barcode)
 *
 * Run: pnpm generate:test-license   (or: pnpm tsx scripts/generate-test-license.ts)
 *
 * The encoded identity comes from lib/identity/test-license-data.ts and matches
 * the seeded demo applicant (demo.e2e@masshealth-test.local) so a successful
 * scan verifies with score 100:
 *   Name    : MARIA SANTOS
 *   DOB     : March 15, 1991
 *   Address : 123 Main St, Boston, MA 02101
 */

import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import bwipjs, { type RenderOptions } from "bwip-js/node"
import {
  buildTestLicensePayload,
  TEST_LICENSE_CARD,
  TEST_LICENSE_PROFILE,
} from "../lib/identity/test-license-data"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, "..")

const fullName = `${TEST_LICENSE_PROFILE.lastName.toUpperCase()}, ${TEST_LICENSE_PROFILE.firstName.toUpperCase()}`
const dobUs = "03/15/1991"

// ── Generate PDF417 SVG ───────────────────────────────────────────────────────

console.log("Generating PDF417 barcode…")
const barcodeSvg = bwipjs.toSVG({
  bcid: "pdf417",
  text: buildTestLicensePayload(),
  scale: 2,
  height: 12, // bar height in mm
  includetext: false,
  // eclevel (PDF417 error-correction level) is a pass-through symbology
  // option not present in bwip-js's RenderOptions type.
  eclevel: 2,
} as RenderOptions)

writeFileSync(path.join(projectRoot, "public", "test-license-barcode.svg"), barcodeSvg, "utf8")
console.log("  → public/test-license-barcode.svg")

// ── Embed barcode in full DL mockup HTML ──────────────────────────────────────
//
// Encodes the SVG as a data-URI so the HTML file is fully self-contained.

const barcodeDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(barcodeSvg)}`

const html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Test Driver License — ${fullName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #1a1a2e;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 32px 16px 48px;
      font-family: 'Arial Narrow', Arial, sans-serif;
      min-height: 100vh;
    }
    h1 { color: #aaa; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: -8px; }
    .card {
      width: 340px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
    }

    /* ── FRONT ── */
    .front {
      background: linear-gradient(160deg, #003087 0%, #1a1a8c 40%, #002060 100%);
      color: white;
      padding: 0;
      position: relative;
    }
    .front-header {
      background: #b22222;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .front-header .state { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
    .front-header .dl-label { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; }
    .front-header .star { font-size: 20px; }
    .front-body { padding: 10px 14px 12px; display: flex; gap: 12px; }
    .photo-box {
      width: 70px; height: 90px; flex-shrink: 0;
      background: #001a5c;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.4);
      font-size: 10px;
    }
    .fields { flex: 1; }
    .field { margin-bottom: 5px; }
    .field .label { font-size: 7px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.55); }
    .field .value { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.2; }
    .field .value.name { font-size: 13px; }
    .field .value.license { font-size: 15px; font-weight: 900; letter-spacing: 1px; color: #ffd700; }
    .front-footer {
      background: rgba(0,0,0,0.3);
      padding: 4px 14px;
      font-size: 7px;
      color: rgba(255,255,255,0.5);
      letter-spacing: 1px;
      text-align: center;
    }

    /* ── BACK ── */
    .back {
      background: #f5f0e8;
      padding: 12px 14px 14px;
    }
    .back-title {
      font-size: 8px; letter-spacing: 2px; text-transform: uppercase;
      color: #555; margin-bottom: 10px; text-align: center;
    }
    .barcode-wrap {
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .barcode-wrap img {
      width: 100%;
      max-width: 300px;
      height: auto;
      display: block;
    }
    .back-note {
      font-size: 7.5px; color: #888; text-align: center;
      margin-top: 8px; line-height: 1.4;
    }

    /* ── Instructions ── */
    .instructions {
      max-width: 340px;
      background: #0f3460;
      border-radius: 10px;
      padding: 16px 18px;
      color: #ccc;
      font-size: 12px;
      line-height: 1.6;
    }
    .instructions h2 { color: #ffd700; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
    .instructions code { background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
    .instructions ul { padding-left: 18px; }
    .instructions li { margin-bottom: 4px; }
  </style>
</head>
<body>

  <h1>HealthCompass MA — Test Driver License</h1>

  <!-- FRONT -->
  <div class="card">
    <div class="front">
      <div class="front-header">
        <div>
          <div class="state">MASSACHUSETTS</div>
          <div class="dl-label">Driver License &nbsp;★ REAL ID</div>
        </div>
        <div class="star">⭐</div>
      </div>
      <div class="front-body">
        <div class="photo-box">PHOTO</div>
        <div class="fields">
          <div class="field">
            <div class="label">License No.</div>
            <div class="value license">${TEST_LICENSE_CARD.licenseNumber}</div>
          </div>
          <div class="field">
            <div class="label">Name</div>
            <div class="value name">${fullName}</div>
          </div>
          <div class="field">
            <div class="label">Address</div>
            <div class="value" style="font-size:10px">${TEST_LICENSE_PROFILE.addressStreet.toUpperCase()}<br>${TEST_LICENSE_PROFILE.addressCity.toUpperCase()}, ${TEST_LICENSE_PROFILE.addressState} ${TEST_LICENSE_PROFILE.addressZip}</div>
          </div>
          <div style="display:flex;gap:14px;margin-top:2px">
            <div class="field">
              <div class="label">DOB</div>
              <div class="value">${dobUs}</div>
            </div>
            <div class="field">
              <div class="label">Expires</div>
              <div class="value">${TEST_LICENSE_CARD.expirationDate}</div>
            </div>
          </div>
          <div style="display:flex;gap:14px;margin-top:2px">
            <div class="field">
              <div class="label">Sex</div>
              <div class="value">${TEST_LICENSE_CARD.sex}</div>
            </div>
            <div class="field">
              <div class="label">Eyes</div>
              <div class="value">${TEST_LICENSE_CARD.eyes}</div>
            </div>
            <div class="field">
              <div class="label">Height</div>
              <div class="value">${TEST_LICENSE_CARD.height}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="front-footer">COMMONWEALTH OF MASSACHUSETTS — RMV</div>
    </div>
  </div>

  <!-- BACK (with PDF417 barcode) -->
  <div class="card">
    <div class="back">
      <div class="back-title">Back of card — PDF417 barcode (point camera here)</div>
      <div class="barcode-wrap">
        <img src="${barcodeDataUri}" alt="PDF417 AAMVA barcode" />
      </div>
      <div class="back-note">
        AAMVA standard barcode · MA · License ${TEST_LICENSE_CARD.licenseNumber}<br>
        ${fullName} &nbsp;·&nbsp; DOB ${dobUs} &nbsp;·&nbsp; ${TEST_LICENSE_PROFILE.addressStreet.toUpperCase()}, ${TEST_LICENSE_PROFILE.addressCity.toUpperCase()}, ${TEST_LICENSE_PROFILE.addressState} ${TEST_LICENSE_PROFILE.addressZip}
      </div>
    </div>
  </div>

  <!-- Instructions -->
  <div class="instructions">
    <h2>How to test</h2>
    <ul>
      <li>Open this file on a second screen: <code>localhost:3000/test-license.html</code></li>
      <li>In the app, click <strong>Verify Identity → Scan with Phone</strong> and scan the QR code</li>
      <li>Point the phone's camera at the barcode above (6–10 in. away, fill the guide box)</li>
      <li>Or use <strong>Scan with Camera</strong> and point the laptop camera at this barcode on a phone screen</li>
    </ul>
    <br>
    <strong style="color:#ffd700">Test profile must match:</strong><br>
    First&nbsp;name: <code>${TEST_LICENSE_PROFILE.firstName}</code> &nbsp;Last&nbsp;name: <code>${TEST_LICENSE_PROFILE.lastName}</code><br>
    DOB: <code>${TEST_LICENSE_PROFILE.dateOfBirth}</code> &nbsp;Address: <code>${TEST_LICENSE_PROFILE.addressStreet}, ${TEST_LICENSE_PROFILE.addressCity} ${TEST_LICENSE_PROFILE.addressState} ${TEST_LICENSE_PROFILE.addressZip}</code>
  </div>

</body>
</html>`

writeFileSync(path.join(projectRoot, "public", "test-license.html"), html, "utf8")
console.log("  → public/test-license.html")
console.log("\nDone! Open http://localhost:3000/test-license.html to use the test license.")
console.log("\nTest data encoded in barcode:")
console.log(`  Name    : ${fullName}`)
console.log(`  DOB     : ${TEST_LICENSE_PROFILE.dateOfBirth}`)
console.log(
  `  Address : ${TEST_LICENSE_PROFILE.addressStreet.toUpperCase()}, ${TEST_LICENSE_PROFILE.addressCity.toUpperCase()}, ${TEST_LICENSE_PROFILE.addressState} ${TEST_LICENSE_PROFILE.addressZip}`,
)
console.log(`  License : ${TEST_LICENSE_CARD.licenseNumber}  (MA)`)
console.log(`  Expiry  : ${TEST_LICENSE_CARD.expirationDate}`)
