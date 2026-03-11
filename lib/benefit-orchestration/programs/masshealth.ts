// MassHealth evaluator — covers all tracks based on age, income, and circumstances
import type { FamilyProfile, BenefitResult } from '../types'
import { getAnnualFPL, computeMAGIMonthly } from '../fpl-utils'

const COMMON_DOCS = ['Photo ID or birth certificate', 'Proof of MA residency', 'Social Security card or number']
const INCOME_DOCS = ['Recent pay stubs (last 4 weeks)', 'Most recent federal tax return']
const IMMIGRATION_DOCS = ['Immigration documents (green card, visa, I-94, etc.)']

export function evaluateMassHealth(profile: FamilyProfile, fplPercent: number): BenefitResult[] {
  if (!profile.stateResident) return []

  const results: BenefitResult[] = []
  const isQualified =
    profile.citizenshipStatus === 'citizen' || profile.citizenshipStatus === 'qualified_immigrant'
  const isUndocumented = profile.citizenshipStatus === 'undocumented'
  const annualFPL = getAnnualFPL(profile.householdSize)
  const magiMonthly = computeMAGIMonthly(profile)
  const magiAnnual = magiMonthly * 12
  const magiAsFPL = Math.round((magiAnnual / annualFPL) * 100)

  const baseRequiredDocs = [
    ...COMMON_DOCS,
    ...INCOME_DOCS,
    ...(isQualified && profile.citizenshipStatus !== 'citizen' ? IMMIGRATION_DOCS : []),
  ]

  const applyInfo: Pick<BenefitResult, 'applicationMethods' | 'applicationUrl' | 'applicationPhone' | 'processingTime' | 'bundleWith' | 'bundleNote'> = {
    applicationMethods: ['online', 'phone', 'in_person', 'mail'],
    applicationUrl: '/application/new',
    applicationPhone: '1-800-841-2900',
    processingTime: '45 days (10 days if urgent)',
    bundleWith: ['msp'],
    bundleNote: 'MassHealth and Medicare Savings Program share one application.',
  }

  // ── Undocumented — MassHealth Limited ──────────────────────────────────────
  if (isUndocumented) {
    results.push({
      programId: 'masshealth_limited',
      programName: 'MassHealth Limited',
      programShortName: 'MH Limited',
      category: 'healthcare',
      administeredBy: 'MA MassHealth',
      eligibilityStatus: 'likely',
      confidence: 85,
      estimatedMonthlyValue: 300,
      estimatedAnnualValue: 3600,
      valueNote: 'Emergency & essential services coverage (~$300/month value)',
      score: 0,
      priority: 0,
      keyRequirements: ['MA resident', 'Emergency medical need or pregnancy'],
      requiredDocuments: [...COMMON_DOCS],
      nextSteps: [
        'Apply at a local MassHealth Enrollment Center or call 1-800-841-2900',
        'Bring proof of MA residency and identity',
      ],
      ...applyInfo,
    })

    if (profile.pregnant) {
      results.push({
        programId: 'masshealth_standard_pregnancy',
        programName: 'MassHealth Standard – Pregnancy',
        programShortName: 'MH Pregnancy',
        category: 'healthcare',
        administeredBy: 'MA MassHealth',
        eligibilityStatus: 'likely',
        confidence: 90,
        estimatedMonthlyValue: 800,
        estimatedAnnualValue: 16800, // 21 months (pregnancy + 12mo postpartum)
        valueNote: 'Full prenatal, delivery & 12-month postpartum coverage',
        score: 0,
        priority: 0,
        keyRequirements: ['MA resident', 'Pregnant or recently postpartum'],
        requiredDocuments: [...COMMON_DOCS, 'Proof of pregnancy (letter from OB/midwife)'],
        nextSteps: [
          'Apply immediately — coverage is retroactive to pregnancy date',
          'Postpartum coverage continues 12 months after delivery',
        ],
        ...applyInfo,
      })
    }
    return results
  }

  // ── Pregnancy (qualified status, ≤200% FPL) ──────────────────────────────
  if (profile.pregnant && isQualified && magiAsFPL <= 200) {
    results.push({
      programId: 'masshealth_standard_pregnancy',
      programName: 'MassHealth Standard – Pregnancy',
      programShortName: 'MH Pregnancy',
      category: 'healthcare',
      administeredBy: 'MA MassHealth',
      eligibilityStatus: 'likely',
      confidence: 90,
      estimatedMonthlyValue: 800,
      estimatedAnnualValue: 16800,
      valueNote: 'Full prenatal, delivery & 12-month postpartum at $0 cost',
      score: 0,
      priority: 0,
      keyRequirements: [
        'MA resident',
        `Income ≤200% FPL (~$${Math.round(annualFPL * 2).toLocaleString()}/yr)`,
        'Pregnant',
      ],
      requiredDocuments: [
        ...baseRequiredDocs,
        'Proof of pregnancy (physician letter or ultrasound)',
      ],
      nextSteps: [
        'Apply now — coverage is retroactive to first day of pregnancy month',
        'Includes all prenatal visits, delivery, and 12 months postpartum',
      ],
      ...applyInfo,
    })
  }

  // ── Children under 19 ───────────────────────────────────────────────────
  const childrenInHousehold = profile.householdMembers.filter(
    (m) => (m.relationship === 'child' || m.relationship === 'stepchild' || m.relationship === 'grandchild') && m.age < 19
  )

  if (childrenInHousehold.length > 0) {
    if (magiAsFPL <= 150) {
      results.push({
        programId: 'masshealth_standard',
        programName: 'MassHealth Standard (Children)',
        programShortName: 'MH Standard',
        category: 'healthcare',
        administeredBy: 'MA MassHealth',
        eligibilityStatus: 'likely',
        confidence: 88,
        estimatedMonthlyValue: 400 * childrenInHousehold.length,
        estimatedAnnualValue: 4800 * childrenInHousehold.length,
        valueNote: `Full Medicaid for ${childrenInHousehold.length} child${childrenInHousehold.length > 1 ? 'ren' : ''}, $0 premiums`,
        score: 0,
        priority: 0,
        keyRequirements: [
          'MA resident',
          'Child under 19',
          `Income ≤150% FPL (~$${Math.round(annualFPL * 1.5).toLocaleString()}/yr)`,
        ],
        requiredDocuments: [...baseRequiredDocs, "Children's birth certificates"],
        nextSteps: [
          'Apply at mahealthconnector.org or call MassHealth',
          'Children enrolled within 45 days; sooner if urgent need',
        ],
        ...applyInfo,
      })
    } else if (magiAsFPL <= 300) {
      results.push({
        programId: 'masshealth_family_assistance',
        programName: 'MassHealth Family Assistance (CHIP)',
        programShortName: 'MH Family Asst.',
        category: 'healthcare',
        administeredBy: 'MA MassHealth',
        eligibilityStatus: 'likely',
        confidence: 80,
        estimatedMonthlyValue: 200 * childrenInHousehold.length,
        estimatedAnnualValue: 2400 * childrenInHousehold.length,
        valueNote: `Low-cost CHIP coverage for ${childrenInHousehold.length} child${childrenInHousehold.length > 1 ? 'ren' : ''} (small monthly premium)`,
        score: 0,
        priority: 0,
        keyRequirements: [
          'MA resident',
          'Child under 19',
          `Income 150–300% FPL (~$${Math.round(annualFPL * 1.5).toLocaleString()}–$${Math.round(annualFPL * 3).toLocaleString()}/yr)`,
        ],
        requiredDocuments: [...baseRequiredDocs, "Children's birth certificates"],
        nextSteps: [
          'Apply at mahealthconnector.org — comprehensive pediatric coverage',
          'Small monthly premiums based on income',
        ],
        ...applyInfo,
      })
    }
  }

  // ── Adults 19–64 ────────────────────────────────────────────────────────
  if (profile.age >= 19 && profile.age <= 64 && isQualified) {
    if (profile.disabled && magiAsFPL <= 133) {
      results.push({
        programId: 'masshealth_standard',
        programName: 'MassHealth Standard',
        programShortName: 'MH Standard',
        category: 'healthcare',
        administeredBy: 'MA MassHealth',
        eligibilityStatus: 'likely',
        confidence: 85,
        estimatedMonthlyValue: 600,
        estimatedAnnualValue: 7200,
        valueNote: 'Full Medicaid coverage including dental, vision, long-term care',
        score: 0,
        priority: 0,
        keyRequirements: [
          'MA resident',
          'Documented disability or SSI/SSDI recipient',
          `Income ≤133% FPL (~$${Math.round(annualFPL * 1.33).toLocaleString()}/yr)`,
        ],
        requiredDocuments: [
          ...baseRequiredDocs,
          'Disability documentation (SSI/SSDI award letter or physician statement)',
        ],
        nextSteps: [
          'Apply through MassHealth — fastest path is online at mahealthconnector.org',
          'SSI recipients are automatically eligible',
        ],
        ...applyInfo,
      })
    } else if (!profile.hasMedicare && magiAsFPL <= 138) {
      results.push({
        programId: 'masshealth_careplus',
        programName: 'MassHealth CarePlus',
        programShortName: 'MH CarePlus',
        category: 'healthcare',
        administeredBy: 'MA MassHealth',
        eligibilityStatus: 'likely',
        confidence: 88,
        estimatedMonthlyValue: 500,
        estimatedAnnualValue: 6000,
        valueNote: `Free Medicaid for adults 19–64 at ${magiAsFPL}% FPL — $0 premiums`,
        score: 0,
        priority: 0,
        keyRequirements: [
          'MA resident',
          'Age 19–64',
          `Income ≤138% FPL (~$${Math.round(annualFPL * 1.38).toLocaleString()}/yr)`,
          'Not enrolled in Medicare',
        ],
        requiredDocuments: baseRequiredDocs,
        nextSteps: [
          'Apply online at mahealthconnector.org (fastest)',
          'Covers medical, dental, behavioral health, substance use services',
        ],
        ...applyInfo,
      })
    } else if (!profile.hasMedicare && magiAsFPL > 138 && magiAsFPL <= 300) {
      results.push({
        programId: 'connector_care',
        programName: 'ConnectorCare',
        programShortName: 'ConnectorCare',
        category: 'healthcare',
        administeredBy: 'MA Health Connector',
        eligibilityStatus: 'likely',
        confidence: 82,
        estimatedMonthlyValue: 250,
        estimatedAnnualValue: 3000,
        valueNote: `Subsidized plans with capped premiums at ${magiAsFPL}% FPL`,
        score: 0,
        priority: 0,
        keyRequirements: [
          'MA resident',
          'Age 19–64',
          `Income 138–300% FPL (~$${Math.round(annualFPL * 1.38).toLocaleString()}–$${Math.round(annualFPL * 3).toLocaleString()}/yr)`,
        ],
        requiredDocuments: baseRequiredDocs,
        nextSteps: [
          'Shop plans at mahealthconnector.org during open enrollment',
          'Premiums capped as % of income; reduced copays',
        ],
        applicationMethods: ['online'],
        applicationUrl: 'https://www.mahealthconnector.org',
        processingTime: '2–4 weeks',
      })
    } else if (!profile.hasMedicare && magiAsFPL > 300 && magiAsFPL <= 500) {
      results.push({
        programId: 'health_connector_credits',
        programName: 'Health Connector with Tax Credits',
        programShortName: 'Connector Credits',
        category: 'healthcare',
        administeredBy: 'MA Health Connector / IRS',
        eligibilityStatus: 'possibly',
        confidence: 65,
        estimatedMonthlyValue: 150,
        estimatedAnnualValue: 1800,
        valueNote: `Federal premium tax credits possible at ${magiAsFPL}% FPL`,
        score: 0,
        priority: 0,
        keyRequirements: [
          'MA resident',
          `Income 300–500% FPL`,
          'No affordable employer coverage',
        ],
        requiredDocuments: baseRequiredDocs,
        nextSteps: [
          'Compare plans at mahealthconnector.org',
          'Apply for APTCs during open enrollment or qualifying life event',
        ],
        applicationMethods: ['online'],
        applicationUrl: 'https://www.mahealthconnector.org',
        processingTime: '2–4 weeks',
      })
    }
  }

  // ── Seniors 65+ ─────────────────────────────────────────────────────────
  if (profile.age >= 65 && isQualified) {
    if (profile.hasMedicare && magiAsFPL <= 100) {
      results.push({
        programId: 'masshealth_standard',
        programName: 'MassHealth Standard (Dual Eligible)',
        programShortName: 'MH Standard',
        category: 'healthcare',
        administeredBy: 'MA MassHealth',
        eligibilityStatus: 'likely',
        confidence: 87,
        estimatedMonthlyValue: 700,
        estimatedAnnualValue: 8400,
        valueNote: 'MassHealth covers all Medicare cost-sharing + dental, vision, long-term care',
        score: 0,
        priority: 0,
        keyRequirements: [
          'MA resident',
          'Age 65+',
          `Income ≤100% FPL (~$${annualFPL.toLocaleString()}/yr)`,
          'Enrolled in Medicare',
        ],
        requiredDocuments: [...baseRequiredDocs, 'Medicare card', 'Medicare Summary Notice'],
        nextSteps: [
          'Apply through MassHealth — as a dual eligible you get comprehensive coverage',
          'MassHealth acts as secondary insurer, paying what Medicare does not',
        ],
        ...applyInfo,
      })
    }
  }

  return results
}
