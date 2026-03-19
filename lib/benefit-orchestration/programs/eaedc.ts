/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

// EAEDC (Emergency Aid to the Elderly, Disabled and Children) evaluator
// MA DTA — cash assistance for those not eligible for TAFDC
// https://www.mass.gov/eaedc
import type { FamilyProfile, BenefitResult } from '../types'
import { getAnnualFPL, sumIncome } from '../fpl-utils'

// EAEDC grant amounts (2025, approximate)
// Single adult: ~$303/month
// Varies slightly by circumstances
const EAEDC_SINGLE_GRANT = 303
const EAEDC_COUPLE_GRANT = 450

// EAEDC income limit: ≤ ~50% FPL (similar to TAFDC but separate program)
const EAEDC_INCOME_FPL_LIMIT = 0.50

export function evaluateEAEDC(profile: FamilyProfile, fplPercent: number): BenefitResult | null {
  if (!profile.stateResident) return null

  // EAEDC serves people who are:
  // 1. Not eligible for TAFDC
  // 2. Age 65+ OR disabled/blind OR a caretaker of a child with a disabled parent
  // 3. Very low income

  // Must be: elderly (65+), disabled, or caretaker relative of a child in the home
  const primaryIsEligibleCategory =
    profile.over65 ||
    profile.disabled ||
    profile.blind ||
    (profile.childrenUnder18 > 0 && profile.citizenshipStatus !== 'citizen' && profile.citizenshipStatus !== 'qualified_immigrant') // non-citizen caretaker

  if (!primaryIsEligibleCategory && !profile.over65 && !profile.disabled && !profile.blind) {
    // Check if there's an eligible household member scenario
    // EAEDC also covers households where children are citizens but parent is not
    const hasNonCitizenCaretaker =
      profile.citizenshipStatus === 'other' || profile.citizenshipStatus === 'undocumented'
    const hasCitizenChildren = profile.householdMembers.some(
      (m) =>
        (m.relationship === 'child' || m.relationship === 'stepchild') &&
        m.age < 18 &&
        (m.citizenshipStatus === 'citizen')
    )
    if (!hasNonCitizenCaretaker || !hasCitizenChildren) return null
  }

  // Quick income check — EAEDC has very low income limits
  if (fplPercent > 100) return null

  const annualFPL = getAnnualFPL(profile.householdSize)
  const totalMonthlyIncome = sumIncome(profile.income) + profile.householdMembers.reduce((a, m) => a + sumIncome(m.income), 0)
  const netFPL = Math.round((totalMonthlyIncome * 12 / annualFPL) * 100)

  if (netFPL > EAEDC_INCOME_FPL_LIMIT * 100) return null

  const hasSpouse = profile.householdMembers.some((m) => m.relationship === 'spouse' || m.relationship === 'partner')
  const grantAmount = hasSpouse ? EAEDC_COUPLE_GRANT : EAEDC_SINGLE_GRANT

  const eligibility =
    (profile.over65 || profile.disabled || profile.blind) ? 'likely' : 'possibly'
  const confidence =
    (profile.over65 || profile.disabled) && fplPercent <= 30 ? 75 : 55

  return {
    programId: 'eaedc',
    programName: 'EAEDC Cash Assistance',
    programShortName: 'EAEDC',
    category: 'cash',
    administeredBy: 'MA DTA',
    eligibilityStatus: eligibility,
    confidence,
    estimatedMonthlyValue: grantAmount,
    estimatedAnnualValue: grantAmount * 12,
    valueNote: `~$${grantAmount}/month cash assistance`,
    score: 0,
    priority: 0,
    applicationMethods: ['online', 'phone', 'in_person'],
    applicationUrl: 'https://www.dta.mass.gov',
    applicationPhone: '1-877-382-2363',
    processingTime: '30 days',
    keyRequirements: [
      'MA resident',
      'Age 65+, disabled/blind, OR caretaker of a child when normal TAFDC is unavailable',
      `Income ≤50% FPL (~$${Math.round(annualFPL * 0.5 / 12).toLocaleString()}/month)`,
      'Not eligible for TAFDC',
    ],
    requiredDocuments: [
      'Photo ID',
      'Proof of MA residency',
      'Social Security card or number',
      'Proof of income',
      profile.disabled ? 'Disability documentation (physician letter, SSI/SSDI award letter)' : '',
      profile.over65 ? 'Birth certificate or other proof of age' : '',
    ].filter(Boolean),
    bundleWith: ['snap', 'tafdc'],
    bundleNote: 'One DTA application covers EAEDC, SNAP, and TAFDC — apply once at dta.mass.gov',
    nextSteps: [
      'Apply online at dtaconnect.eohhs.state.ma.us or call 1-877-382-2363',
      'SNAP benefits may also be available and processed at the same time',
      profile.disabled ? 'Apply for SSI through Social Security as well — SSI may provide more benefits' : '',
    ].filter(Boolean),
  }
}
