import { describe, it, expect } from 'vitest'
import {
  getAnnualFPL,
  getMonthlyFPL,
  getIncomeAsFPLPercent,
  sumIncome,
  computeTotalMonthlyIncome,
  computeEarnedIncome,
  computeTotalAssets,
  computeDerivedFields,
  computeMAGIMonthly,
  emptyIncome,
} from '../../../lib/benefit-orchestration/fpl-utils'
import { baseProfile, childMember, emptyAssets } from './fixtures'
import type { IncomeBreakdown } from '../../../lib/benefit-orchestration/types'

// 2026 FPL constants
const FPL_BASE = 15060
const FPL_PER_ADDITIONAL = 5380

describe('getAnnualFPL', () => {
  it('returns base FPL for 1-person household', () => {
    expect(getAnnualFPL(1)).toBe(FPL_BASE)
  })

  it('adds per-additional amount for each extra member', () => {
    expect(getAnnualFPL(2)).toBe(FPL_BASE + FPL_PER_ADDITIONAL)
    expect(getAnnualFPL(4)).toBe(FPL_BASE + 3 * FPL_PER_ADDITIONAL)
  })

  it('clamps to at least 1 person for size 0', () => {
    expect(getAnnualFPL(0)).toBe(getAnnualFPL(1))
  })
})

describe('getMonthlyFPL', () => {
  it('returns annual FPL divided by 12 (rounded)', () => {
    expect(getMonthlyFPL(1)).toBe(Math.round(getAnnualFPL(1) / 12))
    expect(getMonthlyFPL(4)).toBe(Math.round(getAnnualFPL(4) / 12))
  })
})

describe('getIncomeAsFPLPercent', () => {
  it('returns 100 when annual income equals FPL', () => {
    const fpl = getAnnualFPL(1)
    expect(getIncomeAsFPLPercent(fpl, 1)).toBe(100)
  })

  it('returns 138 for 138% of FPL', () => {
    const fpl = getAnnualFPL(1)
    expect(getIncomeAsFPLPercent(fpl * 1.38, 1)).toBe(138)
  })

  it('returns 0 for zero income', () => {
    expect(getIncomeAsFPLPercent(0, 1)).toBe(0)
  })
})

describe('sumIncome', () => {
  it('returns 0 for all-zero income', () => {
    expect(sumIncome(emptyIncome())).toBe(0)
  })

  it('sums all income fields', () => {
    const income: IncomeBreakdown = {
      wages: 1000, selfEmployment: 200, unemployment: 300, socialSecurity: 400,
      ssi: 50, pension: 100, rental: 150, interest: 25, childSupport: 75,
      alimony: 50, veterans: 0, other: 100,
    }
    expect(sumIncome(income)).toBe(2450)
  })
})

describe('computeTotalMonthlyIncome', () => {
  it('returns primary income only for single-member household', () => {
    const profile = baseProfile({ income: { ...emptyIncome(), wages: 2000 } })
    expect(computeTotalMonthlyIncome(profile)).toBe(2000)
  })

  it('adds household members income', () => {
    const member = childMember(10, { income: { ...emptyIncome(), wages: 500 } })
    const profile = baseProfile({
      income: { ...emptyIncome(), wages: 2000 },
      householdMembers: [member],
    })
    expect(computeTotalMonthlyIncome(profile)).toBe(2500)
  })
})

describe('computeEarnedIncome', () => {
  it('returns only wages + self-employment for primary', () => {
    const profile = baseProfile({
      income: { ...emptyIncome(), wages: 1500, selfEmployment: 500, unemployment: 300 },
    })
    expect(computeEarnedIncome(profile)).toBe(2000)
  })

  it('includes earned income from household members', () => {
    const member = childMember(20, { income: { ...emptyIncome(), wages: 800 } })
    const profile = baseProfile({
      income: { ...emptyIncome(), wages: 1000 },
      householdMembers: [member],
    })
    expect(computeEarnedIncome(profile)).toBe(1800)
  })
})

describe('computeTotalAssets', () => {
  it('returns 0 for empty assets', () => {
    const profile = baseProfile()
    expect(computeTotalAssets(profile)).toBe(0)
  })

  it('sums all asset fields', () => {
    const profile = baseProfile({
      assets: { bankAccounts: 1000, investments: 2000, realEstate: 0, vehicles: 500, other: 100 },
    })
    expect(computeTotalAssets(profile)).toBe(3600)
  })
})

describe('computeDerivedFields', () => {
  it('sets householdSize to 1 when no members', () => {
    const profile = baseProfile()
    const derived = computeDerivedFields(profile)
    expect(derived.householdSize).toBe(1)
  })

  it('counts household members correctly', () => {
    const profile = baseProfile({ householdMembers: [childMember(3), childMember(7)] })
    const derived = computeDerivedFields(profile)
    expect(derived.householdSize).toBe(3)
    expect(derived.childrenUnder5).toBe(1)
    expect(derived.childrenUnder13).toBe(2)
    expect(derived.childrenUnder18).toBe(2)
    expect(derived.childrenUnder19).toBe(2)
  })

  it('counts a 4-year-old in all child buckets', () => {
    const profile = baseProfile({ householdMembers: [childMember(4)] })
    const derived = computeDerivedFields(profile)
    expect(derived.childrenUnder5).toBe(1)
    expect(derived.childrenUnder13).toBe(1)
    expect(derived.childrenUnder18).toBe(1)
    expect(derived.childrenUnder19).toBe(1)
  })

  it('does not count a 13-year-old in childrenUnder13', () => {
    const profile = baseProfile({ householdMembers: [childMember(13)] })
    const derived = computeDerivedFields(profile)
    expect(derived.childrenUnder13).toBe(0)
    expect(derived.childrenUnder18).toBe(1)
  })

  it('does not count non-child relationships in child buckets', () => {
    const profile = baseProfile({
      householdMembers: [{
        id: 'spouse-1', relationship: 'spouse', age: 4,
        pregnant: false, disabled: false, over65: false,
        citizenshipStatus: 'citizen', hasMedicare: false,
        income: emptyIncome(), isTaxDependent: false, isStudent: false, isCaringForChild: false,
      }],
    })
    const derived = computeDerivedFields(profile)
    expect(derived.childrenUnder5).toBe(0)
  })

  it('includes primary applicant in childrenUnder19 if under 19', () => {
    const profile = baseProfile({ age: 17 })
    const derived = computeDerivedFields(profile)
    expect(derived.childrenUnder19).toBe(1)
    expect(derived.childrenUnder18).toBe(1)
  })
})

describe('computeMAGIMonthly', () => {
  it('includes 85% of social security', () => {
    const profile = baseProfile({ income: { ...emptyIncome(), socialSecurity: 1000 } })
    expect(computeMAGIMonthly(profile)).toBeCloseTo(850)
  })

  it('excludes SSI, child support, alimony, veterans from MAGI', () => {
    const profile = baseProfile({
      income: { ...emptyIncome(), ssi: 500, childSupport: 200, alimony: 100, veterans: 150 },
    })
    expect(computeMAGIMonthly(profile)).toBe(0)
  })

  it('adds wages + self-employment + unemployment + rental + interest + pension', () => {
    const profile = baseProfile({
      income: { ...emptyIncome(), wages: 1000, selfEmployment: 200, unemployment: 300, rental: 100, interest: 50, pension: 150 },
    })
    expect(computeMAGIMonthly(profile)).toBe(1800)
  })
})
