/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { BenefitResult, FamilyProfile } from '../types'

const HSN_COMMON_REQUIREMENTS = [
  'Massachusetts resident',
  'Services must be from a Massachusetts acute hospital or community health center',
  'Health Safety Net is payer of last resort',
]

const HSN_COMMON_DOCS = [
  'Photo ID',
  'Proof of MA residency',
  'Recent income statements',
  'Information about current or available health insurance',
]

const HSN_LOW_INCOME_APPLICATION_INFO: Pick<
  BenefitResult,
  'applicationMethods' | 'applicationUrl' | 'applicationPhone' | 'applicationNote' | 'processingTime'
> = {
  applicationMethods: ['online', 'phone', 'in_person', 'mail'],
  applicationUrl: '/application/type?recommended=hsn',
  applicationPhone: '1-800-841-2900',
  applicationNote:
    'Low Income Patient determinations use the ACA-3 health coverage application; this starts the Health Safety Net online path.',
  processingTime: 'Varies by application completeness',
}

function hasKnownLowIncomePatientBlocker(profile: FamilyProfile): boolean {
  const context = profile.healthSafetyNet
  return Boolean(
    context?.massHealthEligibleButNotEnrolled ||
      context?.premiumAssistanceTerminatedForNonpayment ||
      context?.healthConnectorPremiumAssistanceEligible ||
      context?.studentHealthProgramRequired
  )
}

function hasPrimaryInsurance(profile: FamilyProfile): boolean {
  return profile.hasPrivateInsurance || profile.hasEmployerInsurance || profile.hasMedicare
}

function hasMedicalHardshipFacts(profile: FamilyProfile): boolean {
  const context = profile.healthSafetyNet
  return Boolean(
    context?.hasRecentMedicalBills ||
      context?.hasUnpaidMedicalBills ||
      (context?.totalAllowableMedicalBillsLast12Months ?? 0) > 0
  )
}

function deductibleRequirements(fplPercent: number): string[] {
  if (fplPercent <= 150) return []
  return [
    'Health Safety Net - Partial may apply because household income is above 150% FPL',
    'A deductible may apply before HSN pays eligible services',
  ]
}

function lowIncomeNextSteps(fplPercent: number): string[] {
  const steps = [
    'Complete the MassHealth health and dental coverage application online, by phone, by mail, by fax, or with an enrollment assister',
    'Ask the hospital or community health center financial counseling office whether your visit can be billed to Health Safety Net',
  ]

  if (fplPercent > 150) {
    steps.push('Ask the provider financial counseling office how any HSN Partial deductible would apply')
  }

  return steps
}

export function evaluateHealthSafetyNet(
  profile: FamilyProfile,
  fplPercent: number
): BenefitResult[] {
  if (!profile.stateResident) return []

  const results: BenefitResult[] = []
  const eligibleForLowIncomePatient = fplPercent <= 300 && !hasKnownLowIncomePatientBlocker(profile)

  if (eligibleForLowIncomePatient) {
    const insured = hasPrimaryInsurance(profile)
    results.push({
      programId: insured ? 'health_safety_net_secondary' : 'health_safety_net_primary',
      programName: insured ? 'Health Safety Net - Secondary' : 'Health Safety Net - Primary',
      programShortName: insured ? 'HSN Secondary' : 'HSN Primary',
      category: 'healthcare',
      administeredBy: 'MA Health Safety Net',
      eligibilityStatus: 'likely',
      confidence: insured ? 74 : 78,
      estimatedMonthlyValue: 0,
      estimatedAnnualValue: 0,
      valueNote: insured
        ? 'May help with eligible costs at HSN providers after primary insurance or other responsible payers are considered.'
        : 'May reduce eligible bills at Massachusetts acute hospitals and community health centers; exact value depends on service, provider, and any deductible.',
      score: 0,
      priority: 0,
      keyRequirements: [
        ...HSN_COMMON_REQUIREMENTS,
        'Household income at or below 300% FPL',
        ...(insured ? ['Has primary insurance; HSN may act as secondary assistance'] : ['No primary health insurance']),
        ...deductibleRequirements(fplPercent),
      ],
      requiredDocuments: HSN_COMMON_DOCS,
      nextSteps: lowIncomeNextSteps(fplPercent),
      bundleWith: ['masshealth_standard', 'masshealth_careplus', 'connector_care'],
      bundleNote:
        'The same health coverage application can determine MassHealth, ConnectorCare, and HSN Low Income Patient status.',
      ...HSN_LOW_INCOME_APPLICATION_INFO,
    })
  } else if (hasMedicalHardshipFacts(profile)) {
    results.push({
      programId: 'health_safety_net_medical_hardship',
      programName: 'Health Safety Net Medical Hardship',
      programShortName: 'HSN Hardship',
      category: 'healthcare',
      administeredBy: 'MA Health Safety Net',
      eligibilityStatus: 'possibly',
      confidence: 58,
      estimatedMonthlyValue: 0,
      estimatedAnnualValue: 0,
      valueNote:
        'Possible one-time assistance for eligible medical bills when allowable medical expenses exceed the required share of countable income.',
      score: 0,
      priority: 0,
      applicationMethods: ['in_person', 'phone'],
      applicationPhone: '1-877-910-2100',
      applicationNote:
        'Patients do not submit Medical Hardship applications directly; an HSN provider financial counselor or authorized representative starts the provider-side application.',
      processingTime: 'Varies by provider submission and documentation completeness',
      keyRequirements: [
        ...HSN_COMMON_REQUIREMENTS,
        'Allowable medical expenses must exceed the required percentage of countable income',
        'Application is provider-assisted and is not an ongoing eligibility category',
      ],
      requiredDocuments: [
        ...HSN_COMMON_DOCS,
        'Detailed itemized medical bills from the applicable period',
        'Proof of paid or unpaid allowable medical expenses',
      ],
      nextSteps: [
        'Contact the hospital or community health center financial counseling office',
        'Gather detailed, itemized bills and income documentation',
        `If income is below 405% FPL, complete MassHealth and other public-assistance determinations before HSN finalizes Medical Hardship`,
      ],
    })
  }

  return results
}
