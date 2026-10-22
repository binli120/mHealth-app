/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { INVALID_AMOUNT, centsToDollars, dollarsToCents, formatDollars, totalCents, type AmountInput } from "../money"
import { finding, outcome } from "../outcome"
import { determineRoutes } from "../routes"
import type {
  Saca2AssetInputs,
  Saca2EligibilityInputs,
  Saca2Estimates,
  Saca2Figures,
  Saca2RuleOutcome,
  Saca2RuleVerdict,
} from "../types"

const ID = "SACA2_R3_ASSETS"

function vehicleEquities(vehicles: Saca2AssetInputs["vehicles"]): AmountInput[] {
  return vehicles.map((v) => {
    if (v.fairMarketValue === null || v.fairMarketValue === INVALID_AMOUNT) return v.fairMarketValue
    if (v.amountOwed === null || v.amountOwed === INVALID_AMOUNT) return v.amountOwed
    return Math.max(0, v.fairMarketValue - v.amountOwed)
  })
}

/** The home is not counted unless a facility applicant will not return and no protected relative lives there. */
function homeStatus(inputs: Saca2EligibilityInputs): "excluded" | "counted" | "unknown" {
  const s = inputs.suppA
  if (s === null) return "excluded"
  const o = s.occupants
  if (s.intendsToReturnHome === "yes" || o.spouse || o.childUnder21 || o.disabledChild || o.dependentRelative) return "excluded"
  // Unanswered occupant questions read as false (Task 3 reader), so only the return-home answer can be checked for missing.
  return s.intendsToReturnHome === null ? "unknown" : "counted"
}

