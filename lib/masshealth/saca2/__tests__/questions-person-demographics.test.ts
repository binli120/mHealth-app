/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0].applyingForCoverage = "yes"
  mutate(a)
  return a
}

/** Errors for person1 whose key sits under `persons.0.demographics`. */
function errs(a: Saca2Answers, prefix = "persons.0.demographics"): Record<string, string> {
  return Object.fromEntries(Object.entries(validateStep("person1", a, ON)).filter(([k]) => k.startsWith(prefix)))
}

describe("person demographics (optional)", () => {
  it("asks nothing required, even when applying", () => {
    expect(errs(answers())).toEqual({})
  })

  it("is not shown to someone who is not applying", () => {
    const content = getStepContent("person1")!
    const section = content.sections.find((s) => s.id === "demographics")!
    const ctx = { answers: answers((a) => (a.persons[0].applyingForCoverage = "no")), personIndex: 0, on: ON }
    expect(section.questions.every((q) => q.visibleWhen?.(ctx) === false)).toBe(true)
  })

  it("lets a person tick up to five gender identities and rejects six", () => {
    const five = answers((a) => {
      for (const k of ["male", "female", "transMan", "transWoman", "nonbinary"] as const) a.persons[0].demographics.genderIdentity[k] = true
    })
    expect(errs(five)).toEqual({})
    five.persons[0].demographics.genderIdentity.declined = true
    expect(errs(five)).toEqual({ "persons.0.demographics.genderIdentity.male": "Select up to five options." })
  })

  it("applies the same five-option cap to sexual orientation", () => {
    const six = answers((a) => {
      for (const k of ["straight", "gayOrLesbian", "bisexual", "queerPansexual", "dontKnow", "declined"] as const) a.persons[0].demographics.sexualOrientation[k] = true
    })
    expect(errs(six)).toEqual({ "persons.0.demographics.sexualOrientation.straight": "Select up to five options." })
  })

  it("asks for the written description only when 'not listed' is ticked", () => {
    const a = answers((x) => (x.persons[0].demographics.genderIdentity.notListed = true))
    expect(errs(a)).toEqual({ "persons.0.demographics.genderIdentityOther": "This question is required." })
    a.persons[0].demographics.genderIdentityOther = "Two-spirit"
    expect(errs(a)).toEqual({})
    a.persons[0].demographics.genderIdentity.notListed = false
    a.persons[0].demographics.genderIdentityOther = ""
    expect(errs(a)).toEqual({})
  })

  it.each([
    ["sexualOrientation", "sexualOrientationOther"],
    ["race", "raceOther"],
    ["ethnicity", "ethnicityOther"],
  ] as const)("requires a description for %s only when 'not listed' is ticked", (group, other) => {
    const a = answers((x) => ((x.persons[0].demographics[group] as Record<string, boolean>).notListed = true))
    expect(errs(a)).toEqual({ [`persons.0.demographics.${other}`]: "This question is required." })
  })

  it("words Person 2's questions in the third person", () => {
    const content = getStepContent("person2")!
    const section = content.sections.find((s) => s.id === "demographics")!
    const ctx = { answers: answers(), personIndex: 1, on: ON }
    const label = (path: string) => {
      const q = section.questions.find((x) => x.path === path)!
      return typeof q.label === "function" ? q.label(ctx) : q.label
    }
    expect(label("demographics.hispanicOrLatino")).toBe("Is this person of Hispanic or Latino origin or descent?")
    const ctx0 = { ...ctx, personIndex: 0 }
    const q = section.questions.find((x) => x.path === "demographics.hispanicOrLatino")!
    expect(typeof q.label === "function" ? q.label(ctx0) : q.label).toBe("Are you of Hispanic or Latino origin or descent?")
  })
})
