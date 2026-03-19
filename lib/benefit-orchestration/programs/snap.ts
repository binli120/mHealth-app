/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

// SNAP (Supplemental Nutrition Assistance Program) evaluator
// Administered by MA DTA — dta.mass.gov
import type { FamilyProfile, BenefitResult } from '../types'
import { getAnnualFPL, sumIncome, computeTotalAssets } from '../fpl-utils'

// FY2026 SNAP maximum monthly benefit amounts
const SNAP_MAX_BENEFIT: Record<number, number> = {
  1: 292,
  2: 536,
  3: 768,
  4: 975,
  5: 1158,
  6: 1390,
  7: 1536,
  8: 1756,
}
const SNAP_ADDITIONAL_PER_PERSON = 220

// FY2026 SNAP gross income limit: 130% FPL
// Net income limit: 100% FPL
// Asset limits: $2,750 general; $4,250 if elderly (60+) or disabled
const SNAP_ASSET_LIMIT_GENERAL = 2750
const SNAP_ASSET_LIMIT_ELDERLY_DISABLED = 4250

function getSnapMaxBenefit(householdSize: number): number {
  if (householdSize <= 8) return SNAP_MAX_BENEFIT[householdSize] ?? SNAP_MAX_BENEFIT[8]
  return SNAP_MAX_BENEFIT[8] + (householdSize - 8) * SNAP_ADDITIONAL_PER_PERSON
}

function estimateNetIncome(profile: FamilyProfile): number {
  // Standard deduction (2026, households 1–3): ~$204; larger households slightly higher
  const standardDeduction = profile.householdSize >= 4 ? 220 : 204

  // Earned income deduction: 20% of earned income
  const earnedIncome = profile.income.wages + profile.income.selfEmployment +
    profile.householdMembers.reduce((a, m) => a + m.income.wages + m.income.selfEmployment, 0)
  const earnedDeduction = earnedIncome * 0.2

  // Dependent care deduction (rough: $0 here — would need actual care costs)
  const dependentCareDeduction = 0

  // Shelter deduction (rough estimate if renting)
  const monthlyRent = profile.monthlyRent ?? 0
  const shelterDeduction = monthlyRent > 0 ? Math.max(0, monthlyRent - 0.5 * (sumIncome(profile.income) - standardDeduction - earnedDeduction)) : 0
  const shelterCap = profile.householdMembers.some((m) => m.over65) || profile.disabled ? Infinity : 672 // 2026 shelter cap estimate

  const grossIncome = profile.householdMembers.reduce((a, m) => a + sumIncome(m.income), 0) + sumIncome(profile.income)
  return Math.max(
    0,
    grossIncome - standardDeduction - earnedDeduction - dependentCareDeduction - Math.min(shelterDeduction, shelterCap)
  )
}

function estimateSnapBenefit(profile: FamilyProfile): number {
  const netIncome = estimateNetIncome(profile)
  const maxBenefit = getSnapMaxBenefit(profile.householdSize)
  // Benefit = max benefit - 30% of net income
  return Math.max(0, Math.round(maxBenefit - netIncome * 0.3))
}

