/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

// EITC evaluator — Federal Earned Income Tax Credit + MA EITC (40% of federal)
// Both are annual credits filed with tax return; MA credit refundable
import type { FamilyProfile, BenefitResult } from '../types'
import { computeEarnedIncome } from '../fpl-utils'

// 2026 EITC estimate (IRS adjusts annually for inflation)
// Federal EITC maximum credit amounts by qualifying children (2026 estimates)
const EITC_MAX_FEDERAL: Record<number, number> = {
  0: 649,
  1: 4328,
  2: 7152,
  3: 8046, // 3+ children same rate
}

// 2026 EITC income limits (earned income + AGI must be below these)
// Single / Head of Household / Married Filing Jointly
const EITC_INCOME_LIMITS_SINGLE: Record<number, number> = {
  0: 18591,
  1: 49084,
  2: 55768,
  3: 59899,
}
const EITC_INCOME_LIMITS_MFJ: Record<number, number> = {
  0: 25511,
  1: 56004,
  2: 62688,
  3: 66819,
}

// MA EITC = 40% of federal credit (refundable)
const MA_EITC_RATE = 0.40

function countQualifyingChildren(profile: FamilyProfile): number {
  return profile.householdMembers.filter(
    (m) =>
      (m.relationship === 'child' || m.relationship === 'stepchild' || m.relationship === 'grandchild') &&
      m.age < 19 &&
      m.isTaxDependent
  ).length
}

function estimateFederalEITC(
  annualEarnedIncome: number,
  qualifyingChildren: number,
  isMarriedFilingJointly: boolean
): number {
  const childKey = Math.min(qualifyingChildren, 3) as 0 | 1 | 2 | 3
  const incomeLimit = isMarriedFilingJointly
    ? EITC_INCOME_LIMITS_MFJ[childKey]
    : EITC_INCOME_LIMITS_SINGLE[childKey]
  const maxCredit = EITC_MAX_FEDERAL[childKey]

  if (!incomeLimit || !maxCredit) return 0
  if (annualEarnedIncome <= 0 || annualEarnedIncome > incomeLimit) return 0

  // Simplified phase-in / phase-out estimate
  // Actual calculation is complex — this gives a reasonable estimate
  const phaseinRate = qualifyingChildren === 0 ? 0.0765 : qualifyingChildren === 1 ? 0.34 : qualifyingChildren === 2 ? 0.40 : 0.45
  const phaseoutStart = isMarriedFilingJointly
    ? (qualifyingChildren === 0 ? 16810 : qualifyingChildren === 1 ? 24884 : 25144)
    : (qualifyingChildren === 0 ? 9880 : qualifyingChildren === 1 ? 21430 : 21430)

  if (annualEarnedIncome <= phaseoutStart) {
    return Math.min(maxCredit, Math.round(annualEarnedIncome * phaseinRate))
  }

  // Phase-out: credit decreases
  const phaseoutRate = qualifyingChildren === 0 ? 0.0765 : qualifyingChildren <= 2 ? 0.16 : 0.21
  const excess = annualEarnedIncome - phaseoutStart
  return Math.max(0, Math.round(Math.min(maxCredit, annualEarnedIncome * phaseinRate) - excess * phaseoutRate))
}

export function evaluateEITC(profile: FamilyProfile, _fplPercent: number): BenefitResult | null {
  if (!profile.stateResident) return null

  // Must be US citizen or resident alien with valid SSN
  if (profile.citizenshipStatus === 'undocumented') return null
  if (!profile.taxFiler) return null

  // Must have earned income
  const monthlyEarnedIncome = computeEarnedIncome(profile)
  const annualEarnedIncome = monthlyEarnedIncome * 12

  if (annualEarnedIncome <= 0) return null

  // Age check: must be 25–64 if no qualifying children
  const qualifyingChildren = countQualifyingChildren(profile)
  if (qualifyingChildren === 0 && (profile.age < 25 || profile.age >= 65)) return null

  const isMFJ = profile.filingStatus === 'married_filing_jointly'
  const childKey = Math.min(qualifyingChildren, 3) as 0 | 1 | 2 | 3
  const incomeLimit = isMFJ ? EITC_INCOME_LIMITS_MFJ[childKey] : EITC_INCOME_LIMITS_SINGLE[childKey]

  if (!incomeLimit || annualEarnedIncome > incomeLimit) return null

  const federalEITC = estimateFederalEITC(annualEarnedIncome, qualifyingChildren, isMFJ)
  if (federalEITC <= 0) return null

  const maEITC = Math.round(federalEITC * MA_EITC_RATE)
  const totalAnnual = federalEITC + maEITC
  const totalMonthly = Math.round(totalAnnual / 12)

  const confidence = annualEarnedIncome < incomeLimit * 0.8 ? 82 : 65
  const eligibilityStatus = annualEarnedIncome < incomeLimit * 0.9 ? 'likely' : 'possibly'

  return {
    programId: 'eitc_federal',
    programName: 'Earned Income Tax Credit (EITC)',
    programShortName: 'EITC',
    category: 'tax_credit',
    administeredBy: 'IRS + MA DOR',
    eligibilityStatus,
    confidence,
    estimatedMonthlyValue: totalMonthly,
    estimatedAnnualValue: totalAnnual,
    valueNote: `~$${federalEITC.toLocaleString()} federal + $${maEITC.toLocaleString()} MA (40%) = $${totalAnnual.toLocaleString()} total tax credit`,
    score: 0,
    priority: 0,
    applicationMethods: ['online', 'in_person'],
    applicationUrl: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit',
    applicationNote: 'Claim on your federal tax return (Form 1040) and MA state return',
    processingTime: '3 weeks (e-file) or 6–8 weeks (mail)',
    keyRequirements: [
      'Must file a federal tax return',
      'Must have earned income (wages or self-employment)',
      qualifyingChildren > 0
        ? `${qualifyingChildren} qualifying child${qualifyingChildren > 1 ? 'ren' : ''} claimed as dependents`
        : 'Age 25–64 with no qualifying children',
      `Annual earned income ≤ $${incomeLimit.toLocaleString()}`,
    ],
    requiredDocuments: [
      'W-2 forms or 1099s for all income',
      'Social Security numbers for all family members',
      "Children's birth certificates (if claiming children)",
      'Prior year tax return',
    ],
    nextSteps: [
      'File your federal and MA state tax returns — claim EITC on Form 1040',
      'Use IRS Free File (free if income <$79,000) at irs.gov/freefile',
      'Get free tax prep help at VITA sites (Volunteer Income Tax Assistance): call 1-800-906-9887',
      `MA EITC is 40% of your federal credit (~$${maEITC.toLocaleString()}) — claim on MA Form 1`,
    ],
  }
}
