// Cross-Program Benefit Orchestration Engine
// Single intake → evaluate all MA safety-net programs → ranked benefit stack

import type { FamilyProfile, BenefitResult, BenefitStack, ApplicationBundle, BenefitProgramId } from './types'
import { getAnnualFPL, getIncomeAsFPLPercent, computeTotalMonthlyIncome, computeDerivedFields } from './fpl-utils'
import { evaluateMassHealth } from './programs/masshealth'
import { evaluateMSP } from './programs/msp'
import { evaluateSnap } from './programs/snap'
import { evaluateEITC } from './programs/eitc'
import { evaluateSection8 } from './programs/section8'
import { evaluateChildcare } from './programs/childcare'
import { evaluateLIHEAP } from './programs/liheap'
import { evaluateWIC } from './programs/wic'
import { evaluateTAFDC } from './programs/tafdc'
import { evaluateEAEDC } from './programs/eaedc'

// ── Scoring ──────────────────────────────────────────────────────────────────

function getUrgencyBonus(result: BenefitResult, profile: FamilyProfile): number {
  let bonus = 0
  if (profile.pregnant) bonus += 20
  if (profile.housingStatus === 'homeless' || profile.housingStatus === 'shelter') bonus += 15
  if (profile.disabled || profile.blind) bonus += 10
  if (profile.childrenUnder5 > 0) bonus += 5
  // Healthcare always has some urgency
  if (result.category === 'healthcare') bonus += 5
  return Math.min(bonus, 20)
}

function getEaseBonus(result: BenefitResult): number {
  let bonus = 0
  if (result.applicationMethods.includes('online')) bonus += 7
  if (result.bundleWith && result.bundleWith.length > 0) bonus += 3
  return Math.min(bonus, 10)
}

function computeScore(result: BenefitResult, profile: FamilyProfile): number {
  const confidenceScore = (result.confidence / 100) * 40
  const valueScore = Math.min(result.estimatedAnnualValue / 1000, 1) * 30
  const urgencyScore = (getUrgencyBonus(result, profile) / 20) * 20
  const easeScore = (getEaseBonus(result) / 10) * 10
  return confidenceScore + valueScore + urgencyScore + easeScore
}

// ── Application Bundles ───────────────────────────────────────────────────────

function buildApplicationBundles(
  results: BenefitResult[],
  profile: FamilyProfile
): ApplicationBundle[] {
  const bundles: ApplicationBundle[] = []
  const programIds = new Set(results.map((r) => r.programId))

  // DTA Bundle: SNAP + TAFDC + EAEDC — one application at dta.mass.gov
  const dtaPrograms: BenefitProgramId[] = ['snap', 'tafdc', 'eaedc']
  const dtaPresent = dtaPrograms.filter((id) => programIds.has(id))
  if (dtaPresent.length >= 2) {
    const dtaResults = results.filter((r) => dtaPrograms.includes(r.programId))
    const totalValue = dtaResults.reduce((sum, r) => sum + r.estimatedMonthlyValue, 0)
    bundles.push({
      bundleId: 'dta_bundle',
      bundleName: 'DTA One-Stop Application',
      description:
        'Apply once for SNAP, TAFDC, and/or EAEDC through the MA Department of Transitional Assistance.',
      programIds: dtaPresent,
      sharedApplicationName: 'DTA Online Portal',
      applicationUrl: 'https://www.dta.mass.gov',
      applicationPhone: '1-877-382-2363',
      estimatedTime: '20–30 minutes online',
      totalEstimatedMonthlyValue: totalValue,
    })
  }

  // MassHealth Bundle: All MassHealth tracks + MSP — one application
  const masshealthIds: BenefitProgramId[] = [
    'masshealth_standard',
    'masshealth_careplus',
    'masshealth_family_assistance',
    'masshealth_limited',
    'masshealth_standard_pregnancy',
    'connector_care',
    'msp',
  ]
  const masshealthPresent = masshealthIds.filter((id) => programIds.has(id))
  if (masshealthPresent.length >= 2) {
    const mhResults = results.filter((r) => masshealthIds.includes(r.programId))
    const totalValue = mhResults.reduce((sum, r) => sum + r.estimatedMonthlyValue, 0)
    bundles.push({
      bundleId: 'masshealth_bundle',
      bundleName: 'MassHealth Application Bundle',
      description:
        'A single MassHealth application covers all coverage tracks and the Medicare Savings Program.',
      programIds: masshealthPresent,
      sharedApplicationName: 'MassHealth Application',
      applicationUrl: '/application/new',
      applicationPhone: '1-800-841-2900',
      estimatedTime: '30–45 minutes',
      totalEstimatedMonthlyValue: totalValue,
    })
  }

  // WIC + Pregnancy Bundle
  if (programIds.has('wic') && programIds.has('masshealth_standard_pregnancy') && profile.pregnant) {
    const wicResult = results.find((r) => r.programId === 'wic')
    const mhPregnancyResult = results.find((r) => r.programId === 'masshealth_standard_pregnancy')
    const totalValue = (wicResult?.estimatedMonthlyValue ?? 0) + (mhPregnancyResult?.estimatedMonthlyValue ?? 0)
    bundles.push({
      bundleId: 'pregnancy_bundle',
      bundleName: 'Pregnancy Support Bundle',
      description:
        'Apply for MassHealth pregnancy coverage and WIC together — many WIC clinics help with both applications.',
      programIds: ['wic', 'masshealth_standard_pregnancy'],
      sharedApplicationName: 'WIC Clinic + MassHealth',
      applicationUrl: 'https://www.mass.gov/wic',
      applicationPhone: '1-800-942-1007',
      estimatedTime: '1–2 hours at your local WIC clinic',
      totalEstimatedMonthlyValue: totalValue,
    })
  }

  return bundles
}

