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

const withSpouse = (a: Saca2Answers) => {
  a.persons[0].isLegallyMarried = "yes"
  a.persons.push({ ...emptySaca2Person(), firstName: "Walter" })
}

describe("pca step", () => {
  it("requires the opening question", () => {
    expect(validateStep("pca", answers(), ON)).toEqual({ "pca.needsPca": "This question is required." })
  })

  it("is complete when no personal-care attendant is needed", () => {
    expect(validateStep("pca", answers((a) => (a.pca.needsPca = "no")), ON)).toEqual({})
  })

  it("asks whether MassHealth paid for PCA services in the last six months", () => {
    expect(validateStep("pca", answers((a) => (a.pca.needsPca = "yes")), ON)).toEqual({
      "pca.paidByMassHealthLastSixMonths": "This question is required.",
    })
  })

  it("skips the disability questions when MassHealth already paid for PCA services", () => {
    const a = answers((x) => {
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "yes"
    })
    expect(validateStep("pca", a, ON)).toEqual({})
  })

  it("walks Person 1 through the three chained questions", () => {
    const base = (x: Saca2Answers) => {
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "no"
    }
    expect(validateStep("pca", answers(base), ON)).toEqual({ "pca.byPerson.0.permanentDisability": "This question is required." })

    const blocks = answers((x) => {
      base(x)
      x.pca.byPerson[0].permanentDisability = "yes"
    })
    expect(validateStep("pca", blocks, ON)).toEqual({ "pca.byPerson.0.disabilityBlocksAdls": "This question is required." })

    const contact = answers((x) => {
      base(x)
      x.pca.byPerson[0].permanentDisability = "yes"
      x.pca.byPerson[0].disabilityBlocksAdls = "yes"
    })
    expect(validateStep("pca", contact, ON)).toEqual({ "pca.byPerson.0.willContactPcmAgency": "This question is required." })

    const done = answers((x) => {
      base(x)
      x.pca.byPerson[0].permanentDisability = "yes"
      x.pca.byPerson[0].disabilityBlocksAdls = "yes"
      x.pca.byPerson[0].willContactPcmAgency = "yes"
    })
    expect(validateStep("pca", done, ON)).toEqual({})
  })

  it("stops the chain when an earlier answer is no, ignoring stale later answers", () => {
    const a = answers((x) => {
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "no"
      x.pca.byPerson[0].permanentDisability = "no"
      x.pca.byPerson[0].disabilityBlocksAdls = null
    })
    expect(validateStep("pca", a, ON)).toEqual({})
  })

  it("asks the spouse's questions only when Person 2 exists", () => {
    const base = (x: Saca2Answers) => {
      x.pca.needsPca = "yes"
      x.pca.paidByMassHealthLastSixMonths = "no"
      x.pca.byPerson[0].permanentDisability = "no"
    }
    // Single applicant: no spouse questions.
    expect(validateStep("pca", answers(base), ON)).toEqual({})
    // A blank Person 2 that is hidden: still no spouse questions.
    const blankSecond = answers((x) => {
      base(x)
      x.persons.push(emptySaca2Person())
    })
    expect(validateStep("pca", blankSecond, ON)).toEqual({})
    // A real spouse: asked.
    const married = answers((x) => {
      base(x)
      withSpouse(x)
    })
    expect(validateStep("pca", married, ON)).toEqual({ "pca.byPerson.1.permanentDisability": "This question is required." })
  })
})

describe("additionalCoverage step", () => {
  it("is optional: nothing is required on an empty form", () => {
    expect(validateStep("additionalCoverage", answers(), ON)).toEqual({})
  })

  it("asks for a name when either condition is answered yes", () => {
    const a = answers((x) => {
      x.health.additionalCoverage.breastOrCervicalCancer = "yes"
      x.health.additionalCoverage.hivPositive = "yes"
    })
    expect(Object.keys(validateStep("additionalCoverage", a, ON)).sort()).toEqual([
      "health.additionalCoverage.breastOrCervicalName",
      "health.additionalCoverage.hivName",
    ])
    a.health.additionalCoverage.breastOrCervicalName = "Pat"
    a.health.additionalCoverage.hivName = "Pat"
    expect(validateStep("additionalCoverage", a, ON)).toEqual({})
  })

  it("does not ask for names when the answers are no", () => {
    const a = answers((x) => {
      x.health.additionalCoverage.breastOrCervicalCancer = "no"
      x.health.additionalCoverage.hivPositive = "no"
    })
    expect(validateStep("additionalCoverage", a, ON)).toEqual({})
  })
})

describe("pca question wording", () => {
  const labels = () => {
    const content = getStepContent("pca")
    const out: Record<string, string> = {}
    for (const section of content?.sections ?? [])
      for (const q of section.questions) if (q.path.startsWith("pca.byPerson.")) out[q.path] = q.label as string
    return out
  }

  it("pins the exact, grammatical labels for both people", () => {
    expect(labels()).toEqual({
      "pca.byPerson.0.permanentDisability": "Do you have a permanent or long-lasting disability?",
      "pca.byPerson.0.disabilityBlocksAdls":
        "Does your disability keep you from being able to do daily living activities, like bathing, eating, toileting, and dressing, unless someone physically helps you?",
      "pca.byPerson.0.willContactPcmAgency":
        "Do you plan to contact a MassHealth personal-care-management (PCM) agency to ask for personal-care-attendant services?",
      "pca.byPerson.1.permanentDisability": "Does your spouse have a permanent or long-lasting disability?",
      "pca.byPerson.1.disabilityBlocksAdls":
        "Does your spouse's disability keep your spouse from being able to do daily living activities, like bathing, eating, toileting, and dressing, unless someone physically helps your spouse?",
      "pca.byPerson.1.willContactPcmAgency":
        "Does your spouse plan to contact a MassHealth personal-care-management (PCM) agency to ask for personal-care-attendant services?",
    })
    for (const label of Object.values(labels())) expect(label).not.toMatch(/\bDo your spouse\b/)
  })
})
