// TAFDC (Transitional Aid to Families with Dependent Children) evaluator
// MA DTA — cash assistance for families with children under 18
// https://www.mass.gov/tafdc
import type { FamilyProfile, BenefitResult } from '../types'
import { getAnnualFPL } from '../fpl-utils'

// TAFDC grant amounts (2025, approximate)
// Family size determines base grant; income reduces grant
const TAFDC_GRANTS: Record<number, number> = {
  1: 522,  // single person with children
  2: 667,
  3: 783,
  4: 883,
  5: 966,
  6: 1041,
}
const TAFDC_PER_ADDITIONAL = 75

function getTAFDCGrant(householdSize: number): number {
  const size = Math.min(householdSize, 6)
  return TAFDC_GRANTS[size] ?? TAFDC_GRANTS[6] + (householdSize - 6) * TAFDC_PER_ADDITIONAL
}

// TAFDC income limits are very low — approximately 50% FPL net income
// Gross income limit is roughly 185% FPL for the initial test (income counting rules complex)
const TAFDC_NET_INCOME_FPL_LIMIT = 0.50

export function evaluateTAFDC(profile: FamilyProfile, fplPercent: number): BenefitResult | null {
  if (!profile.stateResident) return null

  // Must have children under 18 in the household
  // OR be pregnant (for a "pregnant woman" filing unit)
  const hasEligibleChildren =
    profile.childrenUnder18 > 0 ||
    profile.householdMembers.some(
      (m) =>
        (m.relationship === 'child' || m.relationship === 'stepchild' || m.relationship === 'grandchild') &&
        m.age < 18 &&
        m.isStudent && m.age < 19 // 18-year-old full-time student counts
    )

  if (!hasEligibleChildren && !profile.pregnant) return null

  // Citizenship: citizens and most qualified immigrants
  // Undocumented adults cannot receive TAFDC (children who are citizens can)
  const primaryIsEligible =
    profile.citizenshipStatus === 'citizen' || profile.citizenshipStatus === 'qualified_immigrant'

  // If primary is undocumented but has citizen children — EAEDC or child-only case may apply instead
  if (!primaryIsEligible) return null

  // TAFDC income limit: net income ≤ 50% FPL
  if (fplPercent > 100) return null // Quick screen — net income will be lower but gross >100% FPL usually ineligible

  const annualFPL = getAnnualFPL(profile.householdSize)
  const grantAmount = getTAFDCGrant(profile.householdSize)

  // Earned income: first $200/month plus 50% of remaining wages disregarded for first 12 months
  const monthlyWages = profile.income.wages + profile.householdMembers.reduce((a, m) => a + m.income.wages, 0)
  const earnedDisregard = Math.min(monthlyWages, 200) + Math.max(0, monthlyWages - 200) * 0.5
  const otherIncome =
    profile.income.socialSecurity +
    profile.income.ssi +
    profile.income.unemployment +
    profile.income.pension +
    profile.income.other +
    profile.householdMembers.reduce(
      (a, m) => a + m.income.socialSecurity + m.income.ssi + m.income.unemployment + m.income.pension,
      0
    )
  const countableIncome = Math.max(0, monthlyWages - earnedDisregard) + otherIncome
  const estimatedGrant = Math.max(0, grantAmount - countableIncome)

  if (estimatedGrant <= 0) return null

  const netFPL = Math.round(((countableIncome * 12) / annualFPL) * 100)
  const eligibleForTAFDC = netFPL <= TAFDC_NET_INCOME_FPL_LIMIT * 100

  if (!eligibleForTAFDC) return null

  return {
    programId: 'tafdc',
    programName: 'TAFDC Cash Assistance',
    programShortName: 'TAFDC',
    category: 'cash',
    administeredBy: 'MA DTA',
    eligibilityStatus: fplPercent <= 50 ? 'likely' : 'possibly',
    confidence: fplPercent <= 30 ? 78 : 58,
    estimatedMonthlyValue: estimatedGrant,
    estimatedAnnualValue: estimatedGrant * 12,
    valueNote: `~$${estimatedGrant.toLocaleString()}/month cash assistance for family of ${profile.householdSize}`,
    score: 0,
    priority: 0,
    applicationMethods: ['online', 'phone', 'in_person'],
    applicationUrl: 'https://www.dta.mass.gov',
    applicationPhone: '1-877-382-2363',
    processingTime: '30 days',
    keyRequirements: [
      'MA resident',
      `At least ${profile.childrenUnder18} child${profile.childrenUnder18 > 1 ? 'ren' : ''} under 18 in household`,
      `Net income ≤50% FPL (~$${Math.round(annualFPL * 0.5 / 12).toLocaleString()}/month)`,
      'Citizens or qualified immigrants only',
      'Participation in DTA work program (unless exempt)',
    ],
    requiredDocuments: [
      'Photo ID',
      'Social Security cards for all household members',
      'Proof of MA residency (lease, utility bill)',
      "Children's birth certificates",
      'Proof of income (pay stubs, benefit letters)',
      'Proof of citizenship or immigration status',
    ],
    bundleWith: ['snap', 'eaedc'],
    bundleNote: 'One DTA application covers TAFDC, SNAP, and EAEDC — apply once at dta.mass.gov',
    applicationNote:
      'TAFDC is time-limited to 24 months in any 60-month period. Work requirements apply unless exempt (caring for child under 2, disability, etc.).',
    nextSteps: [
      'Apply online at dtaconnect.eohhs.state.ma.us or call 1-877-382-2363',
      'SNAP and MassHealth may also be auto-enrolled when you apply for TAFDC',
      'Ask about work exemptions if you are caring for a child under 2 or have a disability',
      'TAFDC is time-limited — 24 months in any 60-month period for most families',
    ],
  }
}
