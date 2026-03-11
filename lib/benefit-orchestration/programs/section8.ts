// Section 8 / Housing Choice Voucher (HCV) evaluator
// Administered by local MA Housing Authorities under HUD
import type { FamilyProfile, BenefitResult } from '../types'

// Boston-Cambridge-Newton MA-NH HUD Metro FMR Area 2025
// Area Median Income (AMI) 4-person: ~$141,300
// 50% AMI limits (income eligibility):
const HCV_50_PCT_AMI: Record<number, number> = {
  1: 70700,
  2: 80800,
  3: 90900,
  4: 100950, // 50% of ~$141,300 rounded to HUD limits
  5: 109050,
  6: 117100,
  7: 125200,
  8: 133300,
}
// 30% AMI (very low income — priority for housing):
const HCV_30_PCT_AMI: Record<number, number> = {
  1: 42450,
  2: 48500,
  3: 54550,
  4: 60600,
  5: 65450,
  6: 70300,
  7: 75150,
  8: 80000,
}

// Boston Fair Market Rents 2025 (HUD FMR — used to estimate voucher value)
const BOSTON_FMR: Record<number, number> = {
  0: 1942, // studio
  1: 2290, // 1BR
  2: 2787, // 2BR
  3: 3510, // 3BR
  4: 4018, // 4BR
}

function getHCV50PctAMI(householdSize: number): number {
  const size = Math.min(householdSize, 8)
  return HCV_50_PCT_AMI[size] ?? HCV_50_PCT_AMI[8]
}

function getHCV30PctAMI(householdSize: number): number {
  const size = Math.min(householdSize, 8)
  return HCV_30_PCT_AMI[size] ?? HCV_30_PCT_AMI[8]
}

function estimateVoucherValue(annualIncome: number, householdSize: number): number {
  // Bedroom size: rough approximation (1BR per 2 household members)
  const bedrooms = Math.min(4, Math.max(0, Math.ceil(householdSize / 2)))
  const fmr = BOSTON_FMR[bedrooms] ?? BOSTON_FMR[2]
  // Participant pays 30% of income; voucher covers the rest up to FMR
  const tenantShare = Math.round((annualIncome / 12) * 0.30)
  return Math.max(0, fmr - tenantShare)
}

export function evaluateSection8(profile: FamilyProfile, _fplPercent: number): BenefitResult | null {
  if (!profile.stateResident) return null

  // Must be US citizen or eligible immigrant
  if (profile.citizenshipStatus === 'undocumented') return null

  const annualIncome = profile.householdMembers.reduce((acc, m) => {
    const { wages, selfEmployment, unemployment, socialSecurity, ssi, pension, rental, interest, alimony, veterans, other } = m.income
    return acc + (wages + selfEmployment + unemployment + socialSecurity + ssi + pension + rental + interest + alimony + veterans + other) * 12
  }, 0) + Object.values({
    ...profile.income,
    childSupport: profile.income.childSupport,
  }).reduce((a, v) => a + (v as number), 0) * 12

  const incomeLimit50 = getHCV50PctAMI(profile.householdSize)
  const incomeLimit30 = getHCV30PctAMI(profile.householdSize)

  if (annualIncome > incomeLimit50) return null

  const voucherValue = estimateVoucherValue(annualIncome, profile.householdSize)
  const isVeryLowIncome = annualIncome <= incomeLimit30

  // Priority groups (get to front of waitlist)
  const isPriority =
    profile.housingStatus === 'homeless' ||
    profile.housingStatus === 'shelter' ||
    profile.disabled ||
    profile.over65

  return {
    programId: 'section8_hcv',
    programName: 'Section 8 Housing Choice Voucher',
    programShortName: 'Section 8',
    category: 'housing',
    administeredBy: 'Local MA Housing Authority / HUD',
    eligibilityStatus: isVeryLowIncome ? 'likely' : 'possibly',
    confidence: isVeryLowIncome ? 70 : 55,
    estimatedMonthlyValue: voucherValue,
    estimatedAnnualValue: voucherValue * 12,
    valueNote: `~$${voucherValue.toLocaleString()}/month housing subsidy (Boston area FMR basis)`,
    score: 0,
    priority: 0,
    waitlistWarning:
      'Most MA housing authority waitlists are currently closed or have 5–10 year wait times. Check your local Housing Authority for open waitlists and apply to multiple.',
    applicationMethods: ['online', 'in_person'],
    applicationUrl: 'https://www.mass.gov/how-to/apply-for-state-aided-public-housing',
    applicationNote:
      'Apply through your local Regional Housing Authority at mass.gov. Each HA runs its own waitlist.',
    processingTime: 'Varies widely — typically 1–10+ years on waitlist',
    keyRequirements: [
      'MA resident',
      `Annual income ≤50% Area Median Income ($${incomeLimit50.toLocaleString()} for household of ${profile.householdSize})`,
      'US citizen or eligible immigrant status',
      isPriority ? 'Priority status may apply (homeless, disabled, elderly)' : '',
    ].filter(Boolean),
    requiredDocuments: [
      'Photo ID for all adult household members',
      'Birth certificates for children',
      'Social Security cards',
      'Proof of income (pay stubs, benefit award letters)',
      'Proof of citizenship or immigration status',
    ],
    nextSteps: [
      'Visit mass.gov/hcd to find your regional housing authority',
      'Apply to ALL open housing authority waitlists in your area — they each have separate lists',
      'Check CommonwealthConnects and CHAMP (Common Housing Application for MA Programs)',
      isPriority ? 'As a priority applicant, mention your status when applying' : '',
      'While waiting, explore other rental assistance programs like RAFT (Residential Assistance for Families in Transition)',
    ].filter(Boolean),
  }
}
