/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { dollarsToCents, formatDollars } from "../money"
import { finding, outcome } from "../outcome"
import { determineRoutes, hasAnyRoute } from "../routes"
import type { Saca2EligibilityInputs, Saca2Figures, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R4_HOME_EQUITY"
const SHARED_OWNERSHIP: ReadonlySet<string> = new Set(["tenancyInCommon", "jointTenancy", "lifeEstate"])

/**
 * Rule 4 (UNCONFIRMED): home value over the equity limit for long-term-care applicants, unless a spouse,
 * child under 21, or disabled child lives there. Uses fair-market value (the wizard does not ask equity).
 * Missing answers go to review, never to a default.
 */
export function evaluateHomeEquity(inputs: Saca2EligibilityInputs, figures: Saca2Figures): Saca2RuleOutcome {
  const s = inputs.suppA
  if (!hasAnyRoute(determineRoutes(inputs), ["nursingFacility", "hcbsWaiver"]) || s === null || s.ownsHome === "no") {
    return outcome(ID, "notApplicable", "The home-equity limit applies to long-term-care applicants who own a home.")
  }
  if (s.ownsHome === null) {
    return outcome(ID, "review", "It is not answered whether you own a home.", [
      finding("SACA2_HOME_OWNERSHIP_MISSING", "warning", "It is not answered whether you own a home, so the home-equity limit cannot be checked. MassHealth reviews it."),
    ])
  }
  if (s.homes.length === 0 || s.homes.some((h) => typeof h.fairMarketValue !== "number")) {
    return outcome(ID, "review", "A home value is missing.", [finding("SACA2_HOME_VALUE_MISSING", "warning", "A home value is missing or not a valid number.")])
  }
  const limit = dollarsToCents(figures.maxHomeEquity)
  const over = s.homes.filter((h) => (h.fairMarketValue as number) > limit)
  if (over.length === 0) {
    return outcome(ID, "pass", `Home value is within the ${formatDollars(limit)} limit.`, [], { homeEquityOverLimit: false })
  }
  if (s.occupants.spouse || s.occupants.childUnder21 || s.occupants.disabledChild) {
    return outcome(ID, "pass", "The home-equity limit does not apply.", [
      finding("SACA2_HOME_EQUITY_EXEMPT", "info", "Your home is worth more than the equity limit, but a spouse, a child under 21, or a disabled child lives there, so the limit does not apply."),
    ], { homeEquityOverLimit: true })
  }
  if (over.some((h) => h.ownershipType === null || SHARED_OWNERSHIP.has(h.ownershipType))) {
    return outcome(ID, "review", "A shared home over the limit needs review.", [
      finding("SACA2_HOME_SHARED_OWNERSHIP", "warning", "Your home is worth more than the equity limit and is owned with others. MassHealth works out your share."),
    ], { homeEquityOverLimit: true })
  }
  return outcome(ID, "fail", "Home value is over the home-equity limit.", [
    finding("SACA2_HOME_EQUITY_OVER", "error", `Your home's value is over the ${formatDollars(limit)} home-equity limit for long-term-care services. This screening uses the value you entered, not your equity after any mortgage.`),
  ], { homeEquityOverLimit: true })
}
