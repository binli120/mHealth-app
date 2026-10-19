/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2EligibilityInputs, Saca2Route } from "./types"

const SENIOR_AGE = 65

export const LONG_TERM_CARE_ROUTES: readonly Saca2Route[] = ["nursingFacility", "hcbsWaiver", "pace"]

export function hasAnyRoute(routes: readonly Saca2Route[], wanted: readonly Saca2Route[]): boolean {
  return wanted.some((route) => routes.includes(route))
}

/** The SACA-2 target populations (spec §3.1, EOM 26-03) that the visible answers place the application in. */
export function determineRoutes(inputs: Saca2EligibilityInputs): Saca2Route[] {
  const applicants = inputs.persons.filter((p) => p.applying)
  const s = inputs.suppA
  const routes: Saca2Route[] = []
  if (applicants.some((p) => p.age !== null && p.age >= SENIOR_AGE)) routes.push("senior")
  if (inputs.programs.longTermCare || s?.needsNursingFacility === "yes") routes.push("nursingFacility")
  if (inputs.programs.hcbsWaiver || s?.applyingHcbsWaiver === "yes") routes.push("hcbsWaiver")
  if (s?.applyingPace === "yes") routes.push("pace")
  const [p1, p2] = inputs.persons
  if (
    inputs.hasSpouse &&
    p2 !== undefined &&
    p1.applying &&
    p2.applying &&
    p2.livesWithPerson1 === "yes" &&
    p1.age !== null &&
    p2.age !== null &&
    p1.age >= SENIOR_AGE !== p2.age >= SENIOR_AGE &&
    inputs.persons.every((p) => p.caregiverOfChildUnder19 !== "yes")
  ) {
    routes.push("mixedAgeCouple")
  }
  if (inputs.screening.disabledAndWorkingQualifies === "yes") routes.push("disabledWorking")
  if (inputs.screening.commonHealthTenYears === "yes") routes.push("commonHealthTenYears")
  return routes
}
