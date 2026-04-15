/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * AAMVA DL/ID Card Design Standard parser
 *
 * Decodes the PDF417 barcode printed on the back of every US driver's
 * license and REAL ID card. The barcode encodes structured data fields
 * defined by the American Association of Motor Vehicle Administrators
 * (AAMVA) standard, adopted by all 50 US states.
 *
 * Reference: AAMVA DL/ID Card Design Standard, 2016 edition
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AamvaLicenseData {
  /** First (given) name */
  firstName: string
  /** Last (family) name */
  lastName: string
  /** Middle name or initial (may be empty) */
  middleName: string
  /** Date of birth normalised to YYYY-MM-DD */
  dateOfBirth: string
  /** Street address line 1 */
  addressStreet: string
  /** Street address line 2 (optional) */
  addressStreet2: string
  /** City */
  addressCity: string
  /** 2-letter state abbreviation */
  addressState: string
  /** 5-digit ZIP code */
  addressZip: string
  /** License / document number */
  licenseNumber: string
  /** Expiration date as YYYY-MM-DD */
  expirationDate: string
  /** Issue date as YYYY-MM-DD */
  issueDate: string
  /** 2-letter issuing state */
  issuingState: string
  /** Biological sex */
  sex: "male" | "female" | "unspecified"
}

export type AamvaParseResult =
  | { ok: true; data: AamvaLicenseData }
  | { ok: false; error: string }

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse the raw text decoded from a PDF417 barcode on a US driver's license.
 *
 * @param raw  The raw string returned by the ZXing barcode reader.
 * @returns    A discriminated union: `{ ok: true, data }` or `{ ok: false, error }`.
 */
export function parseAamvaBarcode(raw: string): AamvaParseResult {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, error: "Empty barcode data" }
  }

  const elements = extractDataElements(raw)

  if (Object.keys(elements).length === 0) {
    return { ok: false, error: "No AAMVA data elements found in barcode" }
  }

  const aamvaVersion = detectAamvaVersion(raw)

  // ── Name ──────────────────────────────────────────────────────────────────
  // AAMVA v1  : DAA = "LAST,FIRST,MIDDLE"
  // AAMVA v2+ : DCS = last, DAC = first, DAD = middle
  let firstName = ""
  let lastName = ""
  let middleName = ""

  if (elements["DCS"]) {
    lastName = cleanName(elements["DCS"])
    firstName = cleanName(elements["DAC"] ?? "")
    middleName = cleanName(elements["DAD"] ?? "")
  } else if (elements["DAA"]) {
    const parsed = parseFullName(elements["DAA"])
    firstName = parsed.firstName
    lastName = parsed.lastName
    middleName = parsed.middleName
  }

  if (!firstName && !lastName) {
    return { ok: false, error: "Could not extract name from barcode" }
  }

  // ── Dates ─────────────────────────────────────────────────────────────────
  const dateOfBirth = parseAamvaDate(elements["DBB"] ?? "", aamvaVersion)
  const expirationDate = parseAamvaDate(elements["DBA"] ?? "", aamvaVersion)
  const issueDate = parseAamvaDate(elements["DBD"] ?? "", aamvaVersion)

  // ── Address ───────────────────────────────────────────────────────────────
  const addressStreet = cleanValue(elements["DAG"] ?? "")
  const addressStreet2 = cleanValue(elements["DAH"] ?? "")
  const addressCity = cleanValue(elements["DAI"] ?? "")
  const addressState = cleanValue(elements["DAJ"] ?? "")
  const addressZip = cleanZip(elements["DAK"] ?? "")

  // ── License ───────────────────────────────────────────────────────────────
  const licenseNumber = cleanValue(elements["DAQ"] ?? "")
  const issuingState = cleanValue(elements["DAJ"] ?? "")

  // ── Sex ───────────────────────────────────────────────────────────────────
  const sexCode = cleanValue(elements["DBC"] ?? "")
  const sex: AamvaLicenseData["sex"] =
    sexCode === "1" ? "male" : sexCode === "2" ? "female" : "unspecified"

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      middleName,
      dateOfBirth,
      addressStreet,
      addressStreet2,
      addressCity,
      addressState,
      addressZip,
      licenseNumber,
      expirationDate,
      issueDate,
      issuingState,
      sex,
    },
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Walk every line of the raw barcode text and collect 3-char data elements.
 * Lines that start with two uppercase letters + one alphanumeric char are
 * treated as element codes; the remainder of the line is the value.
 */
