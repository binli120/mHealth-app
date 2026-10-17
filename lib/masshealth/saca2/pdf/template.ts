import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"

/** Path of the pinned SACA-2 template, relative to the project root. */
export const SACA2_TEMPLATE_PATH = "resources/forms/saca2-2026-08.pdf"

/** sha256 of the pinned template. Changing the PDF requires re-pinning and regenerating the inventory. */
export const SACA2_TEMPLATE_SHA256 = "147d89848b304189a4f55d469c3436d6754525aaa94aab21471027113804af54"

export class Saca2TemplateIntegrityError extends Error {
  constructor(expected: string, actual: string) {
    super(`SACA-2 template hash mismatch: expected ${expected.slice(0, 8)}, got ${actual.slice(0, 8)}`)
    this.name = "Saca2TemplateIntegrityError"
  }
}

/** Reads the pinned template and verifies its hash before returning the bytes. */
export async function loadSaca2Template(): Promise<Uint8Array> {
  const buf = await readFile(path.join(process.cwd(), SACA2_TEMPLATE_PATH))
  const actual = createHash("sha256").update(buf).digest("hex")
  if (actual !== SACA2_TEMPLATE_SHA256) {
    throw new Saca2TemplateIntegrityError(SACA2_TEMPLATE_SHA256, actual)
  }
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}
