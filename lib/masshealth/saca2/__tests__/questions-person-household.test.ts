/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { ACCOMMODATION_KEYS, ACCOMMODATION_CONDITION_KEYS } from "@/lib/masshealth/saca2/demographic-options"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers, type CaregiverChild } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")
const REQ = "This question is required."
const SELECT_ONE = "Select at least one."
const BABIES = "Enter a whole number from 1 to 10."

const FIELDS = [
  "caregiverChildren",
  "pregnant",
  "babiesExpected",
  "dueDate",
  "everInFosterCare",
  "fosterCareState",
  "fosterCareMedicaid",
  "rentOrOwn",
  "needsAccommodation",
  "accommodationConditions",
  "accommodationConditionOther",
  "accommodations",
  "accommodationOther",
]

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0].applyingForCoverage = "yes"
  mutate(a)
  return a
}

/** Two persons; Person 2 is the subject of index-1 tests. */
function twoPeople(applyingP2: "yes" | "no", mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = answers()
  const p2 = emptySaca2Person()
  p2.applyingForCoverage = applyingP2
  a.persons.push(p2)
  mutate(a)
  return a
}

function errsFor(step: "person1" | "person2", idx: number, a: Saca2Answers): Record<string, string> {
  const prefixes = FIELDS.map((f) => `persons.${idx}.${f}`)
  return Object.fromEntries(
    Object.entries(validateStep(step, a, ON)).filter(([k]) => prefixes.some((pre) => k === pre || k.startsWith(`${pre}.`))),
  )
}
const errs = (a: Saca2Answers) => errsFor("person1", 0, a)
const keys = (a: Saca2Answers) => Object.keys(errs(a)).sort()
const p = (...k: string[]) => k.map((x) => `persons.0.${x}`).sort()

const BASE = ["pregnant", "everInFosterCare", "rentOrOwn", "needsAccommodation"]

