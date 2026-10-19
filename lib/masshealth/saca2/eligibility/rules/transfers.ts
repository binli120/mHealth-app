/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { isIsoDate, isoDay, isoMonthsBefore } from "../dates"
import { centsToDollars, dollarsToCents, formatDollars } from "../money"
import { finding, outcome } from "../outcome"
import { SACA2_TRANSFER_KEYS, type Saca2EligibilityInputs, type Saca2Figures, type Saca2RuleOutcome, type Saca2TransferKey } from "../types"

const ID = "SACA2_R5_TRANSFERS"
/** Transfers whose effect depends on documents a caseworker must read. */
const COMPLEX_KEYS: readonly Saca2TransferKey[] = ["trust", "deed", "addedToDeed", "loanOrNote", "annuity"]

/**
 * Rule 5 (UNCONFIRMED): uncompensated transfers in the 60-month look-back ending on the screening date
 * (inclusive). Estimated penalty days = total ÷ average daily nursing-facility cost, rounded down.
 */
export function evaluateTransfers(inputs: Saca2EligibilityInputs, figures: Saca2Figures, on: Date): Saca2RuleOutcome {
  const s = inputs.suppA
  if (s === null) return outcome(ID, "notApplicable", "The 60-month look-back applies to long-term-care applicants.")

  const findings: EligibilityFinding[] = []
  let review = false
  if (SACA2_TRANSFER_KEYS.some((key) => s.transferAnswers[key] === null)) {
    review = true
    findings.push(finding("SACA2_TRANSFER_ANSWERS_MISSING", "warning", "Some resource-transfer questions are not answered."))
  }
  if (COMPLEX_KEYS.some((key) => s.transferAnswers[key] === "yes")) {
    review = true
    findings.push(finding("SACA2_TRANSFER_COMPLEX", "warning", "You reported a trust, deed, loan, or annuity change in the past 60 months. MassHealth reviews these."))
  }

  const lookBackStart = isoMonthsBefore(on, figures.lookBackMonths)
  const today = isoDay(on)
  let total = 0
  let count = 0
  let unusable = 0
  for (const transfer of s.transfers) {
    if (!isIsoDate(transfer.date) || typeof transfer.amount !== "number" || transfer.date > today) {
      unusable += 1
      continue
    }
    if (transfer.date < lookBackStart) continue
    total += transfer.amount
    count += 1
  }
  if (unusable > 0) {
    review = true
    findings.push(finding("SACA2_TRANSFER_DETAILS_MISSING", "warning", "A transfer is missing its date or amount, or its date is in the future."))
  }

  const dailyCost = dollarsToCents(figures.nursingFacilityDailyCost)
  const penaltyDays = Math.floor(total / dailyCost)
  const estimates = { transfersInWindow: { count, total: centsToDollars(total), penaltyDays, lookBackStart } }
  if (total > 0) {
    review = true
    findings.push(finding("SACA2_TRANSFER_PENALTY_ESTIMATE", "warning", `Transfers of about ${formatDollars(total)} in the past 60 months could delay payment for long-term care by an estimated ${penaltyDays} days (${formatDollars(total)} divided by ${formatDollars(dailyCost)} a day). MassHealth decides whether a penalty applies.`))
  }
  return review
    ? outcome(ID, "review", "Resource transfers in the past 60 months need review.", findings, estimates)
    : outcome(ID, "pass", "No resource transfers reported in the past 60 months.", findings, estimates)
}
