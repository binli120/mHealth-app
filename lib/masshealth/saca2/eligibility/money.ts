/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { IncomeFrequency } from "../types"

export const INVALID_AMOUNT = "invalid" as const
/** Whole cents; `null` = not answered or not visible; INVALID_AMOUNT = not a usable amount. */
export type AmountInput = number | null | typeof INVALID_AMOUNT

/** Anything larger is treated as a typo or tampering, not a real amount. */
export const MAX_DOLLARS = 1_000_000_000

export function toCents(value: unknown): AmountInput {
  if (value === null || value === undefined) return null
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_DOLLARS) return INVALID_AMOUNT
  return Math.round(value * 100)
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100
}

type RecurringFrequency = Exclude<IncomeFrequency, "oneTime">

/** [numerator, denominator] that turn one payment into a monthly amount. */
const MONTHLY_FACTOR: Record<RecurringFrequency, readonly [number, number]> = {
  weekly: [52, 12],
  every2weeks: [26, 12],
  twiceMonthly: [2, 1],
  monthly: [1, 1],
  quarterly: [1, 3],
  yearly: [1, 12],
}

export function isRecurringFrequency(value: unknown): value is RecurringFrequency {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MONTHLY_FACTOR, value)
}

/** Monthly equivalent in cents, or null when the frequency is one-time, missing, or unknown. */
export function toMonthlyCents(cents: number, frequency: unknown): number | null {
  if (!isRecurringFrequency(frequency)) return null
  const [numerator, denominator] = MONTHLY_FACTOR[frequency]
  return Math.round((cents * numerator) / denominator)
}

export function totalCents(values: readonly AmountInput[]): { total: number; missing: number; invalid: number } {
  let total = 0
  let missing = 0
  let invalid = 0
  for (const value of values) {
    if (value === null) missing += 1
    else if (value === INVALID_AMOUNT) invalid += 1
    else total += value
  }
  return { total, missing, invalid }
}

export function formatDollars(cents: number): string {
  const whole = Math.round(cents) % 100 === 0
  return `$${(Math.round(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}
