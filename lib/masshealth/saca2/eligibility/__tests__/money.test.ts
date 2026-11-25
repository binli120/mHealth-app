/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import {
  INVALID_AMOUNT,
  centsToDollars,
  dollarsToCents,
  formatDollars,
  toCents,
  toMonthlyCents,
  totalCents,
} from "@/lib/masshealth/saca2/eligibility/money"

describe("toCents", () => {
  it("converts finite non-negative dollars to whole cents", () => {
    expect(toCents(0)).toBe(0)
    expect(toCents(12.34)).toBe(1234)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(1_000_000_000)).toBe(100_000_000_000)
  })

  it("treats null and undefined as missing", () => {
    expect(toCents(null)).toBeNull()
    expect(toCents(undefined)).toBeNull()
  })

  it("marks strings, NaN, Infinity, negatives and huge values invalid", () => {
    expect(toCents("1200")).toBe(INVALID_AMOUNT)
    expect(toCents(Number.NaN)).toBe(INVALID_AMOUNT)
    expect(toCents(Number.POSITIVE_INFINITY)).toBe(INVALID_AMOUNT)
    expect(toCents(-1)).toBe(INVALID_AMOUNT)
    expect(toCents(1_000_000_000.01)).toBe(INVALID_AMOUNT)
    expect(toCents({})).toBe(INVALID_AMOUNT)
  })
})

describe("toMonthlyCents", () => {
  it("normalizes every recurring frequency to a monthly amount", () => {
    expect(toMonthlyCents(25_000, "weekly")).toBe(108_333)
    expect(toMonthlyCents(40_000, "every2weeks")).toBe(86_667)
    expect(toMonthlyCents(50_000, "twiceMonthly")).toBe(100_000)
    expect(toMonthlyCents(100_000, "monthly")).toBe(100_000)
    expect(toMonthlyCents(300_000, "quarterly")).toBe(100_000)
    expect(toMonthlyCents(1_200_000, "yearly")).toBe(100_000)
  })

  it("returns null for one-time, missing, unknown and prototype keys", () => {
    expect(toMonthlyCents(100_000, "oneTime")).toBeNull()
    expect(toMonthlyCents(100_000, null)).toBeNull()
    expect(toMonthlyCents(100_000, "daily")).toBeNull()
    expect(toMonthlyCents(100_000, "__proto__")).toBeNull()
    expect(toMonthlyCents(100_000, "constructor")).toBeNull()
  })
})

describe("totalCents", () => {
  it("adds numbers and counts missing and invalid entries", () => {
    expect(totalCents([100, null, INVALID_AMOUNT, 250])).toEqual({ total: 350, missing: 1, invalid: 1 })
    expect(totalCents([])).toEqual({ total: 0, missing: 0, invalid: 0 })
  })
})

describe("dollar helpers", () => {
  it("round-trips and formats", () => {
    expect(dollarsToCents(4066.5)).toBe(406_650)
    expect(centsToDollars(406_650)).toBe(4066.5)
    expect(formatDollars(320_000)).toBe("$3,200")
    expect(formatDollars(276_650)).toBe("$2,766.50")
  })
})
