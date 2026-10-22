/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { completeFacilityCouple } from "../../__tests__/complete-answers"
import type { Saca2Answers } from "../../types"
import { copyFieldName } from "../page-duplication"

/** Field names of Supplements B, C and D (copy 0 = the template page, n = `__copyN`), shared by the Supplement B-D tests. */
const c = (name: string, copy = 0) => copyFieldName(name, copy)

export const B = (side: 0 | 1, copy = 0) => {
  const p = side === 0 ? "AI/AN Person 1." : "AI/AN Person 2."
  return {
    name: c(side === 0 ? `${p} Name first middle last` : `${p} Name first middle last_2`, copy),
    federal: c(`${p} Member of a federally recognized tribe?`, copy),
    federalTribe: c(side === 0 ? `${p} If Yes tribe name` : `${p} If Yes tribe name_3`, copy),
    mass: c(`${p} Member of a Massachusetts recognized tribe?`, copy),
    massTribe: c(side === 0 ? `${p} If Yes tribe name_2` : `${p} If Yes tribe name_4`, copy),
    ihs: c(`${p} Has this person ever gotten a service from programs?`, copy),
    eligible: c(`${p} If No, is this person eligible to get services?`, copy),
    amount: c(
      side === 0 ? `${p} Money from selling things that have cultural significance` : `${p} Money from selling things that have cultural significance_2`,
      copy,
    ),
    often: c(side === 0 ? `${p} How often` : `${p} How often_2`, copy),
  }
}

export const D = (copy = 0) => ({
  name: c("1. Employee name first middle last_SuppD", copy),
  ssn: Array.from({ length: 9 }, (_, i) => c(`Employee social security number_SuppD_${i + 1}`, copy)),
  eligible: c("3a Is at least one person eligible?", copy),
  employer: c("4 Employer name_SuppD", copy),
  ein: Array.from({ length: 9 }, (_, i) => c(`Federal Tax ID if known_SuppD_${i + 1}`, copy)),
  address: c("6. Employer address_SuppD", copy),
  phone: c("7. Employer phone number_SuppD", copy),
  city: c("8. City_SuppD", copy),
  state: c("9  State_SuppD", copy),
  zip: c("10.  ZIP code_suppD", copy),
  contact: c("11. Who can we contact about employee heath coverage at this job?_SuppD", copy),
  minValue14: c("14. Does the employer offer a health plan that meets the minimum value standard*?", copy),
  premium14: c("14c. How much would this employee pay in premiums for this plan?", copy),
  often14: c("14d. How often would the employee pay this amount?", copy),
  plan15: c("15a.   What is the name of the lowest cost self-only health plan offered to the employee?", copy),
  minValue15: c("15b. Does the health plan offered by the employer meet the minimum value standard for coverage?", copy),
  premium15: c("15c. How much does the employee have to pay in premiums for the lowest cost plan that meets the minimum value standard", copy),
  often15: c("15d. Only tell us about the cost of the individual selfonly health plans not the cost of a family health plan", copy),
  end16a: c("16a. Employer will not offer health coverage. Coverage end date (mm/dd/yyyy)", copy),
  end16b: c("16b. Date of change_SuppD", copy),
  premium16: c("16c. individual cost", copy),
  often16: c("16c. How often?", copy),
  date16: c("16c. Date of change_SuppD", copy),
})

export const GRID = ["mobility", "medications", "bathing", "dressing", "rangeOfMotion", "eating", "toileting"] as const

