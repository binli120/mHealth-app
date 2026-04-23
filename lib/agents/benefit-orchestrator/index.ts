/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Benefit Orchestrator — coordinates all 7 specialist agents and returns a
 * complete, ranked AgentBenefitStack for a household.
 *
 * All specialists run in parallel via Promise.all() so total latency is
 * bounded by the slowest single agent, not the sum of all agents.
 *
 * Specialist agents (each LLM-backed with deterministic fallback):
 *   1. MassHealth      — Standard, CarePlus, Limited, CHIP, Pregnancy, ConnectorCare, MSP
 *   2. Food & Nutrition — SNAP, WIC
 *   3. Cash Assistance  — TAFDC, EAEDC
 *   4. Tax Credits      — EITC (federal + MA)
 *   5. Housing          — Section 8 HCV
 *   6. Utility          — LIHEAP
 *   7. Childcare        — CCFA
 */

import "server-only"

import {
  getAnnualFPL,
  getIncomeAsFPLPercent,
  computeTotalMonthlyIncome,
  computeDerivedFields,
} from "@/lib/benefit-orchestration/fpl-utils"
import type {
  FamilyProfile,
  BenefitResult,
  BenefitStack,
  ApplicationBundle,
  BenefitProgramId,
} from "@/lib/benefit-orchestration/types"

import { callMassHealthSpecialist } from "@/lib/agents/masshealth-specialist"
import { callFoodNutritionSpecialist } from "@/lib/agents/food-nutrition-specialist"
import { callCashAssistanceSpecialist } from "@/lib/agents/cash-assistance-specialist"
import { callTaxCreditSpecialist } from "@/lib/agents/tax-credit-specialist"
import { callHousingSpecialist } from "@/lib/agents/housing-specialist"
import { callUtilitySpecialist } from "@/lib/agents/utility-specialist"
import { callChildcareSpecialist } from "@/lib/agents/childcare-specialist"

// ── Scoring ───────────────────────────────────────────────────────────────────

function getUrgencyBonus(result: BenefitResult, profile: FamilyProfile): number {
  let bonus = 0
  if (profile.pregnant) bonus += 20
  if (profile.housingStatus === "homeless" || profile.housingStatus === "shelter") bonus += 15
  if (profile.disabled || profile.blind) bonus += 10
  if (profile.childrenUnder5 > 0) bonus += 5
  if (result.category === "healthcare") bonus += 5
  return Math.min(bonus, 20)
}

