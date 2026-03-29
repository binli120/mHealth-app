// Shared test fixtures for benefit-orchestration tests
import type { FamilyProfile, IncomeBreakdown, AssetBreakdown, HouseholdMemberProfile } from '../../../lib/benefit-orchestration/types'

export function emptyIncome(): IncomeBreakdown {
  return {
    wages: 0, selfEmployment: 0, unemployment: 0, socialSecurity: 0,
    ssi: 0, pension: 0, rental: 0, interest: 0, childSupport: 0,
    alimony: 0, veterans: 0, other: 0,
  }
}

export function emptyAssets(): AssetBreakdown {
  return { bankAccounts: 0, investments: 0, realEstate: 0, vehicles: 0, other: 0 }
}

/** Minimal valid FamilyProfile for a single adult citizen with no income */
export function baseProfile(overrides: Partial<FamilyProfile> = {}): FamilyProfile {
  return {
    age: 30,
    pregnant: false,
    disabled: false,
    blind: false,
    over65: false,
    hasMedicare: false,
    hasPrivateInsurance: false,
    hasEmployerInsurance: false,
    citizenshipStatus: 'citizen',
    stateResident: true,
    employmentStatus: 'unemployed',
    income: emptyIncome(),
    assets: emptyAssets(),
    housingStatus: 'renter',
    utilityTypes: [],
    taxFiler: true,
    householdMembers: [],
    householdSize: 1,
    childrenUnder5: 0,
    childrenUnder13: 0,
    childrenUnder18: 0,
    childrenUnder19: 0,
    ...overrides,
  }
}

export function childMember(age: number, overrides: Partial<HouseholdMemberProfile> = {}): HouseholdMemberProfile {
  return {
    id: `child-${age}`,
    relationship: 'child',
    age,
    pregnant: false,
    disabled: false,
    over65: false,
    citizenshipStatus: 'citizen',
    hasMedicare: false,
    income: emptyIncome(),
    isTaxDependent: true,
    isStudent: false,
    isCaringForChild: false,
    ...overrides,
  }
}