export const C = (copy = 0) => ({
  last: c("Last name_SuppC", copy),
  first: c("First name_SuppC", copy),
  phone: c("Telephone number_SuppC", copy),
  ssn: c("Social security number_SuppC", copy),
  dob: c("Date of birth mmddyyyy_SuppC", copy),
  gender: c("Gender_SuppC", copy),
  street: c("Street address_SuppC", copy),
  city: c("City_SuppC", copy),
  state: c("State_SuppC", copy),
  zip: c("ZIP_SuppC", copy),
  health: [1, 2, 3].map((n) => c(`SuppC_Health info_${n}`, copy)),
  yes: GRID.map((_, i) => c(`Do you need hands-on help?_${i + 1}`, copy)),
  times: GRID.map((_, i) => c(i === 0 ? "How many times a day do you need handson help" : `How many times a day do you need handson help_${i + 1}`, copy)),
  days: GRID.map((_, i) => c(i === 0 ? "How many days a week do you need handson help" : `How many days a week do you need handson help_${i + 1}`, copy)),
  cgName: [c("Caregiver name_SuppC", copy), c("Caregiver name_SuppC_2", copy)],
  cgRel: [c("Relationship to you_SuppC", copy), c("Relationship to you_SuppC_2", copy)],
})

export const member = (n: number, over: Record<string, unknown> = {}) => ({
  name: `Member ${n}`,
  federallyRecognizedTribe: "yes" as const,
  tribeName: `Tribe ${n}`,
  massRecognizedTribe: "yes" as const,
  massTribeName: `Mass Tribe ${n}`,
  receivedIhsService: "no" as const,
  eligibleForIhs: "yes" as const,
  excludedIncomeAmount: 100 + n,
  excludedIncomeFrequency: "monthly" as const,
  ...over,
})

export const job = (n: number, over: Record<string, unknown> = {}) => ({
  employeeName: `Employee ${n}`,
  employeeSsn: `12345678${n}`,
  eligibleWithinThreeMonths: "yes" as const,
  waitingPeriodEnds: null,
  employerName: `Employer ${n}`,
  employerFederalTaxId: `98-765432${n}`,
  employerAddress: `${n} Work Rd`,
  employerCity: "Testville",
  employerState: "MA",
  employerZip: "02101",
  employerPhone: "6175550100",
  contactName: `HR ${n}`,
  contactPhone: "6175550102",
  contactEmail: `hr${n}@example.test`,
  individualPlanName: `Plan ${n}`,
  individualMeetsMinimumValue: "yes" as const,
  individualPremium: 10 * n,
  individualPremiumFrequency: "weekly" as const,
  familyPlanName: `Family ${n}`,
  familyMeetsMinimumValue: "no" as const,
  familyPremium: 20 * n + 0.5,
  familyPremiumFrequency: "yearly" as const,
  upcomingChange: "none" as const,
  changeEndDate: null,
  changePremium: null,
  changePremiumFrequency: null,
  changeDate: null,
  ...over,
})

const needs = (n: number) => ({ needsHandsOnHelp: "yes" as const, timesPerDay: n, daysPerWeek: n + 1 })
const noHelp = { needsHandsOnHelp: "no" as const, timesPerDay: null, daysPerWeek: null }

/** A married couple, nursing facility off, the PCA chain Yes for both: both get a Supplement C. */
export function coupleBoth(): Saca2Answers {
  const a = completeFacilityCouple()
  a.supplements.a.needsNursingFacility = "no"
  a.intake.programs.longTermCare = false
  a.intake.programs.hcbsWaiver = true
  a.supplements.a.applyingHcbsWaiver = "yes"
  a.pca.needsPca = "yes"
  a.pca.paidByMassHealthLastSixMonths = "no"
  a.pca.byPerson[0] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
  a.pca.byPerson[1] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
  for (const [i, n] of [[0, 1], [1, 2]] as const) {
    const s = a.supplements.c[i]
    s.healthProblems = [`Problem ${n}a`, `Problem ${n}b`, ""]
    for (const key of GRID) s.activities[key] = { ...noHelp }
    s.activities.eating = needs(n)
    s.caregivers = [{ name: `Helper ${n}`, relationship: `kin ${n}` }, { name: `Helper ${n}b`, relationship: "friend" }]
  }
  a.persons[1].mobilePhone = "6175550199"
  return a
}
