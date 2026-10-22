/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { ACCOMMODATION_LABELS } from "@/lib/masshealth/saca2/demographic-options"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { resolveText } from "@/lib/masshealth/saca2/questions/types"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function twoPeople(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0].applyingForCoverage = "yes"
  const p2 = emptySaca2Person()
  p2.applyingForCoverage = "yes"
  a.persons.push(p2)
  mutate(a)
  return a
}

const stepOf = (idx: number) => (idx === 0 ? "person1" : "person2")
const ctx = (idx: number, a: Saca2Answers = twoPeople(), item?: Record<string, unknown>) => ({
  answers: a,
  personIndex: idx,
  on: ON,
  item,
})
const sectionById = (idx: number, id: string) => getStepContent(stepOf(idx))!.sections.find((s) => s.id === id)!
const titleOf = (idx: number, id: string) => resolveText(sectionById(idx, id).title, ctx(idx))
const descOf = (idx: number, id: string) => resolveText(sectionById(idx, id).description, ctx(idx))

describe("checkbox groups carry the form's question text", () => {
  it("titles the demographics sections for Person 1 and Person 2", () => {
    expect(titleOf(0, "demographics")).toBe("Which best describes your current gender identity? Select up to five options.")
    expect(titleOf(1, "demographics")).toBe("Which best describes this person's current gender identity? Select up to five options.")
    expect(titleOf(0, "demographicsOrientation")).toBe("Which of these describes your current sexual orientation? Select up to five options.")
    expect(titleOf(1, "demographicsOrientation")).toBe("Which of these describes this person's current sexual orientation? Select up to five options.")
    expect(titleOf(0, "demographicsRace")).toBe("Race")
    expect(titleOf(1, "demographicsRace")).toBe("Race")
    expect(titleOf(0, "demographicsEthnicity")).toBe("Ethnicity")
    expect(titleOf(1, "demographicsEthnicity")).toBe("Ethnicity")
    expect(titleOf(0, "demographicsOrigin")).toBe("Hispanic or Latino origin")
  })

  it("keeps the optional-demographics intro on the first section only, and gives each group its form explanation", () => {
    expect(descOf(0, "demographics")).toMatch(/MassHealth is committed to providing equitable care/)
    for (const id of ["demographicsOrientation", "demographicsOrigin", "demographicsRace", "demographicsEthnicity"]) {
      expect(descOf(0, id)).not.toMatch(/MassHealth is committed/)
    }
    expect(descOf(0, "demographicsRace")).toMatch(/self-identification with one or more social groups/)
    expect(descOf(0, "demographicsEthnicity")).toMatch(/background, heritage, culture, ancestry/)
    expect(descOf(0, "demographicsOrientation")).toMatch(/physical and\/or emotional attraction/)
    expect(descOf(0, "demographicsOrigin")).toMatch(/Cuban, Mexican, Puerto Rican/)
  })

  it("titles the household accommodation groups as on the form", () => {
    for (const idx of [0, 1]) {
      expect(titleOf(idx, "accommodationConditions")).toBe("Condition")
      expect(titleOf(idx, "accommodationTypes")).toBe("Accommodation")
    }
  })

  it("never leaves a checkbox in a section without a non-empty title", () => {
    for (const idx of [0, 1]) {
      const sections = getStepContent(stepOf(idx))!.sections.filter((s) =>
        ["demographics", "demographicsOrientation", "demographicsOrigin", "demographicsRace", "demographicsEthnicity", "household", "accommodationConditions", "accommodationTypes"].includes(s.id),
      )
      expect(sections.length).toBe(8)
      for (const s of sections) {
        expect(resolveText(s.title, ctx(idx)).trim()).not.toBe("")
      }
      const boxes = getStepContent(stepOf(idx))!.sections.filter((s) => s.questions.some((q) => q.kind === "checkbox"))
      for (const s of boxes) expect(resolveText(s.title, ctx(idx)).trim()).not.toBe("")
    }
  })

  it("keeps section ids unique within the step", () => {
    const ids = getStepContent("person1")!.sections.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("explains the seasonal month checkboxes", () => {
    const row = (idx: number) =>
      getStepContent(stepOf(idx))!.sections
        .find((s) => s.id === "income")!
        .questions.find((q) => q.path === "income")!
        .repeater!.questions.find((q) => q.path === "seasonal")!
    const item = { kind: "wages" }
    expect(resolveText(row(0).help, ctx(0, twoPeople(), item))).toBe("If Yes, check each month you work in a calendar year.")
    expect(resolveText(row(1).help, ctx(1, twoPeople(), item))).toBe("If Yes, check each month this person works in a calendar year.")
  })

  it("uses the form's wording for the CART accommodation", () => {
    expect(ACCOMMODATION_LABELS.cart).toBe("Communication Access Real-time Translations (CART)")
  })
})

describe("immigration details follow citizenship", () => {
  it("drops the status/document questions once the person is a citizen", () => {
    const a = twoPeople((x) => {
      x.persons[0].usCitizenOrNational = "no"
      x.persons[0].hasEligibleImmigrationStatus = "yes"
      x.persons[0].usCitizenOrNational = "yes"
    })
    const errors = validateStep("person1", a, ON)
    const keys = Object.keys(errors).filter((k) => /immigration(Status|Document)/.test(k))
    expect(keys).toEqual([])
  })

  it("still requires them for a noncitizen with an eligible status", () => {
    const a = twoPeople((x) => {
      x.persons[0].usCitizenOrNational = "no"
      x.persons[0].hasEligibleImmigrationStatus = "yes"
    })
    const keys = Object.keys(validateStep("person1", a, ON))
    expect(keys).toContain("persons.0.immigrationStatus")
    expect(keys).toContain("persons.0.immigrationDocumentType")
  })
})

describe("income wording for a really-second person", () => {
  const rowQ = (idx: number, path: string) =>
    getStepContent(stepOf(idx))!.sections
      .find((s) => s.id === "income")!
      .questions.find((q) => q.path === "income")!
      .repeater!.questions.find((q) => q.path === path)!

  it("words the self-employment type-of-work question per person", () => {
    const item = { kind: "selfEmployment" }
    expect(resolveText(rowQ(0, "description").label, ctx(0, twoPeople(), item))).toBe("What type of work do you do?")
    expect(resolveText(rowQ(1, "description").label, ctx(1, twoPeople(), item))).toBe("What type of work does this person do?")
  })

  it("words the monthly net income help per person", () => {
    const item = { kind: "selfEmployment" }
    expect(resolveText(rowQ(0, "amount").help, ctx(0, twoPeople(), item))).toMatch(/^Net income is your profit after business expenses/)
    expect(resolveText(rowQ(1, "amount").help, ctx(1, twoPeople(), item))).toMatch(/^Net income is this person's profit after business expenses/)
  })
})
