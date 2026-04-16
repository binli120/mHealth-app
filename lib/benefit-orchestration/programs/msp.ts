/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

// Medicare Savings Program evaluator
import type { FamilyProfile, BenefitResult } from '../types'
import { getAnnualFPL } from '../fpl-utils'

// MSP 2026 FPL thresholds
// QMB (Qualified Medicare Beneficiary): ≤100% FPL — pays Part A/B premiums, deductibles, copays
// SLMB (Specified Low-Income): 100–120% FPL — pays Part B premium only
// QI (Qualifying Individual): 120–135% FPL — pays Part B premium only
const MSP_PART_B_PREMIUM_2026 = 185 // $/month Part B premium

export function evaluateMSP(profile: FamilyProfile, fplPercent: number): BenefitResult | null {
  if (!profile.stateResident) return null
  if (!profile.hasMedicare) return null

  const isQualified =
    profile.citizenshipStatus === 'citizen' || profile.citizenshipStatus === 'qualified_immigrant'
  if (!isQualified) return null

  const annualFPL = getAnnualFPL(profile.householdSize)

  if (fplPercent > 135) return null

  let mspLevel: string
  let estimatedMonthlyValue: number
  let confidence: number
  let details: string

  if (fplPercent <= 100) {
    mspLevel = 'QMB (Full MSP)'
    estimatedMonthlyValue = MSP_PART_B_PREMIUM_2026 + 200 // Part B + avg deductibles/copays
    confidence = 87
    details = `QMB pays your Medicare Part B premium (~$185/month), Part A deductible ($1,676), and most copays — saving $4,600+/year`
  } else if (fplPercent <= 120) {
    mspLevel = 'SLMB'
    estimatedMonthlyValue = MSP_PART_B_PREMIUM_2026
    confidence = 82
    details = `SLMB pays your Medicare Part B premium (~$185/month) — saving $2,220/year`
  } else {
    mspLevel = 'QI'
    estimatedMonthlyValue = MSP_PART_B_PREMIUM_2026
    confidence = 75
    details = `QI pays your Medicare Part B premium (~$185/month). QI slots are limited and allocated annually.`
  }

  return {
    programId: 'msp',
    programName: 'Medicare Savings Program',
    programShortName: 'MSP',
    category: 'healthcare',
    administeredBy: 'MA MassHealth',
    eligibilityStatus: fplPercent <= 120 ? 'likely' : 'possibly',
    confidence,
    estimatedMonthlyValue,
    estimatedAnnualValue: estimatedMonthlyValue * 12,
    valueNote: `${mspLevel} at ${fplPercent}% FPL — ${details}`,
    score: 0,
    priority: 0,
    applicationMethods: ['online', 'phone', 'in_person', 'mail'],
    applicationUrl: '/application/new',
    applicationPhone: '1-800-841-2900',
    processingTime: '45 days',
    keyRequirements: [
      'MA resident',
      'Enrolled in Medicare Part A',
      `Income ≤135% FPL (~$${Math.round(annualFPL * 1.35).toLocaleString()}/yr)`,
    ],
    requiredDocuments: [
      'Medicare card',
      'Photo ID',
      'Proof of MA residency',
      'Recent income statements',
      'Social Security award letter (if applicable)',
    ],
    bundleWith: ['masshealth_standard', 'masshealth_careplus'],
    bundleNote: 'MSP and MassHealth use the same application — apply once.',
    nextSteps: [
      'Apply through MassHealth at mahealthconnector.org or call 1-800-841-2900',
      'MSP enrollment also automatically qualifies you for Extra Help with Medicare Part D (drug costs)',
    ],
  }
}
