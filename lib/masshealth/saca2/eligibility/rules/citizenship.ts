/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { IMMIGRATION_STATUS_OPTIONS } from "../../questions/immigration-options"
import { finding, outcome, worstVerdict } from "../outcome"
import type { Saca2EligibilityInputs, Saca2RuleOutcome, Saca2RuleVerdict } from "../types"

const ID = "SACA2_R2_CITIZENSHIP"
/** The eligible immigration statuses printed on form p.32. */
const P32_STATUSES: ReadonlySet<string> = new Set(IMMIGRATION_STATUS_OPTIONS.map((option) => option.value))

/** Rule 2: citizenship / immigration (form Q12-13, p.32 list); proof waiver for Medicare / SSI / SSDI (form p.2). */
export function evaluateCitizenship(inputs: Saca2EligibilityInputs): Saca2RuleOutcome {
  const applicants = inputs.persons.filter((p) => p.applying)
  if (applicants.length === 0) return outcome(ID, "notApplicable", "No one is applying.")

  const verdicts: Saca2RuleVerdict[] = []
  const findings: EligibilityFinding[] = []
  for (const p of applicants) {
    const who = `Person ${p.index + 1}`
    if (p.citizen === "yes") {
      if (p.hasMedicareOrSsiOrSsdi === "yes") {
        verdicts.push("pass")
      } else {
        verdicts.push("documents")
        findings.push(finding("SACA2_CITIZENSHIP_PROOF", "info", `${who}: send proof of US citizenship and identity. People who get Medicare, SSI, or SSDI usually do not need to.`))
      }
    } else if (p.citizen === "no") {
      verdicts.push("review")
      if (p.hasEligibleImmigrationStatus === "yes" && p.immigrationStatus !== null && P32_STATUSES.has(p.immigrationStatus)) {
        findings.push(finding("SACA2_IMMIGRATION_STATUS_REVIEW", "info", `${who}: the immigration status you chose is on the form's list. MassHealth decides which coverage it allows.`))
      } else if (p.hasEligibleImmigrationStatus === "no") {
        findings.push(finding("SACA2_IMMIGRATION_LIMITED", "warning", `${who}: without an eligible immigration status, MassHealth may offer limited coverage or the Health Safety Net.`))
      } else {
        findings.push(finding("SACA2_IMMIGRATION_MISSING", "warning", `${who}: the immigration status answer is missing or not on the form's list.`))
      }
    } else {
      verdicts.push("review")
      findings.push(finding("SACA2_CITIZENSHIP_MISSING", "warning", `${who}: the citizenship question is not answered.`))
    }
  }

  const verdict = worstVerdict(verdicts)
  const message =
    verdict === "pass"
      ? "Your answers show US citizenship."
      : verdict === "documents"
        ? "Proof of citizenship and identity is needed."
        : "Citizenship or immigration status needs review."
  return outcome(ID, verdict, message, findings)
}
