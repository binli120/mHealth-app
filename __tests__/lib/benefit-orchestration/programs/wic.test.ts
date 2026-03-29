import { describe, it, expect } from 'vitest'
import { evaluateWIC } from '../../../../lib/benefit-orchestration/programs/wic'
import { baseProfile, childMember, emptyIncome } from '../fixtures'

describe('evaluateWIC — basic eligibility gates', () => {
  it('returns null for non-resident', () => {
    const profile = baseProfile({ stateResident: false, pregnant: true })
    expect(evaluateWIC(profile, 100)).toBeNull()
  })

  it('returns null when no eligible member (not pregnant, no young children)', () => {
    const profile = baseProfile({ age: 35, pregnant: false })
    expect(evaluateWIC(profile, 80)).toBeNull()
  })

  it('returns null when income exceeds 185% FPL', () => {
    const profile = baseProfile({ pregnant: true })
    expect(evaluateWIC(profile, 200)).toBeNull()
  })
})

describe('evaluateWIC — pregnant applicant', () => {
  it('returns WIC for pregnant woman at ≤185% FPL', () => {
    const profile = baseProfile({ pregnant: true })
    const result = evaluateWIC(profile, 100)
    expect(result).not.toBeNull()
    expect(result?.programId).toBe('wic')
    expect(result?.estimatedMonthlyValue).toBeGreaterThanOrEqual(80)
  })

  it('eligibilityStatus is "likely" at ≤150% FPL', () => {
    const profile = baseProfile({ pregnant: true })
    const result = evaluateWIC(profile, 120)
    expect(result?.eligibilityStatus).toBe('likely')
  })

  it('eligibilityStatus is "possibly" between 150–185% FPL', () => {
    const profile = baseProfile({ pregnant: true })
    const result = evaluateWIC(profile, 170)
    expect(result?.eligibilityStatus).toBe('possibly')
  })
})

describe('evaluateWIC — children in household', () => {
  it('returns WIC when household has child under 5', () => {
    const child = childMember(3)
    const profile = baseProfile({
      age: 30,
      pregnant: false,
      householdMembers: [child],
      householdSize: 2,
      childrenUnder5: 1,
    })
    const result = evaluateWIC(profile, 100)
    expect(result).not.toBeNull()
  })

  it('returns null when only child is 5+', () => {
    const child = childMember(6)
    const profile = baseProfile({
      age: 30,
      pregnant: false,
      householdMembers: [child],
      householdSize: 2,
      childrenUnder5: 0,
    })
    const result = evaluateWIC(profile, 100)
    // No eligible member (child is 6, not pregnant)
    expect(result).toBeNull()
  })
})

describe('evaluateWIC — benefit estimates', () => {
  it('includes infant in monthly value', () => {
    const infant = childMember(0) // age 0 = infant
    const profile = baseProfile({
      age: 28,
      pregnant: false,
      householdMembers: [infant],
      householdSize: 2,
      childrenUnder5: 1,
    })
    const result = evaluateWIC(profile, 80)
    expect(result?.estimatedMonthlyValue).toBeGreaterThanOrEqual(50)
  })

  it('estimatedAnnualValue = estimatedMonthlyValue * 12', () => {
    const profile = baseProfile({ pregnant: true })
    const result = evaluateWIC(profile, 100)
    if (result) {
      expect(result.estimatedAnnualValue).toBe(result.estimatedMonthlyValue * 12)
    }
  })

  it('result has required BenefitResult fields', () => {
    const profile = baseProfile({ pregnant: true })
    const result = evaluateWIC(profile, 100)
    expect(result?.category).toBe('food')
    expect(result?.administeredBy).toBe('MA DPH')
    expect(result?.applicationMethods).toContain('phone')
    expect(result?.keyRequirements.length).toBeGreaterThan(0)
    expect(result?.requiredDocuments.length).toBeGreaterThan(0)
  })
})
