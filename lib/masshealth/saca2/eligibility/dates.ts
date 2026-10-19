/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { isRealIsoDate } from "../questions/validate"

export function isoDay(on: Date): string {
  return on.toISOString().slice(0, 10)
}

/** The same calendar day `months` months earlier (UTC), clamped to the last day of a shorter month. */
export function isoMonthsBefore(on: Date, months: number): string {
  const monthIndex = on.getUTCFullYear() * 12 + on.getUTCMonth() - months
  const year = Math.floor(monthIndex / 12)
  const month = monthIndex - year * 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(on.getUTCDate(), lastDay)
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && isRealIsoDate(value)
}