function extractDataElements(raw: string): Record<string, string> {
  const elements: Record<string, string> = {}
  const lines = raw.split(/\r?\n|\r/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length >= 4 && /^[A-Z]{2}[A-Z0-9]/.test(trimmed)) {
      const code = trimmed.substring(0, 3)
      const value = trimmed.substring(3).trim()
      if (value) {
        elements[code] = value
      }
    }
  }

  return elements
}

/**
 * Determine the AAMVA version from the file header.
 * The header format is: `ANSI <IIN:6><AAMVAVersion:2><JurisdictionVersion:2><NumEntries:2>`
 */
function detectAamvaVersion(raw: string): number {
  const match = /ANSI \d{6}(\d{2})/.exec(raw)
  return match ? parseInt(match[1], 10) : 1
}

/**
 * Parse an AAMVA date string into YYYY-MM-DD.
 *
 * Older AAMVA versions (1–2) encode dates as MMDDYYYY.
 * Newer versions may use CCYYMMDD.
 * We auto-detect by checking whether the first four digits look like a year.
 */
function parseAamvaDate(raw: string, _aamvaVersion: number): string {
  if (!raw || raw.trim().length === 0) return ""

  const clean = raw.trim().replace(/\D/g, "").padEnd(8, "0").substring(0, 8)
  if (clean.length !== 8) return ""

  const firstFour = parseInt(clean.substring(0, 4), 10)

  // CCYYMMDD (year-first)
  if (firstFour >= 1900 && firstFour <= 2100) {
    const year = clean.substring(0, 4)
    const month = clean.substring(4, 6)
    const day = clean.substring(6, 8)
    if (isValidDateParts(year, month, day)) {
      return `${year}-${month}-${day}`
    }
  }

  // MMDDYYYY (month-first)
  const month = clean.substring(0, 2)
  const day = clean.substring(2, 4)
  const year = clean.substring(4, 8)
  if (isValidDateParts(year, month, day)) {
    return `${year}-${month}-${day}`
  }

  return ""
}

function isValidDateParts(year: string, month: string, day: string): boolean {
  const y = parseInt(year, 10)
  const m = parseInt(month, 10)
  const d = parseInt(day, 10)
  return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31
}

/**
 * Parse a combined name field (AAMVA v1 DAA element).
 * Common delimiters: comma "," or dollar sign "$".
 * Field order is always: LAST, FIRST, MIDDLE.
 */
function parseFullName(raw: string): {
  firstName: string
  lastName: string
  middleName: string
} {
  const clean = cleanName(raw)

  const delimiter = clean.includes(",") ? "," : clean.includes("$") ? "$" : null

  if (delimiter) {
    const parts = clean.split(delimiter).map((s) => s.trim())
    return {
      lastName: parts[0] ?? "",
      firstName: parts[1] ?? "",
      middleName: parts[2] ?? "",
    }
  }

  // Fallback: space-separated
  const parts = clean.split(/\s+/)
  return {
    lastName: parts[0] ?? "",
    firstName: parts[1] ?? "",
    middleName: parts[2] ?? "",
  }
}

function cleanName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z\s,'"$.-]/g, "")
    .replace(/\s{2,}/g, " ")
}

function cleanValue(value: string): string {
  return value.trim()
}

/** Normalise ZIP to exactly 5 digits (drop the +4 extension). */
function cleanZip(value: string): string {
  return value.trim().replace(/\D/g, "").substring(0, 5)
}