describe("household questions (Q15-18, Q20)", () => {
  it("asks four questions of an empty applying person", () => {
    expect(keys(answers())).toEqual(p(...BASE))
  })

  it("asks only the accommodation question of a person who is not applying", () => {
    const a = answers((x) => (x.persons[0].applyingForCoverage = "no"))
    expect(keys(a)).toEqual(p("needsAccommodation"))
  })

  it("asks only the accommodation question of a non-applying Person 2", () => {
    const a = twoPeople("no")
    expect(Object.keys(errsFor("person2", 1, a)).sort()).toEqual(["persons.1.needsAccommodation"])
  })

  it("asks all four questions of an applying Person 2", () => {
    const a = twoPeople("yes")
    expect(Object.keys(errsFor("person2", 1, a)).sort()).toEqual(
      ["pregnant", "everInFosterCare", "rentOrOwn", "needsAccommodation"].map((k) => `persons.1.${k}`).sort(),
    )
  })

  describe("child caregiver", () => {
    it("is not asked unless the person cares for a child under 19", () => {
      const a = answers((x) => (x.persons[0].caregiverOfChildUnder19 = "no"))
      expect(errs(a)["persons.0.caregiverChildren"]).toBeUndefined()
    })

    it("requires a child list and validates each row when the answer is yes", () => {
      const a = answers((x) => (x.persons[0].caregiverOfChildUnder19 = "yes"))
      expect(errs(a)["persons.0.caregiverChildren"]).toBe("Add at least one.")
      a.persons[0].caregiverChildren = [{ name: "", dateOfBirth: null }]
      expect(keys(a)).toEqual(p(...BASE, "caregiverChildren.0.name", "caregiverChildren.0.dateOfBirth"))
      a.persons[0].caregiverChildren = [{ name: "Kid Testcase", dateOfBirth: "2015-05-05" }]
      expect(keys(a)).toEqual(p(...BASE))
    })

    it("is not asked of a non-applying person even if the flag is stale", () => {
      const a = answers((x) => {
        x.persons[0].applyingForCoverage = "no"
        x.persons[0].caregiverOfChildUnder19 = "yes"
      })
      expect(errs(a)["persons.0.caregiverChildren"]).toBeUndefined()
    })

    it("configures the repeater with an empty row and a limit of six", () => {
      const section = getStepContent("person1")!.sections.find((s) => s.id === "household")!
      const q = section.questions.find((x) => x.path === "caregiverChildren")!
      expect(q.repeater!.maxItems).toBe(6)
      expect(q.repeater!.emptyItem()).toEqual(({ name: "", dateOfBirth: null }) satisfies CaregiverChild)
    })
  })

  describe("pregnancy", () => {
    const preg = (mutate: (a: Saca2Answers) => void = () => {}) =>
      answers((x) => {
        x.persons[0].pregnant = "yes"
        mutate(x)
      })

    it("asks for the number of babies and due date when pregnant", () => {
      expect(keys(preg())).toEqual(p("babiesExpected", "dueDate", "everInFosterCare", "rentOrOwn", "needsAccommodation"))
    })

    it.each([0, 11, 1.5])("rejects %s babies", (n) => {
      expect(errs(preg((a) => (a.persons[0].babiesExpected = n)))["persons.0.babiesExpected"]).toBe(BABIES)
    })

    it.each([1, 2, 10])("accepts %s babies", (n) => {
      expect(errs(preg((a) => (a.persons[0].babiesExpected = n)))["persons.0.babiesExpected"]).toBeUndefined()
    })

    it("clears the follow-ups when the answer is no", () => {
      const a = preg()
      a.persons[0].pregnant = "no"
      expect(keys(a)).toEqual(p("everInFosterCare", "rentOrOwn", "needsAccommodation"))
    })
  })

  describe("foster care", () => {
    const foster = (mutate: (a: Saca2Answers) => void = () => {}) =>
      answers((x) => {
        x.persons[0].everInFosterCare = "yes"
        mutate(x)
      })

    it("asks for the state and Medicaid when yes", () => {
      expect(keys(foster())).toEqual(p("pregnant", "fosterCareState", "fosterCareMedicaid", "rentOrOwn", "needsAccommodation"))
    })

    it("rejects an invalid state code and accepts a valid one", () => {
      expect(errs(foster((a) => (a.persons[0].fosterCareState = "Mass")))["persons.0.fosterCareState"]).toBe("Enter the 2-letter state code.")
      expect(errs(foster((a) => (a.persons[0].fosterCareState = "MA")))["persons.0.fosterCareState"]).toBeUndefined()
    })

    it("does not ask the follow-ups when no", () => {
      const a = foster()
      a.persons[0].everInFosterCare = "no"
      expect(keys(a)).toEqual(p("pregnant", "rentOrOwn", "needsAccommodation"))
    })
  })

  describe("rent or own", () => {
    it("accepts rent and own and rejects other values", () => {
      expect(errs(answers((a) => (a.persons[0].rentOrOwn = "rent")))["persons.0.rentOrOwn"]).toBeUndefined()
      expect(errs(answers((a) => (a.persons[0].rentOrOwn = "own")))["persons.0.rentOrOwn"]).toBeUndefined()
      expect(errs(answers((a) => ((a.persons[0] as { rentOrOwn: string }).rentOrOwn = "lease")))["persons.0.rentOrOwn"]).toBeTruthy()
    })
  })

  describe("accommodations", () => {
    const acc = (mutate: (a: Saca2Answers) => void = () => {}) =>
      answers((x) => {
        x.persons[0].needsAccommodation = "yes"
        mutate(x)
      })
    const FIRST_COND = `persons.0.accommodationConditions.${ACCOMMODATION_CONDITION_KEYS[0]}`
    const FIRST_ACC = `persons.0.accommodations.${ACCOMMODATION_KEYS[0]}`

    it("requires at least one condition and one accommodation when yes", () => {
      const e = errs(acc())
      expect(e[FIRST_COND]).toBe(SELECT_ONE)
      expect(e[FIRST_ACC]).toBe(SELECT_ONE)
    })

    it("clears each error once one box in that group is ticked", () => {
      const a = acc((x) => (x.persons[0].accommodationConditions.blind = true))
      expect(errs(a)[FIRST_COND]).toBeUndefined()
      expect(errs(a)[FIRST_ACC]).toBe(SELECT_ONE)
      a.persons[0].accommodations.braille = true
      expect(keys(a)).toEqual(p("pregnant", "everInFosterCare", "rentOrOwn"))
    })

    it("requires a description when 'other' is ticked in either group", () => {
      const a = acc((x) => {
        x.persons[0].accommodationConditions.other = true
        x.persons[0].accommodations.other = true
      })
      const e = errs(a)
      expect(e["persons.0.accommodationConditionOther"]).toBe(REQ)
      expect(e["persons.0.accommodationOther"]).toBe(REQ)
      a.persons[0].accommodationConditionOther = "Chronic pain"
      a.persons[0].accommodationOther = "Quiet room"
      expect(errs(a)["persons.0.accommodationConditionOther"]).toBeUndefined()
      expect(errs(a)["persons.0.accommodationOther"]).toBeUndefined()
    })

    it("drops every sub-question when flipped back to no", () => {
      const a = acc((x) => (x.persons[0].accommodationConditions.other = true))
      a.persons[0].needsAccommodation = "no"
      expect(keys(a)).toEqual(p("pregnant", "everInFosterCare", "rentOrOwn"))
    })

    it("asks a non-applying person the sub-questions too", () => {
      const a = answers((x) => {
        x.persons[0].applyingForCoverage = "no"
        x.persons[0].needsAccommodation = "yes"
      })
      const e = errs(a)
      expect(e[FIRST_COND]).toBe(SELECT_ONE)
      expect(e[FIRST_ACC]).toBe(SELECT_ONE)
      expect(Object.keys(e)).toHaveLength(2)
    })

    it("asks a non-applying Person 2 the sub-questions too", () => {
      const a = twoPeople("no", (x) => (x.persons[1].needsAccommodation = "yes"))
      expect(Object.keys(errsFor("person2", 1, a)).sort()).toEqual(
        [`persons.1.accommodationConditions.${ACCOMMODATION_CONDITION_KEYS[0]}`, `persons.1.accommodations.${ACCOMMODATION_KEYS[0]}`].sort(),
      )
    })

    it("generates one checkbox per condition and accommodation", () => {
      const section = getStepContent("person1")!.sections.find((s) => s.id === "household")!
      const paths = section.questions.map((q) => q.path)
      for (const k of ACCOMMODATION_CONDITION_KEYS) expect(paths).toContain(`accommodationConditions.${k}`)
      for (const k of ACCOMMODATION_KEYS) expect(paths).toContain(`accommodations.${k}`)
    })
  })

  describe("wording", () => {
    const label = (path: string, idx: number) => {
      const section = getStepContent(idx === 0 ? "person1" : "person2")!.sections.find((s) => s.id === "household")!
      const q = section.questions.find((x) => x.path === path)!
      const a = twoPeople("yes")
      const ctx = { answers: a, personIndex: idx, on: ON }
      return typeof q.label === "function" ? q.label(ctx) : q.label
    }

    it("uses first person for Person 1 and third person for Person 2", () => {
      expect(label("needsAccommodation", 0)).toBe("Do you need reasonable accommodation(s) because of a disability or injury?")
      expect(label("needsAccommodation", 1)).toBe("Does this person need reasonable accommodation(s) because of a disability or injury?")
      expect(label("pregnant", 0)).toBe("Are you pregnant?")
      expect(label("pregnant", 1)).toBe("Is this person pregnant?")
      expect(label("everInFosterCare", 0)).toBe("Were you ever in foster care?")
      expect(label("everInFosterCare", 1)).toBe("Was this person ever in foster care?")
      expect(label("rentOrOwn", 0)).toBe("Do you rent or own your property?")
      expect(label("rentOrOwn", 1)).toBe("Does this person rent or own their property?")
    })
  })
})
