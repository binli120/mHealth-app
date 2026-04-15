/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "")
}

function addThousandsSeparators(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export function formatPhoneNumber(value: string): string {
  const digits = onlyDigits(value).slice(0, 10)

  if (digits.length === 0) {
    return ""
  }

  if (digits.length <= 3) {
    return `(${digits}`
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)})${digits.slice(3)}`
  }

  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function formatSsn(value: string): string {
  const digits = onlyDigits(value).slice(0, 9)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

export function formatCurrency(value: string): string {
  const normalized = value
    .replace(/[^0-9.]/g, "")
    .replace(/\.(?=.*\.)/g, "")

  if (!normalized) {
    return ""
  }

  const hasDecimalPoint = normalized.includes(".")
  const [integerPartRaw, decimalPartRaw = ""] = normalized.split(".")
  const integerPart = integerPartRaw.replace(/^0+(?=\d)/, "") || "0"
  const formattedIntegerPart = addThousandsSeparators(integerPart)
  const decimalPart = decimalPartRaw.slice(0, 2)

  if (hasDecimalPoint) {
    return `$${formattedIntegerPart}.${decimalPart}`
  }

  return `$${formattedIntegerPart}`
}

export function parseCurrency(value: string): number {
  const normalized = value.replace(/[^0-9.]/g, "")
  const parsed = Number.parseFloat(normalized)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return parsed
}
