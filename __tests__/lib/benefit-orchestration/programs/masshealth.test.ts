import { describe, it, expect } from 'vitest'
import { evaluateMassHealth } from '../../../../lib/benefit-orchestration/programs/masshealth'
import { baseProfile, childMember, emptyIncome } from '../fixtures'

// FPL 2026: 1-person = $15,060/yr = $1,255/mo
// evaluateMassHealth ignores the fplPercent param — it recomputes magiAsFPL from profile.income
// So tests must set actual income to land in the right MAGI bracket.

/** Monthly wages for a given FPL% for a 1-person household (MAGI = wages only) */
function monthlyWagesAtFpl(fplPct: number) {
  const annualFPL = 15060
  return Math.round((annualFPL * fplPct) / 100 / 12)
}

describe('evaluateMassHealth — non-resident', () => {
  it('returns empty array for non-MA resident', () => {
    const profile = baseProfile({ stateResident: false })
    expect(evaluateMassHealth(profile, 0)).toEqual([])
  })
})

describe('evaluateMassHealth — undocumented', () => {
  it('returns MassHealth Limited for undocumented non-pregnant adult', () => {
    const profile = baseProfile({ citizenshipStatus: 'undocumented' })
    const results = evaluateMassHealth(profile, 50)
    expect(results).toHaveLength(1)
    expect(results[0].programId).toBe('masshealth_limited')
    expect(results[0].eligibilityStatus).toBe('likely')
  })

  it('returns MassHealth Limited + Pregnancy for undocumented pregnant person', () => {
    const profile = baseProfile({ citizenshipStatus: 'undocumented', pregnant: true })
    const results = evaluateMassHealth(profile, 50)
    const ids = results.map((r) => r.programId)
    expect(ids).toContain('masshealth_limited')
    expect(ids).toContain('masshealth_standard_pregnancy')
  })
})

describe('evaluateMassHealth — pregnancy track', () => {
  it('returns pregnancy coverage when MAGI ≤200% FPL for citizen', () => {
    // ~150% FPL income
    const profile = baseProfile({
      pregnant: true,
      citizenshipStatus: 'citizen',
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(150) },
    })
    const results = evaluateMassHealth(profile, 150)
    const ids = results.map((r) => r.programId)
    expect(ids).toContain('masshealth_standard_pregnancy')
  })

  it('does not return pregnancy coverage when MAGI >200% FPL', () => {
    // ~250% FPL income — above the 200% threshold
    const profile = baseProfile({
      pregnant: true,
      citizenshipStatus: 'citizen',
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(250) },
    })
    const results = evaluateMassHealth(profile, 250)
    const ids = results.map((r) => r.programId)
    expect(ids).not.toContain('masshealth_standard_pregnancy')
  })
})

describe('evaluateMassHealth — children', () => {
  it('returns MassHealth Standard for household with children at ≤150% FPL MAGI', () => {
    const child = childMember(8)
    const profile = baseProfile({
      householdMembers: [child],
      householdSize: 2,
      income: { ...emptyIncome(), wages: 500 }, // low income → magiAsFPL well under 150%
    })
    const results = evaluateMassHealth(profile, 50)
    const ids = results.map((r) => r.programId)
    expect(ids).toContain('masshealth_standard')
  })

  it('returns Family Assistance (CHIP) for children at 150–300% FPL MAGI', () => {
    // 2-person household annual FPL = 15060 + 5380 = 20440
    // 200% = 40880/yr = 3407/mo
    const child = childMember(5)
    const twoPersonFPL = 15060 + 5380
    const wages = Math.round((twoPersonFPL * 2.0) / 12) // exactly 200% annual FPL → monthly
    const profile = baseProfile({
      householdMembers: [child],
      householdSize: 2,
      income: { ...emptyIncome(), wages },
    })
    const results = evaluateMassHealth(profile, 200)
    const ids = results.map((r) => r.programId)
    expect(ids).toContain('masshealth_family_assistance')
  })

  it('does not return children track when no children under 19 present', () => {
    const profile = baseProfile({ age: 35 })
    const results = evaluateMassHealth(profile, 100)
    const ids = results.map((r) => r.programId)
    expect(ids).not.toContain('masshealth_family_assistance')
  })
})

