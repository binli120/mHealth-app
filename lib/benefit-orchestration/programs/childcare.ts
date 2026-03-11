// Childcare Financial Assistance (CCFA) evaluator
// MA Department of Early Education and Care (EEC) / DTA
// https://www.mass.gov/child-care-financial-assistance
import type { FamilyProfile, BenefitResult } from '../types'

// 2025 MA State Median Income (SMI) by household size
// CCFA income limit: 85% SMI
const MA_SMI_ANNUAL: Record<number, number> = {
  1: 78624,
  2: 91848,
  3: 107040,  // 3-person SMI
  4: 122232,
  5: 137424,
  6: 152616,
}
const CCFA_SMI_THRESHOLD = 0.85

function getSMILimit(householdSize: number): number {
  const size = Math.min(householdSize, 6)
  return Math.round((MA_SMI_ANNUAL[size] ?? MA_SMI_ANNUAL[6]) * CCFA_SMI_THRESHOLD)
}

// Average MA childcare cost (center-based, toddler) ~$2,500–$3,200/month
// CCFA covers most of this; family pays a sliding-scale copay
// Copay estimate: ~$10–$300/month based on income; subsidy = full cost minus copay
function estimateCopay(annualIncome: number, smiLimit: number): number {
  const pctSMI = annualIncome / (smiLimit / CCFA_SMI_THRESHOLD) // % of actual SMI
  if (pctSMI <= 0.5) return 10
  if (pctSMI <= 0.65) return 50
  if (pctSMI <= 0.75) return 150
  return 300
}

export function evaluateChildcare(profile: FamilyProfile, _fplPercent: number): BenefitResult | null {
  if (!profile.stateResident) return null

  // Must have children under 13 (or under 16 if disabled)
  if (profile.childrenUnder13 === 0) return null

  // Citizenship: citizens and qualified immigrants
  if (profile.citizenshipStatus === 'undocumented') return null

  // Must be working, in job training, in school, or seeking work
  const isEligibleActivity =
    profile.employmentStatus === 'employed' ||
    profile.employmentStatus === 'self_employed' ||
    profile.employmentStatus === 'student' ||
    profile.employmentStatus === 'unemployed' // actively seeking work

  if (!isEligibleActivity) return null

  const annualIncome =
    (Object.values(profile.income).reduce((a, v) => a + (v as number), 0) +
      profile.householdMembers.reduce(
        (a, m) => a + Object.values(m.income).reduce((b, v) => b + (v as number), 0),
        0
      )) * 12

  const smiLimit = getSMILimit(profile.householdSize)

  if (annualIncome > smiLimit) return null

  const avgChildcareCostPerChild = 2500 // monthly center-based cost estimate
  const copay = estimateCopay(annualIncome, smiLimit)
  const subsidyPerChild = Math.max(0, avgChildcareCostPerChild - copay)
  const totalMonthlySubsidy = subsidyPerChild * profile.childrenUnder13
  const isLowIncome = annualIncome <= smiLimit * 0.5

  return {
    programId: 'childcare_ccfa',
    programName: 'Childcare Financial Assistance (CCFA)',
    programShortName: 'Childcare CCFA',
    category: 'childcare',
    administeredBy: 'MA EEC / DTA',
    eligibilityStatus: isLowIncome ? 'likely' : 'possibly',
    confidence: isLowIncome ? 80 : 65,
    estimatedMonthlyValue: totalMonthlySubsidy,
    estimatedAnnualValue: totalMonthlySubsidy * 12,
    valueNote: `~$${subsidyPerChild.toLocaleString()}/month per child (family copay ~$${copay}/month)`,
    score: 0,
    priority: 0,
    applicationMethods: ['online', 'phone'],
    applicationUrl: 'https://www.mass.gov/how-to/apply-for-child-care-financial-assistance',
    applicationPhone: '1-800-DTA-KIDS (1-800-382-5437)',
    processingTime: '45 days',
    keyRequirements: [
      'MA resident',
      `${profile.childrenUnder13} child${profile.childrenUnder13 > 1 ? 'ren' : ''} under 13 in household`,
      'Parent/guardian must be working, in school, or in job training',
      `Income ≤85% State Median Income ($${smiLimit.toLocaleString()}/yr for household of ${profile.householdSize})`,
    ],
    requiredDocuments: [
      'Photo ID',
      'Proof of MA residency',
      "Children's birth certificates",
      'Proof of income (pay stubs, tax return)',
      'Proof of employment, school enrollment, or job training',
      'Child care provider information',
    ],
    nextSteps: [
      `Apply at mass.gov/childcare-financial-assistance for ${profile.childrenUnder13} child${profile.childrenUnder13 > 1 ? 'ren' : ''}`,
      'You can use any licensed child care provider in MA who accepts CCFA',
      'Copay is based on income — lower income means lower copay',
      'Waitlists may apply — apply even if you are not immediately in need of care',
    ],
  }
}
