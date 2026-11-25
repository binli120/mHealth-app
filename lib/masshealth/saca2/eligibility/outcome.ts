/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding, EligibilityFindingLevel } from "@/lib/masshealth/types"
import type { Saca2Estimates, Saca2RuleId, Saca2RuleOutcome, Saca2RuleVerdict } from "./types"

export function finding(code: string, level: EligibilityFindingLevel, message: string): EligibilityFinding {
  return { code, level, message }
}

export function outcome(
  id: Saca2RuleId,
  verdict: Saca2RuleVerdict,
  message: string,
  findings: EligibilityFinding[] = [],
  estimates: Partial<Saca2Estimates> = {},
): Saca2RuleOutcome {
  return { id, verdict, message, findings, estimates }
}

const RANK: Record<Saca2RuleVerdict, number> = {
  notApplicable: 0,
  pass: 1,
  documents: 2,
  review: 3,
  fail: 4,
  redirect: 5,
}

export function worstVerdict(verdicts: readonly Saca2RuleVerdict[]): Saca2RuleVerdict {
  return verdicts.reduce<Saca2RuleVerdict>((worst, verdict) => (RANK[verdict] > RANK[worst] ? verdict : worst), "notApplicable")
}