// ── Summary ───────────────────────────────────────────────────────────────────

function buildSummary(results: BenefitResult[], totalMonthlyValue: number): string {
  const likelyCount = results.filter((r) => r.eligibilityStatus === 'likely').length
  const possiblyCount = results.filter((r) => r.eligibilityStatus === 'possibly').length

  if (likelyCount === 0 && possiblyCount === 0) {
    return 'Based on your information, we did not find programs you appear to qualify for at this time. A full application may reveal additional options.'
  }

  const parts: string[] = []
  if (likelyCount > 0) {
    parts.push(`${likelyCount} program${likelyCount > 1 ? 's' : ''} you likely qualify for`)
  }
  if (possiblyCount > 0) {
    parts.push(`${possiblyCount} additional program${possiblyCount > 1 ? 's' : ''} to explore`)
  }

  const valueStr = totalMonthlyValue > 0
    ? ` — potentially $${Math.round(totalMonthlyValue).toLocaleString()}/month in benefits`
    : ''

  return `We found ${parts.join(' and ')}${valueStr}. These are estimates based on your answers; official eligibility is determined by each program at time of application.`
}

// ── Main Orchestrator ─────────────────────────────────────────────────────────

/**
 * Run all MA safety-net program evaluators against a family profile and return
 * a ranked, personalized benefit stack with application guidance.
 */
export function evaluateBenefitStack(rawProfile: Omit<FamilyProfile, 'householdSize' | 'childrenUnder5' | 'childrenUnder13' | 'childrenUnder18' | 'childrenUnder19'> & Partial<Pick<FamilyProfile, 'householdSize' | 'childrenUnder5' | 'childrenUnder13' | 'childrenUnder18' | 'childrenUnder19'>>): BenefitStack {
  // Compute derived fields
  const derived = computeDerivedFields(rawProfile)
  const profile: FamilyProfile = { ...rawProfile, ...derived }

  // Compute income and FPL
  const totalMonthlyIncome = computeTotalMonthlyIncome(profile)
  const annualIncome = totalMonthlyIncome * 12
  const annualFPL = getAnnualFPL(profile.householdSize)
  const fplPercent = getIncomeAsFPLPercent(annualIncome, profile.householdSize)

  // Run all evaluators
  const masshealthResults = evaluateMassHealth(profile, fplPercent)
  const mspResult = evaluateMSP(profile, fplPercent)
  const snapResult = evaluateSnap(profile, fplPercent)
  const eitcResult = evaluateEITC(profile, fplPercent)
  const section8Result = evaluateSection8(profile, fplPercent)
  const childcareResult = evaluateChildcare(profile, fplPercent)
  const liheapResult = evaluateLIHEAP(profile, fplPercent)
  const wicResult = evaluateWIC(profile, fplPercent)
  const tafdcResult = evaluateTAFDC(profile, fplPercent)
  const aeadcResult = evaluateEAEDC(profile, fplPercent)

  const allResults: BenefitResult[] = [
    ...masshealthResults,
    mspResult,
    snapResult,
    eitcResult,
    section8Result,
    childcareResult,
    liheapResult,
    wicResult,
    tafdcResult,
    aeadcResult,
  ].filter((r): r is BenefitResult => r !== null && r.eligibilityStatus !== 'ineligible')

  // Score and rank
  const scored = allResults.map((r) => ({
    ...r,
    score: computeScore(r, profile),
  }))
  const ranked = scored
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, priority: i + 1 }))

  // Build bundles
  const bundles = buildApplicationBundles(ranked, profile)

  // Filtered views
  const likelyPrograms = ranked.filter((r) => r.eligibilityStatus === 'likely')
  const possiblePrograms = ranked.filter((r) => r.eligibilityStatus === 'possibly')
  const quickWins = likelyPrograms.slice(0, 3)

  // Total estimated value (likely programs only to avoid over-promising)
  const totalEstimatedMonthlyValue = likelyPrograms.reduce(
    (sum, r) => sum + r.estimatedMonthlyValue,
    0
  )

  return {
    generatedAt: new Date().toISOString(),
    fplPercent,
    annualFPL,
    totalMonthlyIncome,
    householdSize: profile.householdSize,
    results: ranked,
    likelyPrograms,
    possiblePrograms,
    quickWins,
    totalEstimatedMonthlyValue,
    totalEstimatedAnnualValue: totalEstimatedMonthlyValue * 12,
    bundles,
    summary: buildSummary(ranked, totalEstimatedMonthlyValue),
  }
}
