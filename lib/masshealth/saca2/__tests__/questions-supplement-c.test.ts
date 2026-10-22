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
  mutate(a)
  return a
}

const qualifies = (index: 0 | 1) => (a: Saca2Answers) => {
  a.pca.needsPca = "yes"
  a.pca.paidByMassHealthLastSixMonths = "no"
  a.pca.byPerson[index] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
}

const withSpouse = (a: Saca2Answers) => {
  a.persons[0].isLegallyMarried = "yes"
  a.persons.push({ ...emptySaca2Person(), firstName: "Walter" })
}

const ACTIVITIES = ["mobility", "medications", "bathing", "dressing", "rangeOfMotion", "eating", "toileting"] as const

describe("suppC step", () => {
  it("asks nothing of a person who does not qualify", () => {
    expect(validateStep("suppC", answers(), ON)).toEqual({})
    const stale = answers((a) => {
      a.pca.needsPca = "yes"
      a.pca.paidByMassHealthLastSixMonths = "yes"
      a.pca.byPerson[0] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
    })
    expect(validateStep("suppC", stale, ON)).toEqual({})
  })

  it("requires the first health problem and the seven activity answers for Person 1", () => {
    const errors = validateStep("suppC", answers(qualifies(0)), ON)
    expect(Object.keys(errors).sort()).toEqual(
      [
        "supplements.c.0.healthProblems.0",
        ...ACTIVITIES.map((activity) => `supplements.c.0.activities.${activity}.needsHandsOnHelp`),
      ].sort(),
    )
  })

  it("asks how often only for activities that need hands-on help, and checks the ranges", () => {
    const a = answers((x) => {
      qualifies(0)(x)
      x.supplements.c[0].healthProblems = ["Arthritis", "", ""]
      for (const activity of ACTIVITIES) x.supplements.c[0].activities[activity].needsHandsOnHelp = "no"
      x.supplements.c[0].activities.bathing.needsHandsOnHelp = "yes"
    })
    expect(Object.keys(validateStep("suppC", a, ON)).sort()).toEqual([
      "supplements.c.0.activities.bathing.daysPerWeek",
      "supplements.c.0.activities.bathing.timesPerDay",
    ])
    a.supplements.c[0].activities.bathing.timesPerDay = 0
    a.supplements.c[0].activities.bathing.daysPerWeek = 8
    expect(validateStep("suppC", a, ON)).toEqual({
      "supplements.c.0.activities.bathing.daysPerWeek": "Enter a whole number from 1 to 7.",
      "supplements.c.0.activities.bathing.timesPerDay": "Enter a whole number from 1 to 20.",
    })
    a.supplements.c[0].activities.bathing.timesPerDay = 2
    a.supplements.c[0].activities.bathing.daysPerWeek = 7
    expect(validateStep("suppC", a, ON)).toEqual({})
  })

  it("validates caregiver rows when present", () => {
    const a = answers((x) => {
      qualifies(0)(x)
      x.supplements.c[0].healthProblems = ["Arthritis", "", ""]
      for (const activity of ACTIVITIES) x.supplements.c[0].activities[activity].needsHandsOnHelp = "no"
      x.supplements.c[0].caregivers = [{ name: "", relationship: "" }]
    })
    expect(Object.keys(validateStep("suppC", a, ON)).sort()).toEqual([
      "supplements.c.0.caregivers.0.name",
      "supplements.c.0.caregivers.0.relationship",
    ])
  })

  it("asks the spouse's block only when the spouse qualifies and Person 2 exists", () => {
    const spouseOnly = answers(qualifies(1))
    expect(validateStep("suppC", spouseOnly, ON)).toEqual({})
    const real = answers((x) => {
      withSpouse(x)
      qualifies(1)(x)
    })
    expect(validateStep("suppC", real, ON)["supplements.c.1.healthProblems.0"]).toBe("This question is required.")
    const blankHidden = answers((x) => {
      x.persons.push(emptySaca2Person())
      qualifies(1)(x)
    })
    expect(validateStep("suppC", blankHidden, ON)).toEqual({})
  })

  it("shows both blocks for a couple who both qualify", () => {
    const a = answers((x) => {
      withSpouse(x)
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "no"
      x.pca.byPerson[0] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
      x.pca.byPerson[1] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
    })
    const keys = Object.keys(validateStep("suppC", a, ON))
    expect(keys.some((k) => k.startsWith("supplements.c.0."))).toBe(true)
    expect(keys.some((k) => k.startsWith("supplements.c.1."))).toBe(true)
  })
})

describe("suppC question wording", () => {
  const labels = () => {
    const content = getStepContent("suppC")!
    const out: Record<string, string> = {}
    for (const section of content.sections) {
      for (const q of section.questions) out[q.path] = q.label as string
    }
    return out
  }

  it("is grammatical for both people and pins the key labels", () => {
    const l = labels()
    expect(l["supplements.c.0.activities.bathing.needsHandsOnHelp"]).toBe(
      "Do you need hands-on help from another person with bathing (tub, bed bath, shower, or washing chair) or general grooming (like brushing teeth or combing hair)?",
    )
    expect(l["supplements.c.1.activities.bathing.needsHandsOnHelp"]).toBe(
      "Does your spouse need hands-on help from another person with bathing (tub, bed bath, shower, or washing chair) or general grooming (like brushing teeth or combing hair)?",
    )
    expect(l["supplements.c.0.activities.bathing.timesPerDay"]).toBe("How many times a day do you need hands-on help with bathing or grooming?")
    expect(l["supplements.c.1.activities.bathing.timesPerDay"]).toBe("How many times a day does your spouse need hands-on help with bathing or grooming?")
    expect(l["supplements.c.1.activities.eating.daysPerWeek"]).toBe("How many days a week does your spouse need hands-on help with eating?")
    expect(l["supplements.c.0.healthProblems.0"]).toBe("List and describe your medical and mental health problems (including anything that makes it hard to do daily living activities, even if you are not getting treatment)")
    for (const label of Object.values(l)) {
      expect(label).not.toMatch(/\bDo your spouse\b/)
      expect(label).not.toMatch(/\bdoes you\b/i)
    }
  })

  it("has the same question set for both people", () => {
    const paths = Object.keys(labels())
    const zero = paths.filter((p) => p.startsWith("supplements.c.0.")).map((p) => p.replace("supplements.c.0.", ""))
    const one = paths.filter((p) => p.startsWith("supplements.c.1.")).map((p) => p.replace("supplements.c.1.", ""))
    expect(zero.sort()).toEqual(one.sort())
  })
})
