/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { calculateAge } from "./age"
import { SACA2_STEPS, type Saca2StepId } from "./schema"
import type { Saca2Answers } from "./types"

const SENIOR_AGE = 65

function ageOf(answers: Saca2Answers, index: number, on: Date): number | null {
  return calculateAge(answers.persons[index]?.dateOfBirth, on)
}

/** Step 8 asks about "you" and "your spouse", so any 65+ person on the application qualifies. */
function showsPca(a: Saca2Answers, on: Date): boolean {
  const someoneSenior = a.persons.some((_, i) => {
    const age = ageOf(a, i, on)
    return age !== null && age >= SENIOR_AGE
  })
  return (
    someoneSenior &&
    a.supplements.a.needsNursingFacility !== "yes" &&
    !a.intake.programs.longTermCare
  )
}

function showsAdditionalCoverage(a: Saca2Answers, on: Date): boolean {
  if (a.persons.length < 2) return false
  const age1 = ageOf(a, 0, on)
  const age2 = ageOf(a, 1, on)
  if (age1 === null || age2 === null) return false
  const oneSenior = (age1 >= SENIOR_AGE) !== (age2 >= SENIOR_AGE)
  if (!oneSenior) return false
  const livesTogether = a.persons[1].livesWithPerson1 === "yes" || a.persons[0].isLegallyMarried === "yes"
  if (!livesTogether || a.persons[1].livesWithPerson1 === "no") return false
  return a.persons.every((p) => p.caregiverOfChildUnder19 !== "yes")
}

function showsSuppA(a: Saca2Answers): boolean {
  const { programs } = a.intake
  const s = a.supplements.a
  return (
    programs.longTermCare ||
    programs.hcbsWaiver ||
    s.needsNursingFacility === "yes" ||
    s.applyingHcbsWaiver === "yes" ||
    s.applyingPace === "yes"
  )
}

function showsSuppC(a: Saca2Answers): boolean {
  if (a.pca.needsPca !== "yes" || a.pca.paidByMassHealthLastSixMonths === "yes") return false
  return a.pca.byPerson.some(
    (p) =>
      p.permanentDisability === "yes" &&
      p.disabilityBlocksAdls === "yes" &&
      p.willContactPcmAgency === "yes",
  )
}

export function isStepVisible(id: Saca2StepId, answers: Saca2Answers, on: Date = new Date()): boolean {
  switch (id) {
    case "intake":
    case "person1":
    case "aian":
    case "previousBills":
    case "assets":
    case "healthInsurance":
    case "hra":
    case "signature":
      return true
    case "person2":
      return answers.persons.length > 1 || answers.persons[0]?.isLegallyMarried === "yes"
    case "pca":
      return showsPca(answers, on)
    case "additionalCoverage":
      return showsAdditionalCoverage(answers, on)
    case "suppA":
      return showsSuppA(answers)
    case "suppB":
      return answers.aian.anyMember === "yes"
    case "suppC":
      return showsSuppC(answers)
    case "suppD":
      return answers.health.employerOfferedCoverage === "yes" || answers.health.enrolledInEmployerCoverage
    case "ard":
      return answers.signature.signedBy === "authorizedRepresentative"
    case "irs4506": {
      const s = answers.supplements.a
      return (s.taxReturnsFiled === "bothYears" || s.taxReturnsFiled === "oneYear") && s.hasCopiesOfTaxReturns === "no"
    }
  }
}

export function getVisibleSteps(answers: Saca2Answers, on: Date = new Date()): Saca2StepId[] {
  return SACA2_STEPS.filter((s) => isStepVisible(s.id, answers, on)).map((s) => s.id)
}