export function evaluateSnap(profile: FamilyProfile, fplPercent: number): BenefitResult | null {
  if (!profile.stateResident) return null

  // Citizenship: citizens and most qualified immigrants (5-year bar applies but MA has state-funded for some)
  const isEligibleCitizenship =
    profile.citizenshipStatus === 'citizen' || profile.citizenshipStatus === 'qualified_immigrant'
  if (!isEligibleCitizenship) return null

  const annualFPL = getAnnualFPL(profile.householdSize)
  const grossMonthlyIncome =
    profile.householdMembers.reduce((a, m) => a + sumIncome(m.income), 0) +
    sumIncome(profile.income)
  const grossFPL = Math.round(((grossMonthlyIncome * 12) / annualFPL) * 100)

  // Gross income test: ≤130% FPL
  if (grossFPL > 130) {
    // Categorically eligible households may be exempt from gross income test
    const categoricallyEligible =
      profile.income.ssi > 0 ||
      profile.householdMembers.some((m) => m.income.ssi > 0)
    if (!categoricallyEligible) return null
  }

  // Asset test (unless categorically eligible via TAFDC/SSI — waived in MA for most)
  // MA has broad categorical eligibility, so asset test is often waived
  const hasElderly = profile.over65 || profile.householdMembers.some((m) => m.over65)
  const assetLimit = hasElderly || profile.disabled ? SNAP_ASSET_LIMIT_ELDERLY_DISABLED : SNAP_ASSET_LIMIT_GENERAL
  const totalAssets = computeTotalAssets(profile)

  // MA grants broad categorical eligibility (waives asset test) for most households
  // Only strict asset test applies for elderly/disabled households
  const assetTestFails = hasElderly && totalAssets > assetLimit

  if (assetTestFails) {
    return {
      programId: 'snap',
      programName: 'SNAP (Food Stamps)',
      programShortName: 'SNAP',
      category: 'food',
      administeredBy: 'MA DTA',
      eligibilityStatus: 'possibly',
      confidence: 40,
      estimatedMonthlyValue: 0,
      estimatedAnnualValue: 0,
      valueNote: 'Assets may exceed limit — verify with DTA',
      score: 0,
      priority: 0,
      ineligibleReason: `Assets (~$${totalAssets.toLocaleString()}) may exceed SNAP limit ($${assetLimit.toLocaleString()}) for elderly/disabled households`,
      applicationMethods: ['online', 'phone', 'in_person'],
      applicationUrl: 'https://www.dta.mass.gov',
      applicationPhone: '1-877-382-2363',
      processingTime: '30 days (7 days if expedited)',
      keyRequirements: ['MA resident', 'Asset verification required'],
      requiredDocuments: ['Bank statements', 'Asset documentation'],
      bundleWith: ['tafdc', 'eaedc'],
      bundleNote: 'Apply for SNAP, TAFDC, and EAEDC together at dta.mass.gov',
      nextSteps: ['Contact DTA to verify asset eligibility', 'Apply at dta.mass.gov'],
    }
  }

  const estimatedBenefit = estimateSnapBenefit(profile)
  const maxBenefit = getSnapMaxBenefit(profile.householdSize)

  // Net income test (for final eligibility)
  const netIncome = estimateNetIncome(profile)
  const netFPL = Math.round(((netIncome * 12) / annualFPL) * 100)
  const passesNetTest = netFPL <= 100

  const eligibilityStatus = grossFPL <= 100 ? 'likely' : passesNetTest ? 'likely' : 'possibly'
  const confidence = grossFPL <= 80 ? 90 : grossFPL <= 100 ? 82 : 65

  return {
    programId: 'snap',
    programName: 'SNAP (Food Stamps)',
    programShortName: 'SNAP',
    category: 'food',
    administeredBy: 'MA DTA',
    eligibilityStatus,
    confidence,
    estimatedMonthlyValue: estimatedBenefit,
    estimatedAnnualValue: estimatedBenefit * 12,
    valueNote: `~$${estimatedBenefit}/month (max $${maxBenefit} for household of ${profile.householdSize})`,
    score: 0,
    priority: 0,
    applicationMethods: ['online', 'phone', 'in_person'],
    applicationUrl: 'https://www.dta.mass.gov',
    applicationPhone: '1-877-382-2363',
    processingTime: '30 days (7 days if expedited)',
    keyRequirements: [
      'MA resident',
      `Gross income ≤130% FPL (~$${Math.round(annualFPL * 1.3 / 12).toLocaleString()}/month)`,
      'US citizen or most qualified immigrants',
    ],
    requiredDocuments: [
      'Photo ID',
      'Proof of MA residency (utility bill, lease)',
      'Social Security card or number',
      'Proof of income (pay stubs, benefit letters)',
      'Proof of expenses (rent receipt, utility bills)',
    ],
    bundleWith: ['tafdc', 'eaedc'],
    bundleNote: 'One DTA application covers SNAP, TAFDC, and EAEDC — apply once at dta.mass.gov',
    nextSteps: [
      'Apply online at dta.mass.gov — fast, takes about 20 minutes',
      'Ask about Expedited SNAP if income is very low or you have no food',
      'Benefits are loaded onto an EBT card, accepted at most grocery stores',
    ],
  }
}