function getEaseBonus(result: BenefitResult): number {
  let bonus = 0
  if (result.applicationMethods.includes("online")) bonus += 7
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

// ── Application bundles ───────────────────────────────────────────────────────

function buildApplicationBundles(results: BenefitResult[], profile: FamilyProfile): ApplicationBundle[] {
  const bundles: ApplicationBundle[] = []
  const programIds = new Set(results.map((r) => r.programId))

  const dtaPrograms: BenefitProgramId[] = ["snap", "tafdc", "eaedc"]
  const dtaPresent = dtaPrograms.filter((id) => programIds.has(id))
  if (dtaPresent.length >= 2) {
    const totalValue = results
      .filter((r) => dtaPrograms.includes(r.programId))
      .reduce((sum, r) => sum + r.estimatedMonthlyValue, 0)
    bundles.push({
      bundleId: "dta_bundle",
      bundleName: "DTA One-Stop Application",
      description: "Apply once for SNAP, TAFDC, and/or EAEDC through the MA Department of Transitional Assistance.",
      programIds: dtaPresent,
      sharedApplicationName: "DTA Online Portal",
      applicationUrl: "https://www.dta.mass.gov",
      applicationPhone: "1-877-382-2363",
      estimatedTime: "20–30 minutes online",
      totalEstimatedMonthlyValue: totalValue,
    })
  }

  const masshealthIds: BenefitProgramId[] = [
    "masshealth_standard",
    "masshealth_careplus",
    "masshealth_family_assistance",
    "masshealth_limited",
    "masshealth_standard_pregnancy",
    "connector_care",
    "msp",
  ]
  const masshealthPresent = masshealthIds.filter((id) => programIds.has(id))
  if (masshealthPresent.length >= 2) {
    const totalValue = results
      .filter((r) => masshealthIds.includes(r.programId))
      .reduce((sum, r) => sum + r.estimatedMonthlyValue, 0)
    bundles.push({
      bundleId: "masshealth_bundle",
      bundleName: "MassHealth Application Bundle",
      description: "A single MassHealth application covers all coverage tracks and the Medicare Savings Program.",
      programIds: masshealthPresent,
      sharedApplicationName: "MassHealth Application",
      applicationUrl: "/application/new",
      applicationPhone: "1-800-841-2900",
      estimatedTime: "30–45 minutes",
      totalEstimatedMonthlyValue: totalValue,
    })
  }

  if (programIds.has("wic") && programIds.has("masshealth_standard_pregnancy") && profile.pregnant) {
    const wic = results.find((r) => r.programId === "wic")
    const mhPreg = results.find((r) => r.programId === "masshealth_standard_pregnancy")
    bundles.push({
      bundleId: "pregnancy_bundle",
      bundleName: "Pregnancy Support Bundle",
      description: "Apply for MassHealth pregnancy coverage and WIC together — many WIC clinics help with both.",
      programIds: ["wic", "masshealth_standard_pregnancy"],
      sharedApplicationName: "WIC Clinic + MassHealth",
      applicationUrl: "https://www.mass.gov/wic",
      applicationPhone: "1-800-942-1007",
      estimatedTime: "1–2 hours at your local WIC clinic",
      totalEstimatedMonthlyValue: (wic?.estimatedMonthlyValue ?? 0) + (mhPreg?.estimatedMonthlyValue ?? 0),
    })
  }

  return bundles
}

function buildSummary(results: BenefitResult[], totalMonthlyValue: number): string {
  const likelyCount = results.filter((r) => r.eligibilityStatus === "likely").length
  const possiblyCount = results.filter((r) => r.eligibilityStatus === "possibly").length

  if (likelyCount === 0 && possiblyCount === 0) {
    return "Based on your information, we did not find programs you appear to qualify for at this time. A full application may reveal additional options."
  }

  const parts: string[] = []
  if (likelyCount > 0) parts.push(`${likelyCount} program${likelyCount > 1 ? "s" : ""} you likely qualify for`)
  if (possiblyCount > 0) parts.push(`${possiblyCount} additional program${possiblyCount > 1 ? "s" : ""} to explore`)

  const valueStr =
    totalMonthlyValue > 0
      ? ` — potentially $${Math.round(totalMonthlyValue).toLocaleString()}/month in benefits`
      : ""

  return `We found ${parts.join(" and ")}${valueStr}. These are estimates; official eligibility is determined by each program at time of application.`
}

// ── Public types ──────────────────────────────────────────────────────────────

/** Per-specialist reasoning, keyed by domain. Surfaced in the UI as collapsible detail panels. */
export interface SpecialistReasoning {
  masshealth: string
  foodNutrition: string
  cashAssistance: string
  taxCredits: string
  housing: string
  utility: string
  childcare: string
}

export interface AgentBenefitStack extends BenefitStack {
  specialistReasoning: SpecialistReasoning
}

type RawProfile = Parameters<typeof computeDerivedFields>[0] &
  Partial<
    Pick<
      FamilyProfile,
      | "householdSize"
      | "childrenUnder5"
      | "childrenUnder13"
      | "childrenUnder18"
      | "childrenUnder19"
    >
  >

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Run all 7 specialist agents in parallel and return a complete AgentBenefitStack.
 *
 * Each specialist contributes:
 *   - BenefitResult[] (deterministic, always present)
 *   - reasoning string (LLM-generated, falls back to generic message on error)
 */
export async function runBenefitOrchestrator(rawProfile: RawProfile): Promise<AgentBenefitStack> {
  const derived = computeDerivedFields(rawProfile)
  const profile: FamilyProfile = { ...rawProfile, ...derived }

  const totalMonthlyIncome = computeTotalMonthlyIncome(profile)
  const annualFPL = getAnnualFPL(profile.householdSize)
  const fplPercent = getIncomeAsFPLPercent(totalMonthlyIncome * 12, profile.householdSize)

  // Dispatch all 7 specialists concurrently.
  const [
    masshealthResult,
    foodNutritionResult,
    cashAssistanceResult,
    taxCreditResult,
    housingResult,
    utilityResult,
    childcareResult,
  ] = await Promise.all([
    callMassHealthSpecialist(rawProfile),
    callFoodNutritionSpecialist(rawProfile),
    callCashAssistanceSpecialist(rawProfile),
    callTaxCreditSpecialist(rawProfile),
    callHousingSpecialist(rawProfile),
    callUtilitySpecialist(rawProfile),
    callChildcareSpecialist(rawProfile),
  ])

  const allResults: BenefitResult[] = [
    ...masshealthResult.results,
    ...foodNutritionResult.results,
    ...cashAssistanceResult.results,
    ...taxCreditResult.results,
    ...housingResult.results,
    ...utilityResult.results,
    ...childcareResult.results,
  ].filter((r): r is BenefitResult => r !== null && r.eligibilityStatus !== "ineligible")

  const scored = allResults.map((r) => ({ ...r, score: computeScore(r, profile) }))
  const ranked = scored
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, priority: i + 1 }))

  const bundles = buildApplicationBundles(ranked, profile)
  const likelyPrograms = ranked.filter((r) => r.eligibilityStatus === "likely")
  const possiblePrograms = ranked.filter((r) => r.eligibilityStatus === "possibly")
  const quickWins = likelyPrograms.slice(0, 3)
  const totalEstimatedMonthlyValue = likelyPrograms.reduce((sum, r) => sum + r.estimatedMonthlyValue, 0)

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
    specialistReasoning: {
      masshealth: masshealthResult.reasoning,
      foodNutrition: foodNutritionResult.reasoning,
      cashAssistance: cashAssistanceResult.reasoning,
      taxCredits: taxCreditResult.reasoning,
      housing: housingResult.reasoning,
      utility: utilityResult.reasoning,
      childcare: childcareResult.reasoning,
    },
  }
}
