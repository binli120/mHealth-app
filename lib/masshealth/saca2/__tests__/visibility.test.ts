/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"
import { getVisibleSteps, isPersonBlank, isStepVisible } from "@/lib/masshealth/saca2/visibility"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

describe("always-visible steps", () => {
  it("shows the core steps for a blank application and nothing conditional", () => {
    expect(getVisibleSteps(answers(), ON)).toEqual([
      "intake",
      "person1",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "signature",
    ])
  })
})

describe("person2", () => {
  it("is hidden for a single applicant and shown when a second person has data", () => {
    expect(isStepVisible("person2", answers(), ON)).toBe(false)
    expect(
      isStepVisible(
        "person2",
        answers((a) => a.persons.push({ ...emptySaca2Person(), firstName: "Dorothy" })),
        ON,
      ),
    ).toBe(true)
  })

  it("is shown when Person 1 says they are legally married", () => {
    expect(
      isStepVisible("person2", answers((a) => (a.persons[0].isLegallyMarried = "yes")), ON),
    ).toBe(true)
  })

  it("is hidden for a blank second person when Person 1 is not married", () => {
    for (const married of [null, "no"] as const) {
      const a = answers((x) => {
        x.persons[0].isLegallyMarried = married
        x.persons.push(emptySaca2Person())
      })
      expect(isStepVisible("person2", a, ON)).toBe(false)
      expect(getVisibleSteps(a, ON)).not.toContain("person2")
    }
  })

  it("is shown for a blank second person when Person 1 is married", () => {
    const a = answers((x) => {
      x.persons[0].isLegallyMarried = "yes"
      x.persons.push(emptySaca2Person())
    })
    expect(isStepVisible("person2", a, ON)).toBe(true)
  })

  it("stays shown for a second person with data even when Person 1 is not married", () => {
    const a = answers((x) => {
      x.persons[0].isLegallyMarried = "no"
      x.persons.push({ ...emptySaca2Person(), lastName: "Testcase" })
    })
    expect(isStepVisible("person2", a, ON)).toBe(true)
  })

  it("is hidden when Person 1 is not married and there is no second person", () => {
    expect(isStepVisible("person2", answers((a) => (a.persons[0].isLegallyMarried = "no")), ON)).toBe(false)
  })
})

describe("isPersonBlank", () => {
  it("is true for a fresh empty person", () => {
    expect(isPersonBlank(emptySaca2Person())).toBe(true)
  })

  it("ignores object key order and rewrites to the same value", () => {
    const p = emptySaca2Person()
    const reordered = Object.fromEntries(Object.entries(p).reverse()) as typeof p
    reordered.firstName = ""
    expect(isPersonBlank(reordered)).toBe(true)
  })

  it("is false for any changed field, including nested income rows", () => {
    expect(isPersonBlank({ ...emptySaca2Person(), firstName: "A" })).toBe(false)
    expect(isPersonBlank({ ...emptySaca2Person(), dateOfBirth: "1950-01-01" })).toBe(false)
    expect(isPersonBlank({ ...emptySaca2Person(), noHomeAddress: true })).toBe(false)
    expect(
      isPersonBlank({
        ...emptySaca2Person(),
        income: [{ kind: "socialSecurity", amount: 1, frequency: "monthly" }],
      }),
    ).toBe(false)
  })
})

