/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")
const REQ = "This question is required."

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0].applyingForCoverage = "yes"
  mutate(a)
  return a
}

const KEYS = [
  "nameMatchesSsnCard",
  "ssnCardName",
  "isLprCheCofa",
  "immigrationStatusDate",
  "immigrationCountry",
  "immigrationSameName",
  "immigrationOtherName",
  "arrivedAfterAug1996",
  "isVeteranOrMilitaryFamily",
  "isTraffickingOrBatteredVictim",
].map((k) => `persons.0.${k}`)

function errs(a: Saca2Answers): Record<string, string> {
  return Object.fromEntries(Object.entries(validateStep("person1", a, ON)).filter(([k]) => KEYS.includes(k)))
}

describe("SSN card name", () => {
  it("is not asked unless the person has an SSN", () => {
    expect(errs(answers((a) => (a.persons[0].hasSsn = "no")))).toEqual({})
  })

  it("requires the yes/no when the person has an SSN, and the card name only when the names differ", () => {
    const a = answers((x) => (x.persons[0].hasSsn = "yes"))
    expect(errs(a)).toEqual({ "persons.0.nameMatchesSsnCard": REQ })
    a.persons[0].nameMatchesSsnCard = "no"
    expect(errs(a)).toEqual({ "persons.0.ssnCardName": REQ })
    a.persons[0].ssnCardName = "Edna M Testcase"
    expect(errs(a)).toEqual({})
  })

  it("ignores a stale card name after the answer flips to yes", () => {
    const a = answers((x) => {
      x.persons[0].hasSsn = "yes"
      x.persons[0].nameMatchesSsnCard = "yes"
      x.persons[0].ssnCardName = ""
    })
    expect(errs(a)).toEqual({})
  })
})

describe("immigration details", () => {
  const noncitizen = (a: Saca2Answers) => (a.persons[0].usCitizenOrNational = "no")

  it("asks nothing extra of a citizen or of someone not applying", () => {
    expect(errs(answers((a) => (a.persons[0].usCitizenOrNational = "yes")))).toEqual({})
    expect(errs(answers((a) => {
      noncitizen(a)
      a.persons[0].applyingForCoverage = "no"
    }))).toEqual({})
  })

  it("requires 13c-e for a noncitizen without an eligible status", () => {
    const a = answers((x) => {
      noncitizen(x)
      x.persons[0].hasEligibleImmigrationStatus = "no"
    })
    expect(Object.keys(errs(a)).sort()).toEqual([
      "persons.0.arrivedAfterAug1996",
      "persons.0.immigrationSameName",
      "persons.0.isVeteranOrMilitaryFamily",
    ])
  })

  it("also requires 13a when the person has an eligible status, but never the date, country, or trafficking question", () => {
    const a = answers((x) => {
      noncitizen(x)
      x.persons[0].hasEligibleImmigrationStatus = "yes"
      x.persons[0].immigrationSameName = "yes"
      x.persons[0].arrivedAfterAug1996 = "no"
      x.persons[0].isVeteranOrMilitaryFamily = "no"
    })
    expect(errs(a)).toEqual({ "persons.0.isLprCheCofa": REQ })
    a.persons[0].isLprCheCofa = "yes"
    expect(errs(a)).toEqual({})
  })

  it("requires the other name only when the name differs", () => {
    const a = answers((x) => {
      noncitizen(x)
      x.persons[0].hasEligibleImmigrationStatus = "no"
      x.persons[0].immigrationSameName = "no"
      x.persons[0].arrivedAfterAug1996 = "no"
      x.persons[0].isVeteranOrMilitaryFamily = "no"
    })
    expect(errs(a)).toEqual({ "persons.0.immigrationOtherName": REQ })
  })

  it("ignores answers left behind after the person becomes a citizen", () => {
    const a = answers((x) => {
      x.persons[0].usCitizenOrNational = "yes"
      x.persons[0].immigrationSameName = "no"
      x.persons[0].isLprCheCofa = null
    })
    expect(errs(a)).toEqual({})
  })

  it("words Person 2's labels in the third person", () => {
    const content = getStepContent("person2")!
    const q = content.sections.flatMap((s) => s.questions).find((x) => x.path === "immigrationSameName")!
    const label = (personIndex: number) =>
      typeof q.label === "function" ? q.label({ answers: answers(), personIndex, on: ON }) : q.label
    expect(label(0)).toBe("Did you use the same name on this application that you did to get your immigration status?")
    expect(label(1)).toBe("Did this person use the same name on this application that they used to get their immigration status?")
  })
})
