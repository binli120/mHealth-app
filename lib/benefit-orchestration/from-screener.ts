/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Maps a quick ScreenerData snapshot into a minimal FamilyProfile so the
 * full cross-program benefit orchestrator can run against screener-level inputs.
 *
 * Limitations: household members are not modeled at screener level, so
 * child-specific program tracks (e.g., MassHealth Standard for children) will
 * produce conservative estimates.  The intake agent collects full member
 * details and produces a complete FamilyProfile for more precise evaluation.
 */

import type { ScreenerData } from '../eligibility-engine'
import type { FamilyProfile } from './types'
import { emptyIncome } from './fpl-utils'

type RawFamilyProfile = Omit<
  FamilyProfile,
  'householdSize' | 'childrenUnder5' | 'childrenUnder13' | 'childrenUnder18' | 'childrenUnder19'
> & Partial<
  Pick<FamilyProfile, 'householdSize' | 'childrenUnder5' | 'childrenUnder13' | 'childrenUnder18' | 'childrenUnder19'>
>

/**
 * Convert screener facts into a FamilyProfile for the benefit orchestrator.
 *
 * Income is treated as wage income (most common case for screener users).
 * All asset fields default to zero; the orchestrator handles missing assets
 * conservatively (no asset-based disqualification without confirmed data).
 */
export function screenerToFamilyProfile(data: Partial<ScreenerData>): RawFamilyProfile {
  const annualIncome = data.annualIncome ?? 0
  const monthlyWages = annualIncome / 12
  const age = data.age ?? 30

  return {
    age,
    pregnant: data.isPregnant ?? false,
    disabled: data.hasDisability ?? false,
    blind: false,
    over65: age >= 65,

    hasMedicare: data.hasMedicare ?? false,
    hasPrivateInsurance: false,
    hasEmployerInsurance: data.hasEmployerInsurance ?? false,

    citizenshipStatus: data.citizenshipStatus ?? 'citizen',
    stateResident: data.livesInMA ?? true,

    employmentStatus: monthlyWages > 0 ? 'employed' : 'not_working',
    income: {
      ...emptyIncome(),
      wages: monthlyWages,
    },

    assets: {
      bankAccounts: 0,
      investments: 0,
      realEstate: 0,
      vehicles: 0,
      other: 0,
    },

    housingStatus: 'renter',
    utilityTypes: [],

    taxFiler: false,
    householdMembers: [],

    // householdSize is provided so computeDerivedFields can use it directly
    // instead of counting members (which are unknown at screener level).
    householdSize: data.householdSize ?? 1,
  }
}
