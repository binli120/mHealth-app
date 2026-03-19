/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

// WIC (Women, Infants, Children) evaluator
// USDA program administered by MA DPH
// https://www.mass.gov/wic
import type { FamilyProfile, BenefitResult } from '../types'
import { getAnnualFPL } from '../fpl-utils'

// WIC income limit: 185% FPL
const WIC_FPL_THRESHOLD = 185

// Monthly food package values (approximate 2025)
// Pregnant: ~$80/month
// Breastfeeding: ~$80/month
// Postpartum (non-breastfeeding, up to 6 months): ~$50/month
// Infant: ~$50/month
// Child 1–5 years: ~$50/month

function estimateWICValue(profile: FamilyProfile): { monthly: number; note: string } {
  let monthly = 0
  const parts: string[] = []

  // Primary applicant — pregnant
  if (profile.pregnant) {
    monthly += 80
    parts.push('pregnant woman ($80)')
  }

  // Count WIC-eligible members in household
  const infants = profile.householdMembers.filter((m) => m.age < 1)
  const childrenUnder5 = profile.householdMembers.filter((m) => m.age >= 1 && m.age < 5)
  const breastfeedingMoms = profile.householdMembers.filter(
    (m) =>
      m.relationship === 'spouse' ||
      m.relationship === 'partner' ||
      m.relationship === 'other_relative'
  ).filter((_) => false) // simplification — breastfeeding status not captured per member

  // Primary applicant could also be postpartum (within 6 months of delivery) — not tracked precisely
  if (profile.age >= 18 && profile.age <= 45 && !profile.pregnant) {
    // Assume possibly postpartum or breastfeeding if she has infants
    if (infants.length > 0) {
      monthly += 80
      parts.push('breastfeeding/postpartum woman ($80)')
    }
  }

  infants.forEach(() => {
    monthly += 50
    parts.push('infant')
  })

  childrenUnder5.forEach(() => {
    monthly += 50
  })
  if (childrenUnder5.length > 0) {
    parts.push(`${childrenUnder5.length} child${childrenUnder5.length > 1 ? 'ren' : ''} 1-4yr ($${childrenUnder5.length * 50})`)
  }

  if (monthly === 0) return { monthly: 0, note: '' }
  return {
    monthly,
    note: `~$${monthly}/month for ${parts.join(', ')}`,
  }
}

export function evaluateWIC(profile: FamilyProfile, fplPercent: number): BenefitResult | null {
  if (!profile.stateResident) return null

  // WIC eligibility: pregnant, postpartum (up to 6mo), breastfeeding (up to 1yr), infants <1yr, children <5yr
  const primaryEligible = profile.pregnant || profile.age < 5 || profile.age < 45 // broad check for primary
  const hasEligibleChild = profile.childrenUnder5 > 0 || profile.householdMembers.some((m) => m.age < 1)
  const hasEligibleMember = profile.pregnant || hasEligibleChild

  if (!hasEligibleMember) return null

  // Citizenship: WIC serves citizens, qualified immigrants, and in some cases undocumented for infants/children
  // (WIC is less strict on immigration than SNAP/MassHealth)

  if (fplPercent > WIC_FPL_THRESHOLD) return null

  const annualFPL = getAnnualFPL(profile.householdSize)
  const { monthly, note } = estimateWICValue(profile)
  if (monthly === 0) return null

  const isVeryLowIncome = fplPercent <= 100
  const confidence = isVeryLowIncome ? 88 : 75

  return {
    programId: 'wic',
    programName: 'WIC (Women, Infants & Children)',
    programShortName: 'WIC',
    category: 'food',
    administeredBy: 'MA DPH',
    eligibilityStatus: fplPercent <= 150 ? 'likely' : 'possibly',
    confidence,
    estimatedMonthlyValue: monthly,
    estimatedAnnualValue: monthly * 12,
    valueNote: note,
    score: 0,
    priority: 0,
    applicationMethods: ['phone', 'in_person'],
    applicationUrl: 'https://www.mass.gov/wic',
    applicationPhone: '1-800-942-1007',
    applicationNote:
      'WIC is available at local health centers and WIC sites — find yours at mass.gov/wic',
    processingTime: '1–2 weeks',
    keyRequirements: [
      'MA resident',
      `Income ≤185% FPL (~$${Math.round(annualFPL * 1.85).toLocaleString()}/yr)`,
      'Pregnant, postpartum, or breastfeeding woman, OR infant under 1 year, OR child under 5',
      'At nutritional risk (determined at WIC screening — most qualify)',
    ],
    requiredDocuments: [
      'Photo ID',
      'Proof of MA residency',
      'Proof of income (or proof of enrollment in MassHealth/SNAP — automatic income eligibility)',
      'Proof of pregnancy or birth certificate for children',
    ],
    nextSteps: [
      'Call 1-800-WIC-1007 to find your nearest WIC clinic and schedule an appointment',
      'If you receive MassHealth or SNAP, you automatically meet WIC income requirements',
      'WIC provides healthy food vouchers/EBT, breastfeeding support, nutrition counseling, and referrals',
      profile.pregnant ? 'Apply now — WIC benefits start during pregnancy and continue through postpartum' : '',
    ].filter(Boolean),
  }
}
