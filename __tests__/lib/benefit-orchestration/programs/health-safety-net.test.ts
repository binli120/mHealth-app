/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from 'vitest'
import { evaluateHealthSafetyNet } from '../../../../lib/benefit-orchestration/programs/health-safety-net'
import { baseProfile, emptyIncome } from '../fixtures'

function monthlyWagesAtFpl(fplPct: number) {
  const annualFPL = 15960
  return Math.round((annualFPL * fplPct) / 100 / 12)
}

describe('evaluateHealthSafetyNet', () => {
  it('returns no result for non-Massachusetts residents', () => {
    const profile = baseProfile({ stateResident: false })
    expect(evaluateHealthSafetyNet(profile, 0)).toEqual([])
  })

  it('returns HSN Primary for an uninsured MA resident at or below 150% FPL', () => {
    const profile = baseProfile({
      hasPrivateInsurance: false,
      hasEmployerInsurance: false,
      hasMedicare: false,
      income: emptyIncome(),
    })

    const results = evaluateHealthSafetyNet(profile, 0)

    expect(results).toHaveLength(1)
    expect(results[0].programId).toBe('health_safety_net_primary')
    expect(results[0].eligibilityStatus).toBe('likely')
    expect(results[0].applicationUrl).toBe('/application/type?recommended=hsn')
    expect(results[0].keyRequirements).toContain('Household income at or below 300% FPL')
    expect(results[0].keyRequirements.join(' ')).not.toContain('Partial')
  })

  it('adds a partial deductible warning for Low Income Patient status above 150% and at or below 300% FPL', () => {
    const profile = baseProfile({
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(200) },
    })

    const results = evaluateHealthSafetyNet(profile, 200)

    expect(results).toHaveLength(1)
    expect(results[0].programId).toBe('health_safety_net_primary')
    expect(results[0].keyRequirements.join(' ')).toContain('Partial')
    expect(results[0].nextSteps.join(' ')).toContain('deductible')
  })

  it('returns HSN Secondary for an insured MA resident at or below 300% FPL', () => {
    const profile = baseProfile({
      hasPrivateInsurance: true,
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(250) },
    })

    const results = evaluateHealthSafetyNet(profile, 250)

    expect(results).toHaveLength(1)
    expect(results[0].programId).toBe('health_safety_net_secondary')
    expect(results[0].valueNote).toContain('primary insurance')
  })

  it('returns no result above 300% FPL when no medical bill facts are present', () => {
    const profile = baseProfile({
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(350) },
    })

    expect(evaluateHealthSafetyNet(profile, 350)).toEqual([])
  })

  it('returns possible Medical Hardship above 300% FPL when recent medical bills are present', () => {
    const profile = baseProfile({
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(450) },
      healthSafetyNet: {
        hasRecentMedicalBills: true,
        totalAllowableMedicalBillsLast12Months: 12000,
      },
    })

    const results = evaluateHealthSafetyNet(profile, 450)

    expect(results).toHaveLength(1)
    expect(results[0].programId).toBe('health_safety_net_medical_hardship')
    expect(results[0].eligibilityStatus).toBe('possibly')
    expect(results[0].nextSteps.join(' ')).toContain('financial counseling')
  })

  it('does not return Low Income Patient status when a known non-enrollment blocker exists', () => {
    const profile = baseProfile({
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(100) },
      healthSafetyNet: {
        massHealthEligibleButNotEnrolled: true,
      },
    })

    expect(evaluateHealthSafetyNet(profile, 100)).toEqual([])
  })
})
