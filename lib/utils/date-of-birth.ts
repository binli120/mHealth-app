/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

export const MAX_REASONABLE_AGE_YEARS = 120

interface DobValidationResult {
  valid: boolean
  error?: string
}

function atStartOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [yearText, monthText, dayText] = value.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const parsed = new Date(year, month - 1, day)

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return atStartOfDay(parsed)
}

export function getDobInputBounds(today = new Date()): { min: string; max: string } {
  const maxDate = atStartOfDay(today)
  const minDate = new Date(maxDate)
  minDate.setFullYear(maxDate.getFullYear() - MAX_REASONABLE_AGE_YEARS)

  return {
    min: formatDateInput(minDate),
    max: formatDateInput(maxDate),
  }
}

export function getDobValidation(
  value: string,
  today = new Date(),
): DobValidationResult {
  if (!value) {
    return {
      valid: false,
      error: "Date of birth is required.",
    }
  }

  const parsedDate = parseDateInput(value)

  if (!parsedDate) {
    return {
      valid: false,
      error: "Enter a valid date of birth.",
    }
  }

  const normalizedToday = atStartOfDay(today)

  if (parsedDate > normalizedToday) {
    return {
      valid: false,
      error: "Date of birth cannot be in the future.",
    }
  }

  const oldestAllowedDate = new Date(normalizedToday)
  oldestAllowedDate.setFullYear(
    normalizedToday.getFullYear() - MAX_REASONABLE_AGE_YEARS,
  )

  if (parsedDate < oldestAllowedDate) {
    return {
      valid: false,
      error: `Date of birth cannot be more than ${MAX_REASONABLE_AGE_YEARS} years ago.`,
    }
  }

  return { valid: true }
}
