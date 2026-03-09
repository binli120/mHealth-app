interface ParsedUsAddress {
  streetAddress: string
  city: string
  state: string
  zipCode: string
}

const US_ADDRESS_PATTERN =
  /^\s*(.+?),\s*([^,]+),\s*([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?(?:,\s*(?:USA|United States))?\s*$/i

function normalizeZip(zipCode?: string): string {
  if (!zipCode) {
    return ""
  }

  return zipCode.replace(/\D/g, "").slice(0, 5)
}

export function parsePastedUsAddress(value: string): ParsedUsAddress | null {
  const trimmed = value.trim()
  const matches = US_ADDRESS_PATTERN.exec(trimmed)

  if (!matches) {
    return null
  }

  const streetAddress = matches[1]?.trim() || ""
  const city = matches[2]?.trim() || ""
  const state = matches[3]?.trim().toUpperCase() || ""
  const zipCode = normalizeZip(matches[4])

  if (!streetAddress || !city || !state) {
    return null
  }

  return {
    streetAddress,
    city,
    state,
    zipCode,
  }
}
