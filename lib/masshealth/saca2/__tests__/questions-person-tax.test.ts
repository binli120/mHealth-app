/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers, type TaxDependent } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")
const REQ = "This question is required."

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0].applyingForCoverage = "yes"
  mutate(a)
  return a
}

function errs(a: Saca2Answers): Record<string, string> {
  return Object.fromEntries(Object.entries(validateStep("person1", a, ON)).filter(([k]) => k.startsWith("persons.0.tax.")))
}
const keys = (a: Saca2Answers) => Object.keys(errs(a)).sort()
const p = (...k: string[]) => k.map((x) => `persons.0.tax.${x}`).sort()

const BASE = ["agreesToFileIfAptc", "claimedAsDependent", "filingSeparatelyAbuse"]
/** BASE once the "agrees" question has been answered. */
const ANSWERED = ["claimedAsDependent", "filingSeparatelyAbuse"]

describe("tax filing questions", () => {
  it("are not asked of a person who is not applying", () => {
    expect(errs(answers((a) => (a.persons[0].applyingForCoverage = "no")))).toEqual({})
  })

  it("asks three questions of an empty applying person", () => {
    expect(keys(answers())).toEqual(p(...BASE))
  })

  it("asks 11d and 11e even when the person does not agree to file", () => {
    const a = answers((x) => (x.persons[0].tax.agreesToFileIfAptc = "no"))
    expect(keys(a)).toEqual(p("claimedAsDependent", "filingSeparatelyAbuse"))
  })

  it("asks whether dependents are claimed once the person agrees to file", () => {
    const a = answers((x) => (x.persons[0].tax.agreesToFileIfAptc = "yes"))
    expect(keys(a)).toEqual(p(...ANSWERED, "claimsDependents"))
    expect(errs(a)["persons.0.tax.claimsDependents"]).toBe(REQ)
  })

  it("asks for the spouse and joint-return plan only when married", () => {
    const a = answers((x) => {
      x.persons[0].tax.agreesToFileIfAptc = "yes"
      x.persons[0].isLegallyMarried = "yes"
    })
    expect(keys(a)).toEqual(p(...ANSWERED, "claimsDependents", "spouseName", "spouseDateOfBirth", "plansJointReturn"))
  })

  it("requires a dependent list when dependents are claimed, and validates each row", () => {
    const a = answers((x) => {
      x.persons[0].tax.agreesToFileIfAptc = "yes"
      x.persons[0].tax.claimsDependents = "yes"
    })
    expect(errs(a)["persons.0.tax.dependents"]).toBe("Add at least one.")
    a.persons[0].tax.dependents = [{ name: "", dateOfBirth: null }]
    expect(keys(a)).toEqual(p(...ANSWERED, "dependents.0.name", "dependents.0.dateOfBirth"))
    a.persons[0].tax.dependents = [{ name: "Kid Testcase", dateOfBirth: "2015-05-05" }]
    expect(keys(a)).toEqual(p(...ANSWERED))
  })

  it("configures the dependents repeater with an empty row and a limit of six", () => {
    const section = getStepContent("person1")!.sections.find((s) => s.id === "tax")!
    const q = section.questions.find((x) => x.path === "tax.dependents")!
    expect(q.repeater!.maxItems).toBe(6)
    expect(q.repeater!.emptyItem()).toEqual(({ name: "", dateOfBirth: null }) satisfies TaxDependent)
  })

  it("asks for the tax filer when the person will be claimed as a dependent", () => {
    const a = answers((x) => (x.persons[0].tax.claimedAsDependent = "yes"))
    expect(keys(a)).toEqual(
      p("agreesToFileIfAptc", "filingSeparatelyAbuse", "taxFiler.name", "taxFiler.dateOfBirth", "taxFiler.relationship", "taxFiler.marriedFilingJointly"),
    )
  })

  it("asks for the tax filer's spouse only when the filer files jointly, and never requires other dependents", () => {
    const a = answers((x) => {
      x.persons[0].tax.agreesToFileIfAptc = "no"
      x.persons[0].tax.claimedAsDependent = "yes"
      x.persons[0].tax.filingSeparatelyAbuse = "no"
      x.persons[0].tax.taxFiler = {
        ...x.persons[0].tax.taxFiler,
        name: "Pat Filer",
        dateOfBirth: "1975-01-01",
        relationship: "parent",
        marriedFilingJointly: "yes",
      }
    })
    expect(keys(a)).toEqual(p("taxFiler.spouseName", "taxFiler.spouseDateOfBirth"))
    a.persons[0].tax.taxFiler.spouseName = "Sam Filer"
    a.persons[0].tax.taxFiler.spouseDateOfBirth = "1976-02-02"
    expect(keys(a)).toEqual([])
  })

  describe("filedForAptcYears attestation", () => {
    const q = (step: "person1" | "person2") =>
      getStepContent(step)!.sections.find((s) => s.id === "tax")!.questions.find((x) => x.path === "tax.filedForAptcYears")!
    const ctx = (personIndex: number, applyingValue: "yes" | "no" = "yes") => {
      const a = answers((x) => (x.persons[0].applyingForCoverage = applyingValue))
      return { answers: a, personIndex, on: ON }
    }

    it("is shown to an applying Person 1 and never required", () => {
      expect(q("person1").visibleWhen!(ctx(0))).toBe(true)
      expect(q("person1").visibleWhen!(ctx(0, "no"))).toBe(false)
      expect(q("person1").required).toBeFalsy()
      expect(keys(answers())).not.toContain("persons.0.tax.filedForAptcYears")
    })

    it("is never shown for Person 2", () => {
      const c = ctx(1)
      const second = emptySaca2Person()
      second.applyingForCoverage = "yes"
      c.answers.persons.push(second)
      expect(q("person2").visibleWhen!(c)).toBe(false)
    })

    it("uses the form's wording", () => {
      expect(q("person1").label).toBe(
        "I filed a federal income tax return with the Internal Revenue Service (IRS) for each year in the past two years that I received an Advance Premium Tax Credit (APTC) to lower my monthly premium payment, including if I was enrolled in ConnectorCare. I included the tax forms showing the tax credits I received when I filed my tax return so the IRS could calculate how much Advance Premium Tax Credit I was eligible to receive based on my final income for the year.",
      )
    })
  })

  describe("stale answers", () => {
    it("are ignored after agreesToFileIfAptc flips to no", () => {
      const a = answers((x) => {
        const t = x.persons[0].tax
        x.persons[0].isLegallyMarried = "yes"
        t.agreesToFileIfAptc = "no"
        t.claimedAsDependent = "no"
        t.filingSeparatelyAbuse = "no"
        t.claimsDependents = "yes"
        t.dependents = [{ name: "", dateOfBirth: null }]
        t.spouseName = ""
      })
      expect(keys(a)).toEqual([])
    })

    it("are ignored after claimsDependents flips to no", () => {
      const a = answers((x) => {
        const t = x.persons[0].tax
        t.agreesToFileIfAptc = "yes"
        t.claimsDependents = "no"
        t.claimedAsDependent = "no"
        t.filingSeparatelyAbuse = "no"
        t.dependents = [{ name: "", dateOfBirth: null }]
      })
      expect(keys(a)).toEqual([])
    })

    it("are ignored after the tax filer's marriedFilingJointly flips to no", () => {
      const a = answers((x) => {
        const t = x.persons[0].tax
        t.agreesToFileIfAptc = "no"
        t.claimedAsDependent = "yes"
        t.filingSeparatelyAbuse = "no"
        t.taxFiler = { ...t.taxFiler, name: "Pat Filer", dateOfBirth: "1975-01-01", relationship: "parent", marriedFilingJointly: "no", spouseName: "", spouseDateOfBirth: null }
      })
      expect(keys(a)).toEqual([])
    })

    it("are ignored after claimedAsDependent flips to no", () => {
      const a = answers((x) => {
        const t = x.persons[0].tax
        t.agreesToFileIfAptc = "no"
        t.claimedAsDependent = "no"
        t.filingSeparatelyAbuse = "no"
        t.taxFiler.marriedFilingJointly = "yes"
      })
      expect(keys(a)).toEqual([])
    })
  })

  it("words Person 2's questions in the third person", () => {
    const section = getStepContent("person2")!.sections.find((s) => s.id === "tax")!
    const ctx1 = { answers: answers(), personIndex: 1, on: ON }
    const ctx0 = { ...ctx1, personIndex: 0 }
    const label = (path: string, ctx: typeof ctx1) => {
      const q = section.questions.find((x) => x.path === path)!
      return typeof q.label === "function" ? q.label(ctx) : q.label
    }
    expect(label("tax.plansJointReturn", ctx1)).toBe(
      "Does this person plan to file a joint federal tax return with a spouse for the tax year for which this person is applying?",
    )
    expect(label("tax.plansJointReturn", ctx0)).toBe(
      "Do you plan to file a joint federal tax return with your spouse for the tax year for which you are applying?",
    )
    expect(label("tax.claimedAsDependent", ctx1)).toBe(
      "Will this person be claimed as a dependent on someone else's federal income tax return for the year for which this person is applying?",
    )
    expect(label("tax.claimedAsDependent", ctx0)).toBe(
      "Will you be claimed as a dependent on someone else's federal income tax return for the year for which you are applying?",
    )
  })
})
