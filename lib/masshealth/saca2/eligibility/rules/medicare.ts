/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { SACA2_FIGURES_YEAR } from "../../figures-2026"
import { dollarsToCents, formatDollars } from "../money"
import { finding, outcome } from "../outcome"
import type { Saca2EligibilityInputs, Saca2Figures, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R8_MEDICARE_MSP"

/** Rule 8 (form Step 6): informational Medicare Savings Program referral; never changes the status. */
export function evaluateMedicare(inputs: Saca2EligibilityInputs, figures: Saca2Figures): Saca2RuleOutcome {
  if (!inputs.health.hasMedicare) return outcome(ID, "notApplicable", "No Medicare coverage reported.")
  const premium = figures.medicarePartBPremiumMonthly
  const findings =
    inputs.health.wantsPartBHelp === "yes"
      ? [finding("SACA2_MSP_REFERRAL", "info", `You asked for help paying Medicare Part B premiums (${formatDollars(dollarsToCents(premium))} a month in ${SACA2_FIGURES_YEAR}). MassHealth also checks the Medicare Savings Programs, which have no asset limit.`)]
      : [finding("SACA2_MSP_AVAILABLE", "info", "If Medicare premiums are hard to pay, you can ask for help through the Medicare Savings Programs, which have no asset limit.")]
  return outcome(ID, "pass", "Medicare reported.", findings, { partBPremium: premium })
}