describe("pca (Step 8)", () => {
  it("shows for a 65+ applicant not entering a facility", () => {
    const a = answers((x) => (x.persons[0].dateOfBirth = "1961-10-13"))
    expect(isStepVisible("pca", a, ON)).toBe(true)
  })

  it("shows when only Person 2 is 65+ (the form asks about 'you' and 'your spouse')", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "1966-01-01"
      const p2 = emptySaca2Person()
      p2.dateOfBirth = "1956-01-01"
      x.persons.push(p2)
    })
    expect(isStepVisible("pca", a, ON)).toBe(true)
  })

  it("hides when neither person is 65+ or the only 65+ DOB is unknown", () => {
    const young = answers((x) => {
      x.persons[0].dateOfBirth = "1966-01-01"
      const p2 = emptySaca2Person()
      p2.dateOfBirth = "1970-01-01"
      x.persons.push(p2)
    })
    expect(isStepVisible("pca", young, ON)).toBe(false)
    const unknown = answers((x) => {
      x.persons[0].dateOfBirth = "1966-01-01"
      x.persons.push(emptySaca2Person())
    })
    expect(isStepVisible("pca", unknown, ON)).toBe(false)
  })

  it("hides for under 65, unknown/invalid DOB, facility applicants, and LTC applicants", () => {
    expect(isStepVisible("pca", answers((x) => (x.persons[0].dateOfBirth = "1961-10-14")), ON)).toBe(false)
    expect(isStepVisible("pca", answers(), ON)).toBe(false)
    expect(isStepVisible("pca", answers((x) => (x.persons[0].dateOfBirth = "garbage")), ON)).toBe(false)
    expect(
      isStepVisible(
        "pca",
        answers((x) => {
          x.persons[0].dateOfBirth = "1950-01-01"
          x.supplements.a.needsNursingFacility = "yes"
        }),
        ON,
      ),
    ).toBe(false)
    expect(
      isStepVisible(
        "pca",
        answers((x) => {
          x.persons[0].dateOfBirth = "1950-01-01"
          x.intake.programs.longTermCare = true
        }),
        ON,
      ),
    ).toBe(false)
  })
})

describe("additionalCoverage (Step 9)", () => {
  function couple(p1Dob: string | null, p2Dob: string | null, mutate: (a: Saca2Answers) => void = () => {}) {
    return answers((a) => {
      a.persons[0].dateOfBirth = p1Dob
      a.persons[0].isLegallyMarried = "yes"
      const p2 = emptySaca2Person()
      p2.dateOfBirth = p2Dob
      p2.livesWithPerson1 = "yes"
      a.persons.push(p2)
      mutate(a)
    })
  }

  it("shows for a married 65+/under-65 couple living together with no child under 19", () => {
    expect(isStepVisible("additionalCoverage", couple("1955-01-01", "1970-01-01"), ON)).toBe(true)
    expect(isStepVisible("additionalCoverage", couple("1970-01-01", "1955-01-01"), ON)).toBe(true)
  })

  it("hides when both are 65+, both under 65, or either age is unknown", () => {
    expect(isStepVisible("additionalCoverage", couple("1950-01-01", "1955-01-01"), ON)).toBe(false)
    expect(isStepVisible("additionalCoverage", couple("1970-01-01", "1975-01-01"), ON)).toBe(false)
    expect(isStepVisible("additionalCoverage", couple("1950-01-01", null), ON)).toBe(false)
  })

  it("hides when someone is the caregiver of a child under 19, or the second person does not live with Person 1", () => {
    expect(
      isStepVisible(
        "additionalCoverage",
        couple("1955-01-01", "1970-01-01", (a) => (a.persons[1].caregiverOfChildUnder19 = "yes")),
        ON,
      ),
    ).toBe(false)
    expect(
      isStepVisible(
        "additionalCoverage",
        couple("1955-01-01", "1970-01-01", (a) => (a.persons[1].livesWithPerson1 = "no")),
        ON,
      ),
    ).toBe(false)
  })

  it("hides for a single applicant", () => {
    expect(isStepVisible("additionalCoverage", answers((a) => (a.persons[0].dateOfBirth = "1950-01-01")), ON)).toBe(false)
  })
})

