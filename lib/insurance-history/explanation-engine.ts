// lib/insurance-history/explanation-engine.ts
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { CoverageRecord, ChangeFactor } from "@/lib/insurance-history/types"

const EMPLOYER_CODES = new Set([
  "employer_sponsored_insurance",
])

const MEDICARE_CODES = new Set([
  "medicare_savings_program_adult",
  "medicare_savings_program_senior",
  "medigap_plans",
  "dual_eligible_standard",
])

export const FALLBACK_EXPLANATION =
  "Your coverage changed between these two years. Add or complete your income and household details to get a personalized explanation."

export function computeChangeFactor(
  current: CoverageRecord,
  prior: CoverageRecord | null,
): ChangeFactor {
  if (!prior) {
    return {
      incomeDelta: null,
      householdDelta: null,
      fplDelta: null,
      programChange: null,
      gainedEmployer: false,
      lostEmployer: false,
      pregnancy: current.programCode === "pregnancy_standard",
      medicare: MEDICARE_CODES.has(current.programCode ?? ""),
    }
  }

  const incomeDelta =
    current.annualIncome != null && prior.annualIncome != null
      ? current.annualIncome - prior.annualIncome
      : null

  const householdDelta =
    current.householdSize != null && prior.householdSize != null
      ? current.householdSize - prior.householdSize
      : null

  const fplDelta =
    current.fplPercent != null && prior.fplPercent != null
      ? Math.round(current.fplPercent - prior.fplPercent)
      : null

  const gainedEmployer =
    EMPLOYER_CODES.has(current.programCode ?? "") &&
    !EMPLOYER_CODES.has(prior.programCode ?? "")

  const lostEmployer =
    !EMPLOYER_CODES.has(current.programCode ?? "") &&
    EMPLOYER_CODES.has(prior.programCode ?? "")

  return {
    incomeDelta,
    householdDelta,
    fplDelta,
    programChange:
      current.programCode !== prior.programCode
        ? { from: prior.programCode, to: current.programCode }
        : null,
    gainedEmployer,
    lostEmployer,
    pregnancy: current.programCode === "pregnancy_standard",
    medicare: MEDICARE_CODES.has(current.programCode ?? ""),
  }
}

/**
 * Returns a single-factor explanation template string, or null if multiple
 * significant factors changed (caller should use LLM fallback).
 */
export function applyRulesTemplate(
  current: CoverageRecord,
  prior: CoverageRecord | null,
): string | null {
  if (!prior) return "This is the earliest coverage record on file."

  const cf = computeChangeFactor(current, prior)

  const significantFactors = [
    cf.pregnancy,
    cf.medicare,
    cf.gainedEmployer,
    cf.lostEmployer,
    cf.fplDelta != null && cf.fplDelta !== 0 && !cf.gainedEmployer && !cf.lostEmployer && !cf.pregnancy && !cf.medicare,
    cf.householdDelta != null && cf.householdDelta !== 0 && !cf.pregnancy,
  ].filter(Boolean).length

  if (significantFactors > 1) return null

  if (cf.pregnancy) {
    return "Pregnancy qualifies you for MassHealth Standard regardless of income."
  }

  if (cf.medicare) {
    return "You became eligible for Medicare, transitioning from state coverage to a Medicare savings program."
  }

  if (cf.gainedEmployer) {
    return "You gained access to affordable employer-sponsored insurance, making you ineligible for subsidized marketplace plans."
  }

  if (cf.lostEmployer) {
    return "You lost access to employer-sponsored insurance, opening eligibility for subsidized coverage."
  }

  if (cf.fplDelta != null && cf.fplDelta !== 0) {
    const curFpl = current.fplPercent ?? 0
    const priorFpl = prior.fplPercent ?? 0

    // Check threshold crossings first regardless of delta magnitude
    if (priorFpl > 138 && curFpl <= 138) {
      return `Your income fell below 138% of the Federal Poverty Level, making you eligible for free MassHealth CarePlus.`
    }
    if (priorFpl <= 138 && curFpl > 138) {
      return `Your income rose above 138% FPL, making you ineligible for free Medicaid. You moved to a subsidized ConnectorCare plan.`
    }
    if (priorFpl < 300 && curFpl >= 300) {
      return `Your income exceeded 300% FPL, moving you out of ConnectorCare into a marketplace plan with federal tax credits.`
    }
    if (priorFpl < 400 && curFpl >= 400) {
      return `Your income exceeded 400% FPL, making you ineligible for premium subsidies. You may qualify for unsubsidized marketplace coverage.`
    }
    if (Math.abs(cf.fplDelta) < 10) {
      return null
    }
    if (cf.fplDelta < 0) {
      return `Your income decreased, lowering your Federal Poverty Level percentage from ${Math.round(priorFpl)}% to ${Math.round(curFpl)}%, which changed your plan eligibility.`
    }
    return `Your income increased, raising your Federal Poverty Level percentage from ${Math.round(priorFpl)}% to ${Math.round(curFpl)}%, which changed your plan eligibility.`
  }

  if (cf.householdDelta != null && cf.householdDelta !== 0) {
    if (cf.householdDelta > 0) {
      return "Your household grew, which adjusted your Federal Poverty Level calculation and changed your eligibility."
    }
    return "A change in your household size adjusted your FPL calculation and affected your plan eligibility."
  }

  return null
}

/** Builds the LLM prompt for multi-factor or unmatched transitions. */
export function buildLlmPrompt(
  current: CoverageRecord,
  prior: CoverageRecord,
  cf: ChangeFactor,
): string {
  return `You are a plain-language health insurance assistant for Massachusetts residents. Explain in 2-3 sentences why this person's health insurance changed between ${prior.coverageYear} and ${current.coverageYear}. Be specific about the numbers. Do not use jargon. Do not mention MassHealth by name unless relevant.

Previous coverage (${prior.coverageYear}): ${prior.planName}, FPL: ${prior.fplPercent ?? "unknown"}%, income: $${prior.annualIncome ?? "unknown"}/year, household: ${prior.householdSize ?? "unknown"}
Current coverage (${current.coverageYear}): ${current.planName}, FPL: ${current.fplPercent ?? "unknown"}%, income: $${current.annualIncome ?? "unknown"}/year, household: ${current.householdSize ?? "unknown"}
Change factors: income delta $${cf.incomeDelta ?? "unknown"}, FPL delta ${cf.fplDelta ?? "unknown"}%, household delta ${cf.householdDelta ?? 0}`
}
