/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export function validateStateCode(value: unknown): string | null {
  return /^[A-Za-z]{2}$/.test(String(value)) ? null : "Enter the 2-letter state code."
}

export function validateZip(value: unknown): string | null {
  return /^\d{5}(-\d{4})?$/.test(String(value)) ? null : "Enter a 5-digit ZIP code."
}
