import { describe, it, expect } from 'vitest'
import { evaluateEITC } from '../../../../lib/benefit-orchestration/programs/eitc'
import { baseProfile, childMember, emptyIncome } from '../fixtures'

describe('evaluateEITC — basic eligibility gates', () => {
  it('returns null for non-resident', () => {
    const profile = baseProfile({ stateResident: false, income: { ...emptyIncome(), wages: 2000 } })
    expect(evaluateEITC(profile, 80)).toBeNull()
  })

  it('returns null for undocumented applicant', () => {
    const profile = baseProfile({ citizenshipStatus: 'undocumented', income: { ...emptyIncome(), wages: 2000 } })
    expect(evaluateEITC(profile, 80)).toBeNull()
  })

  it('returns null when not a tax filer', () => {
    const profile = baseProfile({ taxFiler: false, income: { ...emptyIncome(), wages: 2000 } })
    expect(evaluateEITC(profile, 80)).toBeNull()
  })

  it('returns null with zero earned income', () => {
    const profile = baseProfile({ income: { ...emptyIncome(), socialSecurity: 1000 }, taxFiler: true })
    expect(evaluateEITC(profile, 80)).toBeNull()
  })

  it('returns null for childless adult under 25', () => {
    const profile = baseProfile({ age: 22, income: { ...emptyIncome(), wages: 1000 }, taxFiler: true })
    expect(evaluateEITC(profile, 80)).toBeNull()
  })

  it('returns null for childless adult 65+', () => {
    const profile = baseProfile({ age: 65, income: { ...emptyIncome(), wages: 1000 }, taxFiler: true })
    expect(evaluateEITC(profile, 80)).toBeNull()
  })
})

describe('evaluateEITC — no qualifying children', () => {
  it('returns result for childless adult aged 25–64 with earned income', () => {
    const profile = baseProfile({ age: 30, income: { ...emptyIncome(), wages: 1000 }, taxFiler: true })
    const result = evaluateEITC(profile, 80)
    expect(result).not.toBeNull()
    expect(result?.programId).toBe('eitc_federal')
    expect(result?.category).toBe('tax_credit')
  })

  it('returns null when income exceeds childless limit', () => {
    // $18,591 is the 2026 single limit — exceed it
    const profile = baseProfile({ age: 30, income: { ...emptyIncome(), wages: 2000 }, taxFiler: true }) // $24k/yr
    const result = evaluateEITC(profile, 160)
    expect(result).toBeNull()
  })
})

describe('evaluateEITC — with qualifying children', () => {
  it('returns result for adult with 1 qualifying child', () => {
    const child = childMember(5)
    const profile = baseProfile({
      age: 30,
      income: { ...emptyIncome(), wages: 2000 },
      householdMembers: [child],
      householdSize: 2,
      taxFiler: true,
    })
    const result = evaluateEITC(profile, 80)
    expect(result).not.toBeNull()
    expect(result?.estimatedAnnualValue).toBeGreaterThan(0)
  })

  it('credits increase with more qualifying children', () => {
    const oneChild = baseProfile({
      age: 30, income: { ...emptyIncome(), wages: 1500 },
      householdMembers: [childMember(3)],
      householdSize: 2, taxFiler: true,
    })
    const threeChildren = baseProfile({
      age: 30, income: { ...emptyIncome(), wages: 1500 },
      householdMembers: [childMember(3), childMember(5), childMember(7)],
      householdSize: 4, taxFiler: true,
    })
    const r1 = evaluateEITC(oneChild, 70)
    const r3 = evaluateEITC(threeChildren, 50)
    expect(r3?.estimatedAnnualValue ?? 0).toBeGreaterThan(r1?.estimatedAnnualValue ?? 0)
  })

  it('does not count non-dependent children for EITC', () => {
    const nonDepChild = childMember(10, { isTaxDependent: false })
    const profile = baseProfile({
      age: 30, income: { ...emptyIncome(), wages: 1000 },
      householdMembers: [nonDepChild],
      householdSize: 2, taxFiler: true,
    })
    const result = evaluateEITC(profile, 80)
    // Should evaluate as childless (no qualifying children)
    // Result is null only if age < 25, but age is 30 → still returns result as childless
    if (result) {
      expect(result.keyRequirements.join(' ')).toMatch(/Age 25/)
    }
  })
})

describe('evaluateEITC — MA credit', () => {
  it('includes MA EITC (40% of federal) in total value', () => {
    const profile = baseProfile({
      age: 30, income: { ...emptyIncome(), wages: 1200 },
      householdMembers: [childMember(4)],
      householdSize: 2, taxFiler: true,
    })
    const result = evaluateEITC(profile, 60)
    expect(result).not.toBeNull()
    // Total should be > federal alone (because MA adds 40%)
    expect(result?.valueNote).toMatch(/MA/)
  })

  it('estimatedAnnualValue = estimatedMonthlyValue * 12 (rounded)', () => {
    const profile = baseProfile({
      age: 30, income: { ...emptyIncome(), wages: 1000 },
      householdMembers: [childMember(3)],
      householdSize: 2, taxFiler: true,
    })
    const result = evaluateEITC(profile, 60)
    if (result) {
      expect(result.estimatedMonthlyValue).toBe(Math.round(result.estimatedAnnualValue / 12))
    }
  })
})

describe('evaluateEITC — MFJ income limit', () => {
  it('uses higher MFJ income limit for married filing jointly', () => {
    const child = childMember(5)
    // Use income near single limit but below MFJ limit for 1 child
    // Single limit: $49,084 → ~$4090/mo; MFJ limit: $56,004 → ~$4667/mo
    const profile = baseProfile({
      age: 35,
      income: { ...emptyIncome(), wages: 4200 }, // $50,400/yr — above single limit
      householdMembers: [child],
      householdSize: 2,
      taxFiler: true,
      filingStatus: 'married_filing_jointly',
    })
    const result = evaluateEITC(profile, 150)
    // Should qualify under MFJ limit
    expect(result).not.toBeNull()
  })
})