describe("suppA", () => {
  it("shows for any long-term-care signal and never for an unanswered form", () => {
    expect(isStepVisible("suppA", answers(), ON)).toBe(false)
    expect(isStepVisible("suppA", answers((a) => (a.intake.programs.longTermCare = true)), ON)).toBe(true)
    expect(isStepVisible("suppA", answers((a) => (a.intake.programs.hcbsWaiver = true)), ON)).toBe(true)
    expect(isStepVisible("suppA", answers((a) => (a.supplements.a.needsNursingFacility = "yes")), ON)).toBe(true)
    expect(isStepVisible("suppA", answers((a) => (a.supplements.a.applyingHcbsWaiver = "yes")), ON)).toBe(true)
    expect(isStepVisible("suppA", answers((a) => (a.supplements.a.applyingPace = "yes")), ON)).toBe(true)
  })

  it('treats "no" and null as not triggering', () => {
    expect(isStepVisible("suppA", answers((a) => (a.supplements.a.needsNursingFacility = "no")), ON)).toBe(false)
  })
})

describe("supplements B, C, D and attachments", () => {
  it("suppB follows the AI/AN screen", () => {
    expect(isStepVisible("suppB", answers((a) => (a.aian.anyMember = "yes")), ON)).toBe(true)
    expect(isStepVisible("suppB", answers((a) => (a.aian.anyMember = "no")), ON)).toBe(false)
    expect(isStepVisible("suppB", answers(), ON)).toBe(false)
  })

  it("suppC needs PCA, no MassHealth-paid PCA in 6 months, and one person who answered yes to all three", () => {
    const base = (mutate: (a: Saca2Answers) => void) =>
      answers((a) => {
        a.pca.needsPca = "yes"
        a.pca.paidByMassHealthLastSixMonths = "no"
        a.pca.byPerson = [
          { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" },
        ]
        mutate(a)
      })
    expect(isStepVisible("suppC", base(() => {}), ON)).toBe(true)
    expect(isStepVisible("suppC", base((a) => (a.pca.paidByMassHealthLastSixMonths = "yes")), ON)).toBe(false)
    expect(isStepVisible("suppC", base((a) => (a.pca.byPerson[0].willContactPcmAgency = "no")), ON)).toBe(false)
    expect(isStepVisible("suppC", base((a) => (a.pca.byPerson[0].permanentDisability = null)), ON)).toBe(false)
    expect(isStepVisible("suppC", base((a) => (a.pca.needsPca = "no")), ON)).toBe(false)
  })

  it("suppD follows employer coverage", () => {
    expect(isStepVisible("suppD", answers((a) => (a.health.employerOfferedCoverage = "yes")), ON)).toBe(true)
    expect(isStepVisible("suppD", answers((a) => (a.health.enrolledInEmployerCoverage = true)), ON)).toBe(true)
    expect(isStepVisible("suppD", answers(), ON)).toBe(false)
  })

  it("ARD appears only when an authorized representative signs", () => {
    expect(isStepVisible("ard", answers((a) => (a.signature.signedBy = "authorizedRepresentative")), ON)).toBe(true)
    expect(isStepVisible("ard", answers((a) => (a.signature.signedBy = "applicant")), ON)).toBe(false)
    expect(isStepVisible("ard", answers(), ON)).toBe(false)
  })

  it("IRS 4506 appears only when returns were filed but copies were not kept", () => {
    const f = (filed: "bothYears" | "oneYear" | "neither" | null, copies: "yes" | "no" | null) =>
      answers((a) => {
        a.supplements.a.taxReturnsFiled = filed
        a.supplements.a.hasCopiesOfTaxReturns = copies
      })
    expect(isStepVisible("irs4506", f("bothYears", "no"), ON)).toBe(true)
    expect(isStepVisible("irs4506", f("oneYear", "no"), ON)).toBe(true)
    expect(isStepVisible("irs4506", f("bothYears", "yes"), ON)).toBe(false)
    expect(isStepVisible("irs4506", f("neither", "no"), ON)).toBe(false)
    expect(isStepVisible("irs4506", f(null, null), ON)).toBe(false)
  })
})
