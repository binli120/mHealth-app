/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

interface AamvaFieldMap {
  [code: string]: string
}

export interface ParsedDriverLicenseBarcode {
  firstName: string
  lastName: string
  dob: string
  address: string
  city: string
  state: string
  zip: string
}

function parseAamvaDate(value: string): string {
  const digits = value.replace(/\D/g, "")

  if (digits.length !== 8) {
    return ""
  }

  const yearPrefix = Number(digits.slice(0, 4))

  if (yearPrefix >= 1900 && yearPrefix <= 2099) {
    const year = digits.slice(0, 4)
    const month = digits.slice(4, 6)
    const day = digits.slice(6, 8)
    return `${year}-${month}-${day}`
  }

  const month = digits.slice(0, 2)
  const day = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  return `${year}-${month}-${day}`
}

function normalizeZip(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5)
}

function normalizeLines(raw: string): string[] {
  return raw
    .replace(/[\u001e\u001d]/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function getCodeValue(line: string): { code: string; value: string } | null {
  const normalized = line.startsWith("DL") ? line.slice(2) : line

  if (normalized.length < 4) {
    return null
  }

  const code = normalized.slice(0, 3)
  const value = normalized.slice(3).trim()

  if (!/^[A-Z0-9]{3}$/.test(code) || !value) {
    return null
  }

  return { code, value }
}

function extractFieldMap(raw: string): AamvaFieldMap {
  const fieldMap: AamvaFieldMap = {}

  for (const line of normalizeLines(raw)) {
    const pair = getCodeValue(line)

    if (!pair || fieldMap[pair.code]) {
      continue
    }

    fieldMap[pair.code] = pair.value
  }

  return fieldMap
}

function parseNameFromDct(value: string): { firstName: string; lastName: string } {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return {
      lastName: parts[0],
      firstName: parts[1],
    }
  }

  return {
    firstName: "",
    lastName: "",
  }
}

export function parseDriverLicenseBarcode(
  raw: string,
): ParsedDriverLicenseBarcode | null {
  if (!raw.trim()) {
    return null
  }

  const fields = extractFieldMap(raw)
  const dctName = fields.DCT ? parseNameFromDct(fields.DCT) : null

  const firstName = (fields.DAC || dctName?.firstName || "").trim()
  const lastName = (fields.DCS || dctName?.lastName || "").trim()
  const dob = parseAamvaDate(fields.DBB || "")
  const address = (fields.DAG || "").trim()
  const city = (fields.DAI || "").trim()
  const state = (fields.DAJ || "").trim().toUpperCase()
  const zip = normalizeZip(fields.DAK || "")

  if (!firstName && !lastName && !dob && !address && !city && !state && !zip) {
    return null
  }

  return {
    firstName,
    lastName,
    dob,
    address,
    city,
    state,
    zip,
  }
}
