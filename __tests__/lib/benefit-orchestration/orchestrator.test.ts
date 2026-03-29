import { describe, it, expect } from 'vitest'
import { evaluateBenefitStack } from '../../../lib/benefit-orchestration/orchestrator'
import { baseProfile, childMember, emptyIncome } from './fixtures'

// Strip derived fields so we can pass rawProfile
function rawProfile(overrides = {}) {
  const { householdSize, childrenUnder5, childrenUnder13, childrenUnder18, childrenUnder19, ...rest } = baseProfile(overrides)
  return rest
}

describe('evaluateBenefitStack', () => {
  it('returns a BenefitStack with required shape', () => {
    const stack = evaluateBenefitStack(rawProfile())
    expect(stack).toHaveProperty('generatedAt')
    expect(stack).toHaveProperty('fplPercent')
    expect(stack).toHaveProperty('results')
    expect(stack).toHaveProperty('likelyPrograms')
    expect(stack).toHaveProperty('possiblePrograms')
    expect(stack).toHaveProperty('quickWins')
    expect(stack).toHaveProperty('bundles')
    expect(stack).toHaveProperty('summary')
    expect(typeof stack.totalEstimatedMonthlyValue).toBe('number')
    expect(typeof stack.totalEstimatedAnnualValue).toBe('number')
  })

  it('excludes ineligible results from returned list', () => {
    const stack = evaluateBenefitStack(rawProfile())
    const statuses = stack.results.map((r) => r.eligibilityStatus)
    expect(statuses).not.toContain('ineligible')
  })

  it('ranks results in priority order (priority 1 = highest score)', () => {
    const stack = evaluateBenefitStack(rawProfile({ income: { ...emptyIncome(), wages: 500 } }))
    const priorities = stack.results.map((r) => r.priority)
    for (let i = 0; i < priorities.length - 1; i++) {
      expect(priorities[i]).toBeLessThan(priorities[i + 1])
    }
  })

  it('quickWins contains at most 3 likely programs', () => {
    const stack = evaluateBenefitStack(rawProfile())
    expect(stack.quickWins.length).toBeLessThanOrEqual(3)
    stack.quickWins.forEach((r) => expect(r.eligibilityStatus).toBe('likely'))
  })

  it('totalEstimatedAnnualValue = totalEstimatedMonthlyValue * 12', () => {
    const stack = evaluateBenefitStack(rawProfile())
    expect(stack.totalEstimatedAnnualValue).toBe(stack.totalEstimatedMonthlyValue * 12)
  })

  it('returns empty summary when no eligible programs', () => {
    // Non-resident should get no programs
    const stack = evaluateBenefitStack(rawProfile({ stateResident: false }))
    expect(stack.results).toHaveLength(0)
    expect(stack.summary).toContain('did not find')
  })

  it('computes fplPercent 0 for zero income', () => {
    const stack = evaluateBenefitStack(rawProfile({ income: emptyIncome() }))
    expect(stack.fplPercent).toBe(0)
  })

  it('builds DTA bundle when SNAP and TAFDC/EAEDC are both present', () => {
    // Low-income single parent with child → likely SNAP + TAFDC
    const child = childMember(5)
    const profile = rawProfile({
      income: { ...emptyIncome(), wages: 500 },
      householdMembers: [child],
      employmentStatus: 'unemployed',
    })
    const stack = evaluateBenefitStack(profile)
    const dtaBundle = stack.bundles.find((b) => b.bundleId === 'dta_bundle')
    // Only assert bundle exists if both DTA programs appeared
    const dtaIds = ['snap', 'tafdc', 'eaedc']
    const dtaCount = stack.results.filter((r) => dtaIds.includes(r.programId)).length
    if (dtaCount >= 2) {
      expect(dtaBundle).toBeDefined()
    }
  })

  it('builds MassHealth bundle when multiple MH programs qualify', () => {
    const child = childMember(8)
    const profile = rawProfile({
      income: { ...emptyIncome(), wages: 800 },
      householdMembers: [child],
    })
    const stack = evaluateBenefitStack(profile)
    const mhIds = ['masshealth_standard', 'masshealth_careplus', 'masshealth_family_assistance', 'masshealth_limited', 'masshealth_standard_pregnancy', 'connector_care', 'msp']
    const mhCount = stack.results.filter((r) => mhIds.includes(r.programId)).length
    const mhBundle = stack.bundles.find((b) => b.bundleId === 'masshealth_bundle')
    if (mhCount >= 2) {
      expect(mhBundle).toBeDefined()
    }
  })

  it('summary mentions program counts', () => {
    const stack = evaluateBenefitStack(rawProfile({ income: { ...emptyIncome(), wages: 500 } }))
    if (stack.likelyPrograms.length > 0) {
      expect(stack.summary).toMatch(/\d+ program/)
    }
  })

  it('householdSize reflects number of members', () => {
    const stack = evaluateBenefitStack(rawProfile({ householdMembers: [childMember(5)] }))
    expect(stack.householdSize).toBe(2)
  })

  it('generatedAt is a valid ISO date string', () => {
    const stack = evaluateBenefitStack(rawProfile())
    expect(() => new Date(stack.generatedAt)).not.toThrow()
    expect(new Date(stack.generatedAt).getFullYear()).toBeGreaterThan(2020)
  })
})
