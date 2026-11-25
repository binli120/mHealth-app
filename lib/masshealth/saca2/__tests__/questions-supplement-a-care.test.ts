/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

/** Errors for suppA whose key equals or sits under one of the prefixes (later tasks add other sections). */
function errs(a: Saca2Answers, ...prefixes: string[]): Record<string, string> {
  const all = validateStep("suppA", a, ON)
  return Object.fromEntries(Object.entries(all).filter(([key]) => prefixes.some((p) => key === p || key.startsWith(`${p}.`))))
}

const INTRO = ["supplements.a.needsNursingFacility", "supplements.a.applyingHcbsWaiver", "supplements.a.applyingPace"]
const FACILITY = "supplements.a.facility"
const SPOUSE_COSTS = ["supplements.a.spouseMonthlyExpenses", "supplements.a.familyAtHome"]

const withSpouse = (a: Saca2Answers) => {
  a.persons[0].isLegallyMarried = "yes"
  a.persons.push({ ...emptySaca2Person(), firstName: "Dorothy" })
}

describe("Supplement A: intro", () => {
  it("requires the three program questions", () => {
    expect(Object.keys(errs(answers(), ...INTRO)).sort()).toEqual([...INTRO].sort())
  })

  it("is satisfied by three answers", () => {
    const a = answers((x) => {
      x.supplements.a.needsNursingFacility = "no"
      x.supplements.a.applyingHcbsWaiver = "yes"
      x.supplements.a.applyingPace = "no"
    })
    expect(errs(a, ...INTRO)).toEqual({})
  })
})

describe("Supplement A: facility", () => {
  const nursing = (x: Saca2Answers) => (x.supplements.a.needsNursingFacility = "yes")

  it("is not asked unless a nursing-home-type facility is needed, even with stale answers", () => {
    const a = answers((x) => {
      x.supplements.a.needsNursingFacility = "no"
      x.supplements.a.facility.placedByOtherState = "yes"
    })
    expect(errs(a, FACILITY)).toEqual({})
  })

  it("requires the facility details for a nursing-facility applicant", () => {
    expect(Object.keys(errs(answers(nursing), FACILITY)).sort()).toEqual([
      "supplements.a.facility.address",
      "supplements.a.facility.admissionDate",
      "supplements.a.facility.name",
      "supplements.a.facility.paysGuardianshipExpenses",
      "supplements.a.facility.placedByOtherState",
    ])
  })

  it("asks which state only when placed by another state", () => {
    const a = answers((x) => {
      nursing(x)
      x.supplements.a.facility = {
        name: "Example Nursing Home",
        address: "5 Elm St",
        admissionDate: "2026-09-01",
        placedByOtherState: "yes",
        placedFromState: "",
        paysGuardianshipExpenses: "no",
      }
    })
    expect(errs(a, FACILITY)).toEqual({ "supplements.a.facility.placedFromState": "This question is required." })
    a.supplements.a.facility.placedFromState = "NH"
    expect(errs(a, FACILITY)).toEqual({})
  })
})

describe("Supplement A: spouse living expenses and family at home", () => {
  const nursing = (x: Saca2Answers) => (x.supplements.a.needsNursingFacility = "yes")

  it("is not asked of an HCBS/PACE applicant or someone with no spouse", () => {
    const hcbs = answers((x) => {
      x.supplements.a.needsNursingFacility = "no"
      x.supplements.a.applyingHcbsWaiver = "yes"
      withSpouse(x)
    })
    expect(errs(hcbs, ...SPOUSE_COSTS)).toEqual({})
    const single = answers(nursing)
    expect(errs(single, ...SPOUSE_COSTS)).toEqual({})
  })

  it("does not treat a blank hidden second person as a spouse", () => {
    const a = answers((x) => {
      nursing(x)
      x.persons.push(emptySaca2Person())
    })
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({})
  })

  it("asks heat, utilities, and the family question when a spouse is at home", () => {
    const a = answers((x) => {
      nursing(x)
      withSpouse(x)
    })
    expect(Object.keys(errs(a, ...SPOUSE_COSTS)).sort()).toEqual([
      "supplements.a.familyAtHome.hasFamily",
      "supplements.a.spouseMonthlyExpenses.paysHeat",
      "supplements.a.spouseMonthlyExpenses.paysUtilities",
    ])
  })

  it("requires family rows when family lives with the spouse, and validates each row", () => {
    const a = answers((x) => {
      nursing(x)
      withSpouse(x)
      x.supplements.a.spouseMonthlyExpenses.paysHeat = "yes"
      x.supplements.a.spouseMonthlyExpenses.paysUtilities = "yes"
      x.supplements.a.familyAtHome.hasFamily = "yes"
    })
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({ "supplements.a.familyAtHome.members": "Add at least one." })
    a.supplements.a.familyAtHome.members = [{ name: "", ssn: "", relationship: "", dateOfBirth: null, monthlyIncome: null }]
    expect(Object.keys(errs(a, ...SPOUSE_COSTS)).sort()).toEqual([
      "supplements.a.familyAtHome.members.0.dateOfBirth",
      "supplements.a.familyAtHome.members.0.monthlyIncome",
      "supplements.a.familyAtHome.members.0.name",
      "supplements.a.familyAtHome.members.0.relationship",
    ])
    a.supplements.a.familyAtHome.members = [
      { name: "Test Child", ssn: "", relationship: "child", dateOfBirth: "1980-02-01", monthlyIncome: 1200 },
    ]
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({})
  })

  it("accepts blank monthly amounts but rejects a negative one", () => {
    const a = answers((x) => {
      nursing(x)
      withSpouse(x)
      x.supplements.a.spouseMonthlyExpenses.paysHeat = "no"
      x.supplements.a.spouseMonthlyExpenses.paysUtilities = "no"
      x.supplements.a.familyAtHome.hasFamily = "no"
      x.supplements.a.spouseMonthlyExpenses.rent = 1200
    })
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({})
    a.supplements.a.spouseMonthlyExpenses.mortgage = -1
    expect(errs(a, ...SPOUSE_COSTS)).toEqual({
      "supplements.a.spouseMonthlyExpenses.mortgage": "Enter a number that is 0 or more.",
    })
  })
})
