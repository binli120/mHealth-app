/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

/**
 * Render a first + last name pair as a single display string.
 *
 * - Both parts present → "Jane Doe"
 * - One part null/empty → returns the non-empty part
 * - Both null/empty    → "—"
 *
 * Accepts any object that exposes `first_name` and `last_name` (AdminUser,
 * SocialWorker, Patient, etc.) so callers never need to re-implement this.
 */
export function fullName(person: {
  first_name: string | null | undefined
  last_name: string | null | undefined
}): string {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || "—"
}

const NAME_PART_PATTERN = /[\p{L}\p{M}]/u

function getNamePartCount(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter((part) => NAME_PART_PATTERN.test(part)).length
}

export function hasFirstAndLastName(value: string): boolean {
  return getNamePartCount(value) >= 2
}