/** Rule 3 (UNCONFIRMED): countable assets against $2,000 / $3,000, or the community-spouse band. */
export function evaluateAssets(inputs: Saca2EligibilityInputs, figures: Saca2Figures): Saca2RuleOutcome {
  const { assets } = inputs
  const institutional = determineRoutes(inputs).includes("nursingFacility")
  const findings: EligibilityFinding[] = []
  let needsReview = false
  const flag = (code: string, message: string) => {
    needsReview = true
    findings.push(finding(code, "warning", message))
  }

  if (Object.values(assets.gates).some((gate) => gate === null)) flag("SACA2_ASSET_ANSWERS_MISSING", "Some asset questions are not answered.")

  // A Yes gate whose list is empty means the amounts are unknown, not zero. One account list serves three gates.
  const { gates } = assets
  const yes = (...values: Array<"yes" | "no" | null>) => values.some((value) => value === "yes")
  const detailsMissing =
    (yes(gates.bankAccounts, gates.retirementAccounts, gates.closedAccounts) && assets.bankAccounts.length === 0) ||
    (yes(gates.primaryResidence) && assets.primaryResidence.length === 0) ||
    (yes(gates.otherRealEstate) && assets.otherRealEstate.length === 0) ||
    (yes(gates.lifeInsurance) && assets.lifeInsurance.length === 0) ||
    (yes(gates.securities) && assets.securities.length === 0) ||
    (yes(gates.annuities) && assets.annuities === 0) ||
    (yes(gates.assistedLivingDeposit) && assets.deposits === 0) ||
    (yes(gates.vehicles) && assets.vehicles.length === 0) ||
    (yes(gates.trusts) && assets.trusts.length === 0)
  if (detailsMissing) flag("SACA2_ASSET_DETAILS_MISSING", "You answered Yes to an asset question but listed nothing for it, so your countable assets are not estimated.")

  const counted: AmountInput[] = []
  for (const account of assets.bankAccounts) if (account.open) counted.push(account.balance)
  counted.push(...assets.otherRealEstate, ...assets.securities.map((holding) => holding.value))

  const home = assets.primaryResidence.length > 0 && institutional ? homeStatus(inputs) : "excluded"
  if (home === "unknown") flag("SACA2_HOME_ANSWER_MISSING", "It is not answered whether you plan to return home, so this estimate does not count your home. MassHealth reviews it.")
  if (home === "counted") {
    counted.push(...assets.primaryResidence)
    findings.push(finding("SACA2_HOME_COUNTED", "warning", "Your home may count as an asset because you do not plan to return to it and no spouse or dependent relative lives there."))
  }

  const faces = totalCents(assets.lifeInsurance.map((policy) => policy.faceValue))
  const faceLimit = dollarsToCents(figures.lifeInsuranceFaceValuePerPerson) * (inputs.hasSpouse ? 2 : 1)
  if (faces.missing + faces.invalid > 0) flag("SACA2_LIFE_INSURANCE_VALUE_MISSING", "A life-insurance face value is missing or not a valid number.")
  else if (faces.total > faceLimit) counted.push(...assets.lifeInsurance.map((policy) => policy.cashSurrenderValue))

  const equities = vehicleEquities(assets.vehicles)
  const known = equities.filter((e): e is number => typeof e === "number").sort((a, b) => b - a)
  counted.push(...equities.filter((e) => typeof e !== "number"), ...known.slice(1))

  for (const trust of assets.trusts) if (trust.revocable === true) counted.push(trust.principal)
  if (assets.trusts.some((trust) => trust.revocable !== true)) flag("SACA2_TRUST_REVIEW", "MassHealth reviews trusts that are not revocable; this screening does not count them.")
  if (assets.annuities > 0) flag("SACA2_ANNUITY_REVIEW", "MassHealth reviews annuities; this screening cannot value them.")
  if (assets.deposits > 0) flag("SACA2_DEPOSIT_REVIEW", "A deposit held by a care facility may count as an asset; MassHealth reviews it.")
  if (assets.burial > 0) findings.push(finding("SACA2_BURIAL_EXCLUDED", "info", "Prepaid burial arrangements are not counted in this estimate."))

  const total = totalCents(counted)
  if (total.missing + total.invalid > 0) flag("SACA2_ASSET_VALUE_MISSING", "Some asset amounts are missing or not valid numbers.")
  const countable = total.total
  const estimates: Partial<Saca2Estimates> = detailsMissing ? {} : { countableAssets: centsToDollars(countable) }
  const spouse = inputs.hasSpouse ? inputs.persons[1] : undefined
  let verdict: Saca2RuleVerdict
  let limitCents: number | null = null

  if (institutional && inputs.hasSpouse && spouse?.inInstitution == null) {
    verdict = "review"
    findings.push(finding("SACA2_SPOUSE_FACILITY_UNKNOWN", "warning", "It is not answered whether your spouse lives in a facility. MassHealth reviews assets."))
  } else if (institutional && inputs.hasSpouse && spouse?.inInstitution !== "yes") {
    const { min, max } = figures.communitySpouseResource
    const keep = dollarsToCents(figures.assetLimit.individual)
    estimates.communitySpouseResource = { min, max }
    limitCents = dollarsToCents(max) + keep
    if (countable <= dollarsToCents(min) + keep) {
      verdict = "pass"
    } else if (countable > limitCents) {
      verdict = "fail"
    } else {
      verdict = "review"
      findings.push(finding("SACA2_COMMUNITY_SPOUSE_RANGE", "info", `Your countable assets of about ${formatDollars(countable)} fall in the range a spouse at home may be allowed to keep (${formatDollars(dollarsToCents(min))} to ${formatDollars(dollarsToCents(max))}). MassHealth works out the exact amount.`))
    }
  } else if (institutional && inputs.hasSpouse) {
    verdict = "review"
    findings.push(finding("SACA2_BOTH_SPOUSES_IN_FACILITY", "warning", "Both spouses live in a facility. MassHealth reviews assets for each spouse."))
  } else if (inputs.hasSpouse && spouse?.livesWithPerson1 === "yes") {
    limitCents = dollarsToCents(figures.assetLimit.marriedCoupleMember)
    estimates.assetLimit = figures.assetLimit.marriedCoupleMember
    if (!spouse.applying) findings.push(finding("SACA2_ONE_SPOUSE_APPLYING", "info", "Only one spouse is applying. This estimate uses the limit for a married couple living together; MassHealth confirms the limit."))
    verdict = countable <= limitCents ? "pass" : "fail"
  } else if (inputs.hasSpouse) {
    verdict = "review"
    findings.push(finding("SACA2_SPOUSE_LIVES_APART", "warning", "You are married but do not live with your spouse and are not in a facility. MassHealth reviews how your spouse's assets count."))
  } else {
    limitCents = dollarsToCents(figures.assetLimit.individual)
    estimates.assetLimit = figures.assetLimit.individual
    verdict = countable <= limitCents ? "pass" : "fail"
  }

  if (verdict === "pass" && needsReview) verdict = "review"
  if (verdict === "fail" && limitCents !== null) {
    findings.push(finding("SACA2_ASSETS_OVER_LIMIT", "error", `Countable assets of about ${formatDollars(countable)} are over the ${formatDollars(limitCents)} limit used in this estimate.`))
  }
  const message = verdict === "pass" ? "Countable assets are within the limit." : verdict === "fail" ? "Countable assets are over the limit." : "Assets need review."
  return outcome(ID, verdict, message, findings, estimates)
}
