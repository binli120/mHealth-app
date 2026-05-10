/**
 * Lightweight PDF safety scanner.
 *
 * Inspects raw PDF bytes for constructs that are commonly used in malicious PDFs:
 *   - Embedded JavaScript (/JavaScript, /JS)
 *   - Launch actions (/Launch) — can open arbitrary executables
 *   - Embedded files (/EmbeddedFile) — can carry arbitrary payloads
 *
 * This is a heuristic scan, not a full antivirus. It catches the most common
 * attack vectors while keeping the check fast and dependency-free.
 *
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

export interface PdfSafetyResult {
  safe: boolean
  reason?: string
}

const SCAN_LIMIT = 512 * 1024 // 512 KB — enough to cover all PDF dictionaries

/**
 * Scans raw PDF bytes for dangerous constructs.
 * Only meaningful for application/pdf files — other types are safe to skip.
 */
export function checkPdfSafety(bytes: Uint8Array): PdfSafetyResult {
  const length = Math.min(bytes.length, SCAN_LIMIT)
  // latin1 round-trip preserves byte values, so regex matches work on raw PDF tokens.
  const text = Buffer.from(bytes.subarray(0, length)).toString("latin1")

  // /JavaScript or /JS — embedded JavaScript action
  if (/\/JavaScript[\s/<>]|\/JS[\s/<>]/.test(text)) {
    return { safe: false, reason: "suspicious_content" }
  }

  // /Launch — can trigger executables on the user's machine when the PDF is opened
  if (/\/Launch[\s/<>]/.test(text)) {
    return { safe: false, reason: "suspicious_content" }
  }

  // /EmbeddedFile — payload inside the PDF (zip bombs, executables)
  if (/\/EmbeddedFile[\s/<>]/.test(text)) {
    return { safe: false, reason: "suspicious_content" }
  }

  return { safe: true }
}
