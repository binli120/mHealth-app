// Re-export FPL utilities from the existing engine and add profile-level helpers
export {
  getAnnualFPL,
  getMonthlyFPL,
  getIncomeAsFPLPercent,
  FPL_TABLE_2026,
} from '../eligibility-engine'

import type { FamilyProfile, IncomeBreakdown } from './types'

/** Sum all fields in an IncomeBreakdown (monthly total) */
export function sumIncome(income: IncomeBreakdown): number {
  return (
    income.wages +
    income.selfEmployment +
    income.unemployment +
    income.socialSecurity +
    income.ssi +
    income.pension +
    income.rental +
    income.interest +
    income.childSupport +
    income.alimony +
    income.veterans +
    income.other
  )
}

/** Total monthly income across all household members including primary applicant */
export function computeTotalMonthlyIncome(profile: FamilyProfile): number {
  const primary = sumIncome(profile.income)
  const members = profile.householdMembers.reduce(
    (acc, m) => acc + sumIncome(m.income),
    0
  )
  return primary + members
}

/** Earned income only (wages + self-employment) — used for EITC */
export function computeEarnedIncome(profile: FamilyProfile): number {
  const primary = profile.income.wages + profile.income.selfEmployment
  const members = profile.householdMembers.reduce(
    (acc, m) => acc + m.income.wages + m.income.selfEmployment,
    0
  )
  return primary + members
}

/** Total asset value */
export function computeTotalAssets(profile: FamilyProfile): number {
  const a = profile.assets
  return a.bankAccounts + a.investments + a.realEstate + a.vehicles + a.other
}

/**
 * Compute derived count fields from householdMembers.
 * Call this before running the orchestrator.
 */
export function computeDerivedFields(
  profile: Omit<FamilyProfile, 'householdSize' | 'childrenUnder5' | 'childrenUnder13' | 'childrenUnder18' | 'childrenUnder19'>
): Pick<FamilyProfile, 'householdSize' | 'childrenUnder5' | 'childrenUnder13' | 'childrenUnder18' | 'childrenUnder19'> {
  const members = profile.householdMembers
  const children = members.filter(
    (m) => m.relationship === 'child' || m.relationship === 'stepchild' || m.relationship === 'grandchild'
  )

  // Primary applicant counts as 1
  const primaryIsChild = profile.age < 19

  let childrenUnder5 = children.filter((c) => c.age < 5).length
  let childrenUnder13 = children.filter((c) => c.age < 13).length
  let childrenUnder18 = children.filter((c) => c.age < 18).length
  let childrenUnder19 = children.filter((c) => c.age < 19).length

  // Include primary if they are a child-age applicant (rare, but possible in household context)
  if (primaryIsChild) {
    if (profile.age < 19) childrenUnder19++
    if (profile.age < 18) childrenUnder18++
    if (profile.age < 13) childrenUnder13++
    if (profile.age < 5) childrenUnder5++
  }

  return {
    householdSize: 1 + members.length,
    childrenUnder5,
    childrenUnder13,
    childrenUnder18,
    childrenUnder19,
  }
}

/** MAGI-based income: wages + self-employment + unemployment + SS (85% if taxable) + rental + interest + pension */
export function computeMAGIMonthly(profile: FamilyProfile): number {
  const i = profile.income
  const primaryMAGI =
    i.wages +
    i.selfEmployment +
    i.unemployment +
    i.socialSecurity * 0.85 + // 85% of SS included in MAGI
    i.rental +
    i.interest +
    i.pension

  const memberMAGI = profile.householdMembers.reduce((acc, m) => {
    const mi = m.income
    return (
      acc +
      mi.wages +
      mi.selfEmployment +
      mi.unemployment +
      mi.socialSecurity * 0.85 +
      mi.rental +
      mi.interest +
      mi.pension
    )
  }, 0)

  return primaryMAGI + memberMAGI
}

/** Zero-value IncomeBreakdown for default member initialization */
export function emptyIncome(): IncomeBreakdown {
  return {
    wages: 0,
    selfEmployment: 0,
    unemployment: 0,
    socialSecurity: 0,
    ssi: 0,
    pension: 0,
    rental: 0,
    interest: 0,
    childSupport: 0,
    alimony: 0,
    veterans: 0,
    other: 0,
  }
}
