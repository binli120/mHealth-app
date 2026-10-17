/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { isRealIsoDate } from "../questions/validate"
import type { Encoder } from "./types"

export type CheckboxEncoder = Extract<Encoder, { kind: "yesNo" } | { kind: "pick" } | { kind: "check" }>
export type TextEncoder = Exclude<Encoder, CheckboxEncoder>

export function isCheckboxEncoder(encoder: Encoder): encoder is CheckboxEncoder {
  return (
    typeof encoder === "object" && (encoder.kind === "yesNo" || encoder.kind === "pick" || encoder.kind === "check")
  )
}

/** Windows-1252 characters in 0x80-0x9F that the standard Helvetica (WinAnsi) font can draw. */
const WIN_ANSI_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018,
  0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])

function isWinAnsi(codePoint: number): boolean {
  return (
    (codePoint >= 0x20 && codePoint <= 0x7e) ||
    (codePoint >= 0xa0 && codePoint <= 0xff) ||
    WIN_ANSI_EXTRAS.has(codePoint)
  )
}

/**
 * Makes a string safe to hand to a standard-font text field: line breaks and tabs become a single
 * space (runs of whitespace collapse), other control characters are removed, and every character
 * Helvetica cannot draw becomes one "?". Never throws.
 */
export function sanitizeText(value: string): string {
  let out = ""
  for (const ch of value.normalize("NFC")) {
    const cp = ch.codePointAt(0)!
    if (cp === 0x0a || cp === 0x0d || cp === 0x09) out += " "
    else if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) continue
    else out += isWinAnsi(cp) ? ch : "?"
  }
  return out.replace(/ {2,}/g, " ")
}

function nonBlankText(raw: unknown): string | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined
  const text = sanitizeText(String(raw)).trim()
  return text === "" ? undefined : text
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Encodes one value for a single text field. `undefined` means "nothing to write". */
export function encodeText(
  kind: "text" | "date" | "money" | "phone" | "number" | "upper",
  raw: unknown,
): string | undefined {
  switch (kind) {
    case "text":
      return nonBlankText(raw)
    case "upper":
      return nonBlankText(raw)?.toUpperCase()
    case "date": {
      if (typeof raw !== "string" || !isRealIsoDate(raw)) return undefined
      const m = ISO_DATE.exec(raw)!
      return `${m[2]}/${m[3]}/${m[1]}`
    }
    case "money": {
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw >= 1e15) return undefined
      const rounded = Math.round(raw * 100) / 100
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
    }
    case "number":
      if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined
      return String(Number(raw.toPrecision(12)))
    case "phone": {
      if (typeof raw !== "string") return undefined
      const d = raw.replace(/\D/g, "")
      return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : undefined
    }
  }
}

/** Exactly nine digits, one per box, or `undefined` (never a partial SSN). */
export function encodeSsn(raw: unknown): string[] | undefined {
  if (typeof raw !== "string") return undefined
  const d = raw.replace(/\D/g, "")
  return d.length === 9 ? d.split("") : undefined
}

function encodeDigits(raw: unknown, width: number): string | undefined {
  let digits: string
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) digits = String(raw)
  else if (typeof raw === "string" && /^\d+$/.test(raw.trim())) digits = raw.trim()
  else return undefined
  return digits.length > width ? undefined : digits.padStart(width, "0")
}

/**
 * Encodes a value for a text entry with `fieldCount` fields. Returns one string per field, or
 * `undefined` when there is nothing to write. A field count that does not suit the encoder is a
 * mapping bug and throws (without the value).
 */
export function encodeToParts(encoder: TextEncoder, raw: unknown, fieldCount: number): string[] | undefined {
  if (typeof encoder === "string") {
    const text = encodeText(encoder, raw)
    return text === undefined ? undefined : Array.from({ length: fieldCount }, () => text)
  }
  if (encoder.kind === "ssn") {
    if (fieldCount !== 9) throw new Error(`ssn encoder needs exactly 9 fields, got ${fieldCount}`)
    return encodeSsn(raw)
  }
  const padded = encodeDigits(raw, encoder.width)
  if (padded === undefined) return undefined
  if (fieldCount === 1) return [padded]
  if (fieldCount !== encoder.width) {
    throw new Error(`digits encoder of width ${encoder.width} needs 1 or ${encoder.width} fields, got ${fieldCount}`)
  }
  return padded.split("")
}

/** Maps an answer onto a checkbox on-state; `undefined` leaves the group untouched. */
export function encodeCheckbox(encoder: CheckboxEncoder, raw: unknown): string | undefined {
  switch (encoder.kind) {
    case "yesNo":
      return raw === "yes" ? encoder.yes : raw === "no" ? encoder.no : undefined
    case "pick":
      return typeof raw === "string" && Object.prototype.hasOwnProperty.call(encoder.states, raw)
        ? encoder.states[raw]
        : undefined
    case "check":
      return raw === true ? "On" : undefined
  }
}
