/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { EligibilityFinding } from "@/lib/masshealth/types"
import { finding, outcome } from "../outcome"
import { LONG_TERM_CARE_ROUTES, determineRoutes, hasAnyRoute } from "../routes"
import type { Saca2EligibilityInputs, Saca2RuleOutcome } from "../types"

const ID = "SACA2_R1_RESIDENCY_ROUTE"
const CHILD_AGE_LIMIT = 19

/** Rule 1: Massachusetts residency (Q14 / Q24) and which SACA-2 route applies; ACA-3 redirect for child caregivers. */
export function evaluateResidencyRoute(inputs: Saca2EligibilityInputs): Saca2RuleOutcome {
  const applicants = inputs.persons.filter((p) => p.applying)
  const routes = determineRoutes(inputs)
  if (applicants.length === 0) {
    return outcome(ID, "review", "No one on this application says they are applying for coverage.", [
      finding("SACA2_NO_APPLICANT", "warning", "No one on this application says they are applying for coverage. Check the \"applying for coverage\" answers."),
    ], { routes })
  }

  const caregivers = applicants.filter((p) => p.caregiverOfChildUnder19 === "yes")
  if (caregivers.length > 0) {
    const ages = caregivers.flatMap((p) => p.childAges)
    if (ages.length > 0 && ages.every((age) => age !== null && age >= CHILD_AGE_LIMIT)) {
      return outcome(ID, "review", "The caregiver answer and the children's dates of birth disagree.", [
        finding("SACA2_CHILD_AGE_CONFLICT", "warning", "You said you care for a child under 19, but the children listed are 19 or older. Check these answers."),
      ], { routes })
    }
    if (hasAnyRoute(routes, LONG_TERM_CARE_ROUTES)) {
      return outcome(ID, "review", "A long-term-care applicant who cares for a child under 19 needs review.", [
        finding("SACA2_CAREGIVER_LONG_TERM_CARE", "warning", "You need long-term care and you care for a child under 19. MassHealth decides which application fits; you may be asked to use ACA-3."),
      ], { routes })
    }
    return outcome(ID, "redirect", "People who live with and care for a child under 19 apply with ACA-3.", [
      finding("SACA2_REDIRECT_ACA3", "warning", "You live with and care for a child under 19. People in this situation usually apply with the ACA-3 application instead of SACA-2."),
    ], { routes })
  }

  const nonResidents = applicants.filter((p) => p.resident === "no")
  if (nonResidents.length === applicants.length) {
    return outcome(ID, "fail", "No one applying lives in Massachusetts.", [
      finding("SACA2_NOT_RESIDENT", "error", "MassHealth is for people who live in Massachusetts. Based on your answers, no one applying lives here."),
    ], { routes })
  }

  const findings: EligibilityFinding[] = []
  if (nonResidents.length > 0) {
    findings.push(finding("SACA2_SOME_NOT_RESIDENT", "warning", "One person applying does not live in Massachusetts. MassHealth reviews each person."))
  }
  if (applicants.some((p) => p.resident === null)) {
    findings.push(finding("SACA2_RESIDENCY_MISSING", "warning", "The Massachusetts residency question is not answered for everyone applying."))
  }
  if (routes.length === 0) {
    findings.push(
      applicants.some((p) => p.age === null)
        ? finding("SACA2_AGE_UNKNOWN", "warning", "We need a date of birth for everyone applying to tell whether SACA-2 fits.")
        : finding("SACA2_ROUTE_UNCLEAR", "warning", "SACA-2 is for people 65 or older and people who need long-term care. If no one applying is 65 or older or needs long-term care, the ACA-3 application may fit better."),
    )
  }
  if (findings.length > 0) return outcome(ID, "review", "Residency or the application route needs review.", findings, { routes })
  return outcome(ID, "pass", "Your answers show Massachusetts residency and a SACA-2 route.", [], { routes })
}
