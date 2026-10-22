/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2RuleId } from "./types"

export interface Saca2RulePolicyEntry {
  label: string
  /**
   * True only once the rule's logic is confirmed. Rules 3-7 need a named MassHealth-knowledgeable reviewer
   * and a 130 CMR 519-520 citation recorded in docs/superpowers/saca2-policy-review.md (a test keeps the
   * two in step). While false, the engine turns this rule's pass / fail / documents into review.
   */
  confirmed: boolean
}

export type Saca2RulePolicy = Record<Saca2RuleId, Saca2RulePolicyEntry>

export const SACA2_POLICY_REVIEW_DOC = "docs/superpowers/saca2-policy-review.md"

/** Spec §4.4: these rules must be checked against 130 CMR 519-520 before they can be confirmed. */
export const SACA2_POLICY_GATED_RULES: readonly Saca2RuleId[] = [
  "SACA2_R3_ASSETS",
  "SACA2_R4_HOME_EQUITY",
  "SACA2_R5_TRANSFERS",
  "SACA2_R6_INCOME",
  "SACA2_R7_SPOUSAL_ALLOWANCE",
]

export const SACA2_RULE_POLICY: Saca2RulePolicy = {
  SACA2_R1_RESIDENCY_ROUTE: { label: "Residency and application route", confirmed: true },
  SACA2_R2_CITIZENSHIP: { label: "Citizenship and immigration", confirmed: true },
  SACA2_R3_ASSETS: { label: "Countable assets", confirmed: false },
  SACA2_R4_HOME_EQUITY: { label: "Home equity", confirmed: false },
  SACA2_R5_TRANSFERS: { label: "Transfers in the 60-month look-back", confirmed: false },
  SACA2_R6_INCOME: { label: "Income", confirmed: false },
  SACA2_R7_SPOUSAL_ALLOWANCE: { label: "Spousal allowance (MMMNA)", confirmed: false },
  SACA2_R8_MEDICARE_MSP: { label: "Medicare and Medicare Savings Programs", confirmed: true },
}
