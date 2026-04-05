/**
 * generate-test-license.mjs
 *
 * Generates a fake Massachusetts driver's license for scanner testing.
 * Outputs two files into public/:
 *   - test-license-barcode.svg   PDF417 barcode only (for quick scanning)
 *   - test-license.html          Full DL mockup (front + back with barcode)
 *
 * Run: node scripts/generate-test-license.mjs
 *
 * Test identity data — designed to match the seed profile for demo.e2e@masshealth-test.local:
 *   Name    : JOHN M DOE
 *   DOB     : January 1, 1985
 *   Address : 123 Main St, Boston, MA 02101
 *   License : D1234567  (MA)
 *   Expiry  : January 1, 2028
 */

import { createRequire } from "node:module"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, "..")

const _require = createRequire(import.meta.url)
const bwipjs = _require("bwip-js")

// ── AAMVA barcode payload ─────────────────────────────────────────────────────
//
// Field codes (AAMVA DL/ID Card Design Standard):
//   DAQ  license number       DCS  last name         DAC  first name
//   DAD  middle name          DBC  sex (1=M 2=F)     DBB  date of birth (MMDDYYYY)
//   DBA  expiry (MMDDYYYY)    DBD  issue (MMDDYYYY)  DAG  street
//   DAI  city                 DAJ  state             DAK  ZIP+4 (9 digits)
//   DCG  country              DAU  height            DAY  eye colour
//
// Header: @\n\x1e\rANSI <IIN:6><AAMVAver:2><JurVer:2><NumEntries:2>DL<...>
//   IIN  636001 = Massachusetts
//   AAMVA version 09 (2009 standard) → dates encoded MMDDYYYY
//
const AAMVA_PAYLOAD = [
  "@",
  "\x1e\rANSI 636001090102DL00410284ZM03260009DL",
  "DAQD1234567",
  "DCSDOE",
  "DACJOHN",
  "DADM",
  "DBC1",
  "DBB01011985",
  "DBA01012028",
  "DBD01012020",
  "DAG123 MAIN ST",
  "DAIBOSTON",
  "DAJMA",
  "DAK021010000",
  "DCGUSA",
  "DAU506",
  "DAYBRO",
  "DDEN",
  "DDFN",
  "DDGN",
].join("\n")

// ── Generate PDF417 SVG ───────────────────────────────────────────────────────

console.log("Generating PDF417 barcode…")
const barcodeSvg = bwipjs.toSVG({
  bcid: "pdf417",
  text: AAMVA_PAYLOAD,
  scale: 2,
  height: 12,      // bar height in mm
  includetext: false,
  eclevel: 2,      // error correction level 2
})

writeFileSync(
  path.join(projectRoot, "public", "test-license-barcode.svg"),
  barcodeSvg,
  "utf8",
)
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
  <title>Test Driver License — John M Doe</title>
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
            <div class="value license">D1234567</div>
          </div>
          <div class="field">
            <div class="label">Name</div>
            <div class="value name">DOE, JOHN M</div>
          </div>
          <div class="field">
            <div class="label">Address</div>
            <div class="value" style="font-size:10px">123 MAIN ST<br>BOSTON, MA 02101</div>
          </div>
          <div style="display:flex;gap:14px;margin-top:2px">
            <div class="field">
              <div class="label">DOB</div>
              <div class="value">01/01/1985</div>
            </div>
            <div class="field">
              <div class="label">Expires</div>
              <div class="value">01/01/2028</div>
            </div>
          </div>
          <div style="display:flex;gap:14px;margin-top:2px">
            <div class="field">
              <div class="label">Sex</div>
              <div class="value">M</div>
            </div>
            <div class="field">
              <div class="label">Eyes</div>
              <div class="value">BRO</div>
            </div>
            <div class="field">
              <div class="label">Height</div>
              <div class="value">5-06</div>
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
        AAMVA standard barcode · MA · License D1234567<br>
        DOE, JOHN M &nbsp;·&nbsp; DOB 01/01/1985 &nbsp;·&nbsp; 123 MAIN ST, BOSTON, MA 02101
      </div>
    </div>
  </div>

  <!-- Instructions -->
  <div class="instructions">
    <h2>How to test</h2>
    <ul>
      <li>Open this file on a phone or tablet: <code>localhost:3000/test-license.html</code></li>
      <li>In the app, click <strong>Verify Identity → Scan with Camera</strong></li>
      <li>Point the laptop camera at the barcode on this page</li>
      <li>Or click <strong>Scan with Phone</strong>, scan the QR code, then point that phone's camera at this barcode on a second device</li>
    </ul>
    <br>
    <strong style="color:#ffd700">Test profile must match:</strong><br>
    First&nbsp;name: <code>John</code> &nbsp;Last&nbsp;name: <code>Doe</code><br>
    DOB: <code>1985-01-01</code> &nbsp;Address: <code>123 Main St, Boston MA 02101</code>
  </div>

</body>
</html>`

writeFileSync(
  path.join(projectRoot, "public", "test-license.html"),
  html,
  "utf8",
)
console.log("  → public/test-license.html")
console.log("\nDone! Open http://localhost:3000/test-license.html to use the test license.")
console.log("\nTest data encoded in barcode:")
console.log("  Name    : JOHN M DOE")
console.log("  DOB     : 1985-01-01")
console.log("  Address : 123 MAIN ST, BOSTON, MA 02101")
console.log("  License : D1234567  (MA)")
console.log("  Expiry  : 2028-01-01")
