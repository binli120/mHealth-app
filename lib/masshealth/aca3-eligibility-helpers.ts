/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Pure helper functions shared by both ACA-3 eligibility engines:
 *   • aca3-eligibility-engine.ts  (new applicant)
 *   • aca3ap-eligibility-engine.ts (add-a-person to existing case)
 *
 * Extracted here to eliminate verbatim duplication. No engine-specific
 * logic belongs here — household-size computation differs between the two
 * engines and stays local to each.
 */

import { FPL_TABLE_2026, FPL_INCREMENT_AFTER_4 } from "./constants"
import type { EligibilityIncomeInput } from "./types"

// ── Numeric guards ────────────────────────────────────────────────────────────

/** Returns 0 for any non-finite or non-positive value; floors positives. */
export function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

// ── FPL lookup ────────────────────────────────────────────────────────────────

/**
 * Returns the 2026 Federal Poverty Level annual dollar amount for a given
 * household size. Extrapolates linearly for sizes > 4 using the standard
 * per-person increment.
 */
export function resolveFplForHouseholdSize(householdSize: number): number {
  if (householdSize <= 1) return FPL_TABLE_2026[1]
  if (FPL_TABLE_2026[householdSize]) return FPL_TABLE_2026[householdSize]
  // Linear extrapolation: each additional person beyond 4 adds FPL_INCREMENT_AFTER_4.
  return FPL_TABLE_2026[4] + (householdSize - 4) * FPL_INCREMENT_AFTER_4
}

// ── MAGI income ───────────────────────────────────────────────────────────────

/**
 * Computes Modified Adjusted Gross Income (MAGI) from the eligibility income
 * input by summing all relevant income streams and rounding to the nearest
 * whole dollar. Returns 0 if the result would be negative.
 */
export function computeMagiIncome(income: EligibilityIncomeInput): number {
  const total =
    (income.wages ?? 0) +
    (income.selfEmployment ?? 0) +
    (income.unemployment ?? 0) +
    (income.socialSecurityTaxable ?? 0) +
    (income.rentalIncome ?? 0) +
    (income.interest ?? 0) +
    (income.pension ?? 0)
  return Math.max(0, Math.round(total))
}

// ── Document accumulation ─────────────────────────────────────────────────────

/**
 * Appends `document` to `requiredDocuments` only if it isn't already present
 * (deduplication by identity). Mutates in place for consistency with the
 * rule-evaluation pattern used by both engines.
 */
export function addRequiredDocument(requiredDocuments: string[], document: string): void {
  if (!requiredDocuments.includes(document)) {
    requiredDocuments.push(document)
  }
}
