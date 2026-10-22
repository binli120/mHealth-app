/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { getEffectiveFigure } from "../../figures-2026"
import { monthlyIncomeOf } from "../income-sum"
import { INVALID_AMOUNT, centsToDollars, dollarsToCents, formatDollars, totalCents } from "../money"
import { finding, outcome } from "../outcome"
import { determineRoutes } from "../routes"
import type { Saca2EligibilityInputs, Saca2Figures, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R7_SPOUSAL_ALLOWANCE"

/**
 * Rule 7 (UNCONFIRMED): minimum monthly maintenance needs allowance for a spouse at home.
 * Shelter = housing costs + SNAP utility standard (heat, else no-heat when utilities are paid);
 * excess shelter = shelter - standard shelter expense; MMMNA = min(max, minimum + excess);
 * allowance = MMMNA - the spouse's own income. All figures read for `on` (effective-dated).
 * A blank housing-cost amount means the spouse does not pay it (those fields are optional).
 */
export function evaluateSpousalAllowance(inputs: Saca2EligibilityInputs, figures: Saca2Figures, on: Date): Saca2RuleOutcome {
  const s = inputs.suppA
  const spouse = inputs.hasSpouse ? inputs.persons[1] : undefined
  if (
    !determineRoutes(inputs).includes("nursingFacility") ||
    !inputs.hasSpouse ||
    s === null ||
    s.spouseExpenses === null ||
    spouse?.inInstitution === "yes"
  ) {
    return outcome(ID, "notApplicable", "A spousal allowance applies when one spouse is in a nursing facility and the other lives at home.")
  }
  if (spouse?.inInstitution == null) {
    return outcome(ID, "review", "It is not answered whether your spouse lives in a facility.", [
      finding("SACA2_SPOUSE_FACILITY_UNKNOWN", "warning", "It is not answered whether your spouse lives in a facility, so the spousal allowance is not estimated."),
    ])
  }
  const e = s.spouseExpenses
  if (e.paysHeat === null || e.paysUtilities === null) {
    return outcome(ID, "review", "The heat and utility answers are needed.", [finding("SACA2_UTILITY_ANSWERS_MISSING", "warning", "Tell us whether your spouse pays for heat and for utilities.")])
  }
  const housing = [e.rent, e.mortgage, e.homeownersInsurance, e.realEstateTaxes, e.condoOrCoopFee]
  if (housing.some((value) => value === INVALID_AMOUNT)) {
    return outcome(ID, "review", "A housing-expense amount is not valid.", [finding("SACA2_SHELTER_VALUE_INVALID", "warning", "A housing-expense amount is not a valid number.")])
  }
  const utility =
    e.paysHeat === "yes"
      ? getEffectiveFigure(figures.snapUtility.heat, on)
      : e.paysUtilities === "yes"
        ? getEffectiveFigure(figures.snapUtility.noHeat, on)
        : 0
  const shelter = totalCents(housing).total + dollarsToCents(utility)
  const excessShelter = Math.max(0, shelter - dollarsToCents(getEffectiveFigure(figures.standardShelterExpense, on)))
  const mmmna = Math.min(dollarsToCents(figures.mmmnaMax), dollarsToCents(getEffectiveFigure(figures.mmmnaMin, on)) + excessShelter)
  const spouseIncome = spouse ? monthlyIncomeOf(spouse) : null
  if (spouseIncome === null || spouseIncome.cents === null) {
    return outcome(ID, "review", "Your spouse's income is needed.", [finding("SACA2_SPOUSE_INCOME_MISSING", "warning", "Your spouse's income is needed to estimate the spousal allowance.")])
  }
  const allowance = Math.max(0, mmmna - spouseIncome.cents)
  const estimates = {
    spousalAllowance: { mmmna: centsToDollars(mmmna), excessShelter: centsToDollars(excessShelter), allowance: centsToDollars(allowance) },
  }
  const findings = [
    finding("SACA2_SPOUSAL_ALLOWANCE_ESTIMATE", "info", `Estimated monthly amount of your income your spouse at home may keep: ${formatDollars(allowance)}.`),
  ]
  let needsReview = false
  if (s.familyAtHome === null) {
    needsReview = true
    findings.push(finding("SACA2_FAMILY_ANSWER_MISSING", "warning", "Tell us whether a child, parent or sibling lives with your spouse."))
  } else if (s.familyAtHome === "yes") {
    needsReview = true
    findings.push(finding("SACA2_FAMILY_ALLOWANCE_NOT_ESTIMATED", "warning", "Family members live with your spouse. MassHealth may allow more income for them; this screening does not estimate that."))
  }
  if (spouseIncome.oneTimeIncome) {
    needsReview = true
    findings.push(finding("SACA2_SPOUSE_ONE_TIME_INCOME", "warning", "Your spouse reported one-time income. It is not in this estimate and needs review."))
  }
  if (needsReview) return outcome(ID, "review", "The spousal allowance needs review.", findings, estimates)
  return outcome(ID, "pass", "Spousal allowance estimated.", findings, estimates)
}
