// LIHEAP / Fuel Assistance evaluator
// Low Income Home Energy Assistance Program — administered by DHCD in MA
// https://www.mass.gov/fuel-assistance
import type { FamilyProfile, BenefitResult } from '../types'

// 2025 MA State Median Income — income limit for LIHEAP: 60% SMI
const MA_SMI_ANNUAL: Record<number, number> = {
  1: 78624,
  2: 91848,
  3: 107040,
  4: 122232,
  5: 137424,
  6: 152616,
}
const LIHEAP_SMI_THRESHOLD = 0.60 // 60% SMI

function getLIHEAPIncomeLimit(householdSize: number): number {
  const size = Math.min(householdSize, 6)
  return Math.round((MA_SMI_ANNUAL[size] ?? MA_SMI_ANNUAL[6]) * LIHEAP_SMI_THRESHOLD)
}

// MA LIHEAP benefit range (FY2025): $200–$2,400+/year depending on income, fuel type, and usage
// Priority groups (elderly, disabled, families with young children) may get larger benefits
function estimateLIHEAPBenefit(annualIncome: number, incomeLimit: number, isPriority: boolean): number {
  const pctLimit = annualIncome / incomeLimit
  let baseBenefit: number
  if (pctLimit <= 0.3) baseBenefit = 2200
  else if (pctLimit <= 0.5) baseBenefit = 1600
  else if (pctLimit <= 0.7) baseBenefit = 1000
  else baseBenefit = 600
  return isPriority ? Math.min(2400, Math.round(baseBenefit * 1.2)) : baseBenefit
}

export function evaluateLIHEAP(profile: FamilyProfile, _fplPercent: number): BenefitResult | null {
  if (!profile.stateResident) return null

  // Must have home energy costs (heat, electricity, gas, oil, etc.)
  const hasEligibleUtility =
    profile.utilityTypes.length > 0 &&
    (profile.housingStatus === 'renter' || profile.housingStatus === 'owner')

  if (!hasEligibleUtility) return null

  // Citizenship: citizens and qualified immigrants
  if (profile.citizenshipStatus === 'undocumented') return null

  const annualIncome =
    (Object.values(profile.income).reduce((a, v) => a + (v as number), 0) +
      profile.householdMembers.reduce(
        (a, m) => a + Object.values(m.income).reduce((b, v) => b + (v as number), 0),
        0
      )) * 12

  const incomeLimit = getLIHEAPIncomeLimit(profile.householdSize)

  // Also eligible if income ≤150% FPL (whichever is higher)
  // We've already checked FPL in the orchestrator, but use income directly here
  // LIHEAP is generous — most low-income households qualify
  if (annualIncome > incomeLimit) return null

  const isPriority =
    profile.over65 ||
    profile.disabled ||
    profile.childrenUnder5 > 0 ||
    profile.householdMembers.some((m) => m.over65)

  const estimatedAnnualBenefit = estimateLIHEAPBenefit(annualIncome, incomeLimit, isPriority)
  const estimatedMonthlyEquivalent = Math.round(estimatedAnnualBenefit / 12)
  const isLowIncome = annualIncome <= incomeLimit * 0.6

  return {
    programId: 'liheap',
    programName: 'LIHEAP / Fuel Assistance',
    programShortName: 'Fuel Assistance',
    category: 'utility',
    administeredBy: 'MA DHCD',
    eligibilityStatus: isLowIncome ? 'likely' : 'possibly',
    confidence: isLowIncome ? 83 : 68,
    estimatedMonthlyValue: estimatedMonthlyEquivalent,
    estimatedAnnualValue: estimatedAnnualBenefit,
    valueNote: `~$${estimatedAnnualBenefit.toLocaleString()}/year energy assistance (paid directly to utility/fuel vendor)`,
    score: 0,
    priority: 0,
    applicationMethods: ['online', 'phone', 'in_person'],
    applicationUrl: 'https://www.mass.gov/fuel-assistance',
    applicationNote:
      'Apply through your local Community Action Agency (CAA) — find yours at mass.gov/fuel-assistance. Open enrollment typically November–April.',
    processingTime: '30–60 days',
    keyRequirements: [
      'MA resident',
      'Pay home heating or electricity costs',
      `Income ≤60% State Median Income ($${incomeLimit.toLocaleString()}/yr for household of ${profile.householdSize})`,
      isPriority ? 'Priority applicant (elderly, disabled, or young children — faster processing)' : '',
    ].filter(Boolean),
    requiredDocuments: [
      'Photo ID',
      'Proof of MA residency',
      'Proof of income for all household members',
      'Most recent heating/utility bill',
      'Social Security numbers for all household members',
      profile.over65 || profile.householdMembers.some((m) => m.over65) ? 'Medicare or Social Security card' : '',
    ].filter(Boolean),
    nextSteps: [
      'Find your local Community Action Agency (CAA) at mass.gov/fuel-assistance',
      'Apply early in the heating season (October–November)',
      'Benefit is paid directly to your fuel dealer or utility company — nothing comes out of pocket',
      isPriority ? 'As a priority household, you may be processed faster and receive a larger benefit' : '',
      'Also ask about the Arrearage Management Program (AMP) if you have past-due utility bills',
    ].filter(Boolean),
  }
}
