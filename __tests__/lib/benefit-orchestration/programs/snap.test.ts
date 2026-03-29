import { describe, it, expect } from 'vitest'
import { evaluateSnap } from '../../../../lib/benefit-orchestration/programs/snap'
import { baseProfile, childMember, emptyIncome, emptyAssets } from '../fixtures'

describe('evaluateSnap — basic eligibility gates', () => {
  it('returns null for non-resident', () => {
    const profile = baseProfile({ stateResident: false })
    expect(evaluateSnap(profile, 50)).toBeNull()
  })

  it('returns null for undocumented applicant', () => {
    const profile = baseProfile({ citizenshipStatus: 'undocumented' })
    expect(evaluateSnap(profile, 50)).toBeNull()
  })

  it('returns null when gross income exceeds 130% FPL (non-categorical)', () => {
    // ~200% FPL — well above 130%
    const profile = baseProfile({ income: { ...emptyIncome(), wages: 3000 } })
    expect(evaluateSnap(profile, 200)).toBeNull()
  })

  it('returns result for citizen below 130% FPL', () => {
    const profile = baseProfile({ income: { ...emptyIncome(), wages: 500 } })
    const result = evaluateSnap(profile, 80)
    expect(result).not.toBeNull()
    expect(result?.programId).toBe('snap')
  })
})

describe('evaluateSnap — categorical eligibility (SSI)', () => {
  it('returns result for SSI recipient even if income exceeds 130% FPL', () => {
    const profile = baseProfile({
      income: { ...emptyIncome(), ssi: 3000 },
      citizenshipStatus: 'citizen',
    })
    const result = evaluateSnap(profile, 200)
    expect(result).not.toBeNull()
  })
})

describe('evaluateSnap — asset test for elderly/disabled', () => {
  it('returns "possibly" with asset warning when elderly household exceeds asset limit', () => {
    const profile = baseProfile({
      over65: true,
      assets: { ...emptyAssets(), bankAccounts: 10000 },
      citizenshipStatus: 'citizen',
    })
    const result = evaluateSnap(profile, 80)
    expect(result).not.toBeNull()
    expect(result?.eligibilityStatus).toBe('possibly')
    expect(result?.confidence).toBeLessThan(60)
  })

  it('passes asset test for non-elderly household regardless of assets', () => {
    const profile = baseProfile({
      assets: { ...emptyAssets(), bankAccounts: 50000 },
      citizenshipStatus: 'citizen',
      over65: false,
    })
    const result = evaluateSnap(profile, 80)
    // Non-elderly: MA waives asset test via broad categorical eligibility
    expect(result).not.toBeNull()
    expect(result?.eligibilityStatus).not.toBe('possibly')
  })
})

describe('evaluateSnap — benefit estimates', () => {
  it('returns estimatedMonthlyValue > 0 for eligible household', () => {
    const profile = baseProfile({ income: { ...emptyIncome(), wages: 800 } })
    const result = evaluateSnap(profile, 80)
    expect(result?.estimatedMonthlyValue).toBeGreaterThan(0)
  })

  it('estimatedAnnualValue = estimatedMonthlyValue * 12', () => {
    const profile = baseProfile({ income: { ...emptyIncome(), wages: 600 } })
    const result = evaluateSnap(profile, 60)
    expect(result?.estimatedAnnualValue).toBe((result?.estimatedMonthlyValue ?? 0) * 12)
  })

  it('larger household gets higher max benefit', () => {
    const profile1 = baseProfile({ income: { ...emptyIncome(), wages: 500 } })
    const profile4 = baseProfile({
      income: { ...emptyIncome(), wages: 500 },
      householdMembers: [childMember(3), childMember(6), childMember(10)],
      householdSize: 4,
    })
    const result1 = evaluateSnap(profile1, 50)
    const result4 = evaluateSnap(profile4, 30)
    expect(result4?.estimatedMonthlyValue ?? 0).toBeGreaterThan(result1?.estimatedMonthlyValue ?? 0)
  })
})

describe('evaluateSnap — eligibility status thresholds', () => {
  it('returns "likely" when gross income ≤100% FPL', () => {
    const profile = baseProfile({ income: { ...emptyIncome(), wages: 800 } })
    const result = evaluateSnap(profile, 75)
    expect(result?.eligibilityStatus).toBe('likely')
  })

  it('includes bundle info pointing to DTA', () => {
    const profile = baseProfile({ income: { ...emptyIncome(), wages: 600 } })
    const result = evaluateSnap(profile, 60)
    expect(result?.bundleWith).toContain('tafdc')
    expect(result?.applicationUrl).toContain('dta.mass.gov')
  })

  it('result shape has all required fields', () => {
    const profile = baseProfile({ income: { ...emptyIncome(), wages: 600 } })
    const result = evaluateSnap(profile, 60)
    expect(result?.category).toBe('food')
    expect(result?.administeredBy).toBe('MA DTA')
    expect(result?.keyRequirements.length).toBeGreaterThan(0)
    expect(result?.requiredDocuments.length).toBeGreaterThan(0)
    expect(result?.processingTime).toBeDefined()
  })
})
