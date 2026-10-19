/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import {
  SACA2_FIGURES,
  SACA2_FIGURES_YEAR,
  getEffectiveFigure,
  getFplRow,
} from "@/lib/masshealth/saca2/figures-2026"

describe("SACA2_FIGURES (2026)", () => {
  it("matches the published mass.gov values", () => {
    expect(SACA2_FIGURES.assetLimit.individual).toBe(2000)
    expect(SACA2_FIGURES.assetLimit.marriedCoupleMember).toBe(3000)
    expect(SACA2_FIGURES.federalBenefitRate300Monthly).toBe(2982)
    expect(SACA2_FIGURES.personalNeedsAllowance).toBe(72.8)
    expect(SACA2_FIGURES.maxHomeEquity).toBe(1_130_000)
    expect(SACA2_FIGURES.communitySpouseResource).toEqual({ min: 32_532, max: 162_660 })
    expect(SACA2_FIGURES.mmmnaMax).toBe(4066.5)
    expect(SACA2_FIGURES.nursingFacilityDailyCost).toBe(450)
    expect(SACA2_FIGURES.medicarePartBPremiumMonthly).toBe(202.9)
    expect(SACA2_FIGURES.lookBackMonths).toBe(60)
    expect(SACA2_FIGURES.lifeInsuranceFaceValuePerPerson).toBe(1500)
  })

  it("resolves mid-year effective-dated figures", () => {
    const { mmmnaMin, standardShelterExpense, snapUtility } = SACA2_FIGURES
    expect(getEffectiveFigure(mmmnaMin, new Date("2026-06-30"))).toBe(2643.75)
    expect(getEffectiveFigure(mmmnaMin, new Date("2026-07-01"))).toBe(2705)
    expect(getEffectiveFigure(standardShelterExpense, new Date("2026-07-01"))).toBe(811.5)
    expect(getEffectiveFigure(standardShelterExpense, new Date("2026-06-30"))).toBe(793.13)
    expect(getEffectiveFigure(snapUtility.heat, new Date("2026-10-01"))).toBe(945)
    expect(getEffectiveFigure(snapUtility.noHeat, new Date("2026-10-01"))).toBe(575)
    expect(getEffectiveFigure(snapUtility.heat, new Date("2026-09-30"))).toBe(914)
  })

  it("throws when asked for a date before the earliest entry", () => {
    expect(() => getEffectiveFigure(SACA2_FIGURES.mmmnaMin, new Date("2020-01-01"))).toThrow(
      /no figure effective/i,
    )
  })
})

describe("getFplRow", () => {
  it("returns table rows for sizes 1-8", () => {
    const one = getFplRow(1)
    expect(one.massHealthStandard).toEqual({ monthly: 522, yearly: 6264 })
    expect(one.fpl100).toEqual({ monthly: 1330, yearly: 15960 })
    expect(one.fpl133).toEqual({ monthly: 1769, yearly: 21228 })
    expect(one.fpl300).toEqual({ monthly: 3990, yearly: 47880 })
    const two = getFplRow(2)
    expect(two.fpl100).toEqual({ monthly: 1804, yearly: 21648 })
    expect(getFplRow(8).fpl100).toEqual({ monthly: 4644, yearly: 55728 })
  })

  it("extrapolates beyond 8 using the per-additional-person increment", () => {
    // 100% FPL: size 8 = 55,728 yearly; +5,688 per additional person.
    expect(getFplRow(9).fpl100.yearly).toBe(55_728 + 5_688)
    expect(getFplRow(10).fpl100.yearly).toBe(55_728 + 2 * 5_688)
  })

  it("rejects non-positive or non-integer sizes", () => {
    expect(() => getFplRow(0)).toThrow(/family size/i)
    expect(() => getFplRow(-1)).toThrow(/family size/i)
    expect(() => getFplRow(2.5)).toThrow(/family size/i)
  })
})

describe("staleness guard", () => {
  it("fails once the calendar year passes the figures year", () => {
    // MassHealth republishes these every January. When this test fails, update
    // figures-2026.ts from
    // https://www.mass.gov/info-details/program-financial-guidelines-for-certain-masshealth-applicants-and-members
    // and rename/re-year the module.
    expect(new Date().getFullYear()).toBeLessThanOrEqual(SACA2_FIGURES_YEAR)
  })
})
