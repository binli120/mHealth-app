/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { buildRecommendedApplicationTypeHref } from "@/lib/applications/navigation"
import type { EligibilityRuleResult, EligibilityRuleStatus } from "@/lib/masshealth/types"
import { buildSaca2DocumentChecklist } from "./document-checklist"
import { readSaca2EligibilityInputs } from "./eligibility/inputs"
import { dollarsToCents } from "./eligibility/money"
import { finding, worstVerdict } from "./eligibility/outcome"
import { SACA2_RULE_POLICY, type Saca2RulePolicy } from "./eligibility/policy"
import { evaluateAssets } from "./eligibility/rules/assets"
import { evaluateCitizenship } from "./eligibility/rules/citizenship"
import { evaluateHomeEquity } from "./eligibility/rules/home-equity"
import { evaluateIncome } from "./eligibility/rules/income"
import { evaluateMedicare } from "./eligibility/rules/medicare"
import { evaluateResidencyRoute } from "./eligibility/rules/residency-route"
import { evaluateSpousalAllowance } from "./eligibility/rules/spousal-allowance"
import { evaluateTransfers } from "./eligibility/rules/transfers"
import {
  emptyEstimates,
  type Saca2EligibilityResult,
  type Saca2Estimates,
  type Saca2Figures,
  type Saca2RuleOutcome,
  type Saca2RuleReport,
  type Saca2RuleVerdict,
  type Saca2ScreeningStatus,
} from "./eligibility/types"
import { SACA2_FIGURES } from "./figures-2026"
import type { Saca2Answers } from "./types"

export const SACA2_SCREENING_LABEL =
  "Screening estimate only. This is not a MassHealth decision: MassHealth decides eligibility after you apply."

const UNCONFIRMED_NOTE =
  " Screening estimate: this rule has not yet been confirmed against MassHealth regulations, so the result needs review."

const STATUS_BY_VERDICT: Record<Saca2RuleVerdict, Saca2ScreeningStatus> = {
  redirect: "REDIRECT_ACA3",
  fail: "LIKELY_INELIGIBLE",
  review: "NEEDS_REVIEW",
  documents: "PENDING_DOCUMENTS",
  pass: "LIKELY_ELIGIBLE",
  notApplicable: "LIKELY_ELIGIBLE",
}

/** `EligibilityRuleStatus` has no review value; review and documents render as warnings. */
const RULE_STATUS: Record<Saca2RuleVerdict, EligibilityRuleStatus> = {
  pass: "pass",
  notApplicable: "pass",
  fail: "fail",
  redirect: "fail",
  review: "warning",
  documents: "warning",
}

export interface Saca2EvaluateOptions {
  /** Defaults to SACA2_RULE_POLICY. Tests pass an all-confirmed copy to exercise each rule's own logic. */
  policy?: Saca2RulePolicy
}

/** An unconfirmed rule can only say "review" (or "does not apply"): never a guess, never an approval. */
export function effectiveVerdict(verdict: Saca2RuleVerdict, confirmed: boolean): Saca2RuleVerdict {
  if (confirmed || verdict === "notApplicable" || verdict === "review") return verdict
  return "review"
}

export function saca2ScreeningFallback(): Saca2EligibilityResult {
  return {
    status: "NEEDS_REVIEW",
    screening_label: SACA2_SCREENING_LABEL,
    findings: [
      finding("SACA2_SCREENING_ERROR", "warning", "We couldn't estimate a result from these answers. You can still apply; MassHealth will review your application."),
    ],
    rule_results: [],
    rules: [],
    estimates: emptyEstimates(),
    required_documents: [],
    document_checklist: [],
  }
}

function evaluate(answers: Saca2Answers, figures: Saca2Figures, on: Date, policy: Saca2RulePolicy): Saca2EligibilityResult {
  if (Number.isNaN(on.getTime())) throw new Error("Invalid screening date")
  const inputs = readSaca2EligibilityInputs(answers, on)
  const spousal = evaluateSpousalAllowance(inputs, figures, on)
  const allowance = spousal.estimates.spousalAllowance
  const outcomes: Saca2RuleOutcome[] = [
    evaluateResidencyRoute(inputs),
    evaluateCitizenship(inputs),
    evaluateAssets(inputs, figures),
    evaluateHomeEquity(inputs, figures),
    evaluateTransfers(inputs, figures, on),
    evaluateIncome(inputs, figures, on, allowance ? dollarsToCents(allowance.allowance) : null),
    spousal,
    evaluateMedicare(inputs, figures),
  ]

  const rules: Saca2RuleReport[] = outcomes.map((o) => {
    const { label, confirmed } = policy[o.id]
    return { id: o.id, label, confirmed, verdict: o.verdict, effective_verdict: effectiveVerdict(o.verdict, confirmed) }
  })
  const findings = outcomes.flatMap((o) => o.findings)
  if (rules.some((rule) => rule.effective_verdict !== rule.verdict)) {
    findings.push(finding("SACA2_RULES_UNCONFIRMED", "info", "Some screening rules have not yet been checked against MassHealth regulations, so MassHealth needs to review this estimate."))
  }
  const ruleResults: EligibilityRuleResult[] = outcomes.map((o, index) => {
    const rule = rules[index]
    return {
      id: o.id,
      label: rule.label,
      status: RULE_STATUS[rule.effective_verdict],
      message: rule.effective_verdict !== rule.verdict ? `${o.message}${UNCONFIRMED_NOTE}` : o.message,
    }
  })
  const status = STATUS_BY_VERDICT[worstVerdict(rules.map((rule) => rule.effective_verdict))]
  const estimates: Saca2Estimates = Object.assign(emptyEstimates(), ...outcomes.map((o) => o.estimates))
  const checklist = buildSaca2DocumentChecklist(inputs, figures)

  return {
    status,
    screening_label: SACA2_SCREENING_LABEL,
    findings,
    rule_results: ruleResults,
    rules,
    estimates,
    required_documents: checklist.map((item) => item.label),
    document_checklist: checklist,
    ...(status === "REDIRECT_ACA3" ? { redirect_href: buildRecommendedApplicationTypeHref("aca3") } : {}),
  }
}

/**
 * SACA-2 screening estimate (spec §4.4). Runs on in-memory answers only, logs nothing, stores nothing, and
 * never throws: any failure becomes NEEDS_REVIEW with a generic message (no answer content).
 */
export function evaluateSaca2Eligibility(
  answers: Saca2Answers,
  figures: Saca2Figures = SACA2_FIGURES,
  onDate: Date = new Date(),
  options: Saca2EvaluateOptions = {},
): Saca2EligibilityResult {
  try {
    return evaluate(answers, figures, onDate, options.policy ?? SACA2_RULE_POLICY)
  } catch {
    return saca2ScreeningFallback()
  }
}
