/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 *
 * Some states (confirmed: NH) print a second, smaller PDF417 barcode on the
 * back of the license alongside the full AAMVA one — a short state-internal
 * verification code, not license data. zxing-wasm has no way to tell "the
 * PDF417 I want" from "any valid PDF417", so it can return that short
 * barcode's checksum-valid-but-wrong text before ever reaching the real one.
 *
 * A genuine AAMVA payload starts with the compliance indicator "@" followed
 * by "ANSI " and runs to several hundred characters (header + dozens of
 * fields), so a short/headerless decode is never the barcode we want —
 * reject it and keep scanning rather than surfacing it as a result.
 *
 * Kept dependency-free (no zxing-wasm import) so both the main thread
 * (pdf417-scanner.ts) and the dedicated decode worker
 * (pdf417-scanner.worker.ts) can use it without pulling extra code into
 * either bundle.
 */
export function isPlausibleAamvaPayload(text: string): boolean {
  return text.length >= 80 && text.includes("ANSI")
}