describe('evaluateMassHealth — adults 19–64', () => {
  it('returns CarePlus for adult at ≤138% MAGI FPL without Medicare', () => {
    const profile = baseProfile({
      age: 35,
      citizenshipStatus: 'citizen',
      hasMedicare: false,
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(100) }, // 100% FPL
    })
    const results = evaluateMassHealth(profile, 100)
    const ids = results.map((r) => r.programId)
    expect(ids).toContain('masshealth_careplus')
  })

  it('returns Standard (disabled) for disabled adult at ≤133% MAGI FPL', () => {
    const profile = baseProfile({
      age: 40,
      disabled: true,
      citizenshipStatus: 'citizen',
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(100) },
    })
    const results = evaluateMassHealth(profile, 100)
    const ids = results.map((r) => r.programId)
    expect(ids).toContain('masshealth_standard')
  })

  it('returns ConnectorCare at 138–300% MAGI FPL', () => {
    const profile = baseProfile({
      age: 35,
      citizenshipStatus: 'citizen',
      hasMedicare: false,
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(200) }, // 200% FPL
    })
    const results = evaluateMassHealth(profile, 200)
    const ids = results.map((r) => r.programId)
    expect(ids).toContain('connector_care')
  })

  it('returns Health Connector Credits at 300–500% MAGI FPL', () => {
    const profile = baseProfile({
      age: 35,
      citizenshipStatus: 'citizen',
      hasMedicare: false,
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(400) }, // 400% FPL
    })
    const results = evaluateMassHealth(profile, 400)
    const ids = results.map((r) => r.programId)
    expect(ids).toContain('health_connector_credits')
    expect(results.find((r) => r.programId === 'health_connector_credits')?.eligibilityStatus).toBe('possibly')
  })

  it('returns no adult coverage above 500% MAGI FPL', () => {
    const profile = baseProfile({
      age: 35,
      citizenshipStatus: 'citizen',
      hasMedicare: false,
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(600) }, // 600% FPL
    })
    const results = evaluateMassHealth(profile, 600)
    const adultIds = ['masshealth_careplus', 'masshealth_standard', 'connector_care', 'health_connector_credits']
    const found = results.filter((r) => adultIds.includes(r.programId))
    expect(found).toHaveLength(0)
  })
})

describe('evaluateMassHealth — seniors 65+', () => {
  it('returns MassHealth Standard (dual eligible) for 65+ with Medicare at ≤100% MAGI FPL', () => {
    const profile = baseProfile({
      age: 70,
      over65: true,
      hasMedicare: true,
      citizenshipStatus: 'citizen',
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(80) }, // 80% FPL
    })
    const results = evaluateMassHealth(profile, 80)
    const ids = results.map((r) => r.programId)
    expect(ids).toContain('masshealth_standard')
  })

  it('does not return dual-eligible track when MAGI >100% FPL', () => {
    const profile = baseProfile({
      age: 70,
      over65: true,
      hasMedicare: true,
      citizenshipStatus: 'citizen',
      income: { ...emptyIncome(), wages: monthlyWagesAtFpl(150) }, // 150% FPL
    })
    const results = evaluateMassHealth(profile, 150)
    // seniors track only fires at ≤100% FPL; standard for dual-eligible should not appear
    const standard = results.find((r) => r.programId === 'masshealth_standard')
    expect(standard).toBeUndefined()
  })
})

describe('evaluateMassHealth — result shape', () => {
  it('all results have required BenefitResult fields', () => {
    const child = childMember(3)
    const profile = baseProfile({
      pregnant: true,
      householdMembers: [child],
      householdSize: 2,
      income: { ...emptyIncome(), wages: 800 },
    })
    const results = evaluateMassHealth(profile, 100)
    results.forEach((r) => {
      expect(r.programId).toBeDefined()
      expect(r.programName).toBeDefined()
      expect(r.category).toBe('healthcare')
      expect(r.estimatedMonthlyValue).toBeGreaterThanOrEqual(0)
      expect(r.estimatedAnnualValue).toBeGreaterThanOrEqual(0)
      expect(r.keyRequirements.length).toBeGreaterThan(0)
      expect(r.nextSteps.length).toBeGreaterThan(0)
    })
  })
})
