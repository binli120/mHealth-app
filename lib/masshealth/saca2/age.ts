/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Whole-years age on `on`, from an ISO `YYYY-MM-DD` date of birth.
 * Returns null for missing, malformed, impossible, or future dates so callers
 * can treat age-gated rules as "unknown" instead of throwing.
 */
export function calculateAge(dobIso: string | null | undefined, on: Date): number | null {
  if (!dobIso) return null
  const match = ISO_DATE.exec(dobIso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null
  }

  const onYear = on.getUTCFullYear()
  const onMonth = on.getUTCMonth() + 1
  const onDay = on.getUTCDate()

  let age = onYear - year
  if (onMonth < month || (onMonth === month && onDay < day)) age -= 1
  return age < 0 ? null : age
}
