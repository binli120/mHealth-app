/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ flip: false }))

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises")
  const readFile = async (...args: Parameters<typeof actual.readFile>) => {
    const buf = (await actual.readFile(...args)) as Buffer
    if (state.flip) {
      const copy = Buffer.from(buf)
      copy[100] = copy[100] ^ 0xff
      return copy
    }
    return buf
  }
  return { ...actual, default: { ...actual, readFile }, readFile }
})

import {
  loadSaca2Template,
  Saca2TemplateIntegrityError,
  SACA2_TEMPLATE_PATH,
  SACA2_TEMPLATE_SHA256,
} from "../template"

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex")

describe("SACA-2 template pin", () => {
  afterEach(() => {
    state.flip = false
  })

  it("pins the sha256 of the committed PDF", () => {
    const onDisk = readFileSync(path.join(process.cwd(), "resources/forms/saca2-2026-08.pdf"))
    expect(SACA2_TEMPLATE_PATH).toBe("resources/forms/saca2-2026-08.pdf")
    expect(SACA2_TEMPLATE_SHA256).toBe(sha(onDisk))
  })

  it("loads bytes whose hash matches the pin", async () => {
    const bytes = await loadSaca2Template()
    expect(sha(bytes)).toBe(SACA2_TEMPLATE_SHA256)
  })

  it("rejects a single flipped byte, naming only 8-char hash prefixes", async () => {
    state.flip = true
    const err = await loadSaca2Template().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Saca2TemplateIntegrityError)
    const msg = (err as Error).message
    expect(msg).toContain(SACA2_TEMPLATE_SHA256.slice(0, 8))
    expect(msg).not.toContain(SACA2_TEMPLATE_SHA256.slice(0, 9))
    const actual = sha(
      (() => {
        const b = Buffer.from(readFileSync(path.join(process.cwd(), SACA2_TEMPLATE_PATH)))
        b[100] = b[100] ^ 0xff
        return b
      })(),
    )
    expect(msg).toContain(actual.slice(0, 8))
    expect(msg).not.toContain(actual.slice(0, 9))
  })
})
