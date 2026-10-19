/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { getFplRow } from "../../figures-2026"
import { monthlyIncomeOf, type MonthlyIncome } from "../income-sum"
import { centsToDollars, dollarsToCents, formatDollars } from "../money"
import { finding, outcome } from "../outcome"
import { LONG_TERM_CARE_ROUTES, determineRoutes, hasAnyRoute } from "../routes"
import type { Saca2EligibilityInputs, Saca2Estimates, Saca2Figures, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R6_INCOME"

const missingIncome = () =>
  finding("SACA2_INCOME_DETAILS_MISSING", "warning", "Some income answers are missing (an amount, how often it is paid, or whether there is income).")
const oneTime = () =>
  finding("SACA2_ONE_TIME_INCOME", "warning", "You reported one-time income. It is not counted monthly here; MassHealth reviews how it counts.")

/**
 * Rule 6 (UNCONFIRMED). Long-term care (facility, HCBS waiver, PACE): Person 1's monthly income against the
 * special income limit; for a facility, patient-paid amount = income − personal needs allowance − spousal
 * allowance (rule 7) − Medicare Part B. Community: Person 1 plus a spouse living together against 100% FPL.
 * Over a limit is review (a deductible, an MSP, or CommonHealth may apply), never a fail.
 */
export function evaluateIncome(
  inputs: Saca2EligibilityInputs,
  figures: Saca2Figures,
  on: Date,
  spousalAllowanceCents: number | null,
): Saca2RuleOutcome {
  void on // figures used here are not effective-dated; kept for one signature across rules
  const applicants = inputs.persons.filter((p) => p.applying)
  if (applicants.length === 0) return outcome(ID, "notApplicable", "No one is applying.")
  const [p1, p2] = inputs.persons
  const findings: EligibilityFinding[] = []
  let review = false
  if (p2?.applying && !inputs.hasSpouse) {
    review = true
    findings.push(finding("SACA2_OTHER_PERSON_APPLYING", "warning", "Person 2 is applying but is not your spouse. This screening estimates income only for you and a spouse."))
  }
  if (!p1.applying) {
    review = true
    findings.push(finding("SACA2_PERSON1_NOT_APPLYING", "warning", "Person 1 is not applying. This screening estimates income from Person 1's answers, so MassHealth reviews it."))
  }
  const estimates: Partial<Saca2Estimates> = {}
  const routes = determineRoutes(inputs)

  if (hasAnyRoute(routes, LONG_TERM_CARE_ROUTES)) {
    if (inputs.hasSpouse && p2?.applying) {
      review = true
      findings.push(finding("SACA2_BOTH_SPOUSES_LONG_TERM_CARE", "warning", "Both spouses are applying with long-term care. MassHealth works out each spouse's income."))
    }
    const limit = dollarsToCents(figures.federalBenefitRate300Monthly)
    estimates.incomeLimit = { kind: "specialIncomeLimit", monthly: figures.federalBenefitRate300Monthly }
    const income = monthlyIncomeOf(p1)
    if (income.cents === null) return outcome(ID, "review", "Income needs review.", [...findings, missingIncome()], estimates)
    if (income.oneTimeIncome) {
      review = true
      findings.push(oneTime())
    }
    estimates.monthlyIncome = centsToDollars(income.cents)
    if (routes.includes("nursingFacility") && inputs.hasSpouse && spousalAllowanceCents === null) {
      // The spousal allowance could not be worked out: do not present a patient-paid amount that silently assumes $0.
      review = true
      findings.push(finding("SACA2_PATIENT_PAID_AMOUNT_UNKNOWN", "warning", "We could not work out the spousal allowance, so the amount you would pay each month toward care is not estimated. MassHealth works it out."))
    } else if (routes.includes("nursingFacility")) {
      const partB = inputs.health.hasMedicare ? dollarsToCents(figures.medicarePartBPremiumMonthly) : 0
      if (inputs.health.hasMedicare) estimates.partBPremium = figures.medicarePartBPremiumMonthly
      const ppa = Math.max(0, income.cents - dollarsToCents(figures.personalNeedsAllowance) - (spousalAllowanceCents ?? 0) - partB)
      estimates.patientPaidAmount = centsToDollars(ppa)
      findings.push(finding("SACA2_PATIENT_PAID_AMOUNT", "info", `Estimated amount you would pay each month toward nursing-facility care: ${formatDollars(ppa)}.`))
    }
    if (income.cents > limit) {
      review = true
      findings.push(finding("SACA2_INCOME_OVER_SPECIAL_LIMIT", "warning", `Your income of about ${formatDollars(income.cents)} a month is over the ${formatDollars(limit)} special income limit. You may still qualify, for example with a deductible; MassHealth decides.`))
    }
    return outcome(ID, review ? "review" : "pass", review ? "Income needs review." : "Income is within the special income limit.", findings, estimates)
  }

  const size = inputs.householdSize
  if (!Number.isInteger(size) || size < 1) {
    return outcome(ID, "review", "Household size is unknown.", [...findings, finding("SACA2_HOUSEHOLD_SIZE_UNKNOWN", "warning", "We could not work out your household size.")], estimates)
  }
  const members = size >= 2 && inputs.hasSpouse && p2 !== undefined ? [p1, p2] : [p1]
  const incomes: MonthlyIncome[] = members.map(monthlyIncomeOf)
  if (incomes.some((income) => income.cents === null)) {
    return outcome(ID, "review", "Income needs review.", [...findings, missingIncome()], { householdSize: size })
  }
  if (incomes.some((income) => income.oneTimeIncome)) {
    review = true
    findings.push(oneTime())
  }
  const total = incomes.reduce((sum, income) => sum + (income.cents ?? 0), 0)
  const row = getFplRow(size)
  const limit = dollarsToCents(row.fpl100.monthly)
  const fplPercent = Math.round((total * 100) / limit)
  estimates.householdSize = size
  estimates.monthlyIncome = centsToDollars(total)
  estimates.fplPercent = fplPercent
  estimates.incomeLimit = { kind: "fpl100", monthly: row.fpl100.monthly }
  if (total > limit) {
    review = true
    findings.push(finding("SACA2_INCOME_OVER_FPL100", "warning", `Your household income is about ${fplPercent}% of the federal poverty level, over the 100% MassHealth Standard limit for a household of ${size}. You may still qualify for a Medicare Savings Program, CommonHealth, or with a deductible.`))
  }
  return outcome(ID, review ? "review" : "pass", review ? "Income needs review." : "Income is within 100% of the federal poverty level.", findings, estimates)
}
