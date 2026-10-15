/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

const RESPONSIBLE_REQUIRED = [
  "signing.responsibleParty.city",
  "signing.responsibleParty.dateOfBirth",
  "signing.responsibleParty.firstName",
  "signing.responsibleParty.lastName",
  "signing.responsibleParty.phone",
  "signing.responsibleParty.relationship",
  "signing.responsibleParty.street",
  "signing.responsibleParty.zip",
]

describe("signature step", () => {
  it("still requires who signs", () => {
    expect(validateStep("signature", answers(), ON)).toEqual({ "signature.signedBy": "This question is required." })
  })

  it("needs nothing else for an adult applicant who signs", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "applicant"
    })
    expect(validateStep("signature", a, ON)).toEqual({})
  })

  it("does not ask the minor questions when the date of birth is unknown", () => {
    const a = answers((x) => (x.signature.signedBy = "applicant"))
    expect(validateStep("signature", a, ON)).toEqual({})
  })

  it("asks about emancipation when Person 1 is under 18", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "2012-05-01"
      x.signature.signedBy = "applicant"
    })
    expect(validateStep("signature", a, ON)).toEqual({ "signing.emancipatedMinor": "This question is required." })
  })

  it("requires a responsible party for a non-emancipated minor", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "2012-05-01"
      x.signature.signedBy = "responsibleParty"
      x.signing.emancipatedMinor = "no"
    })
    expect(Object.keys(validateStep("signature", a, ON)).sort()).toEqual(RESPONSIBLE_REQUIRED)
  })

  it("does not require a responsible party for an emancipated minor who signs", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "2012-05-01"
      x.signature.signedBy = "applicant"
      x.signing.emancipatedMinor = "yes"
    })
    expect(validateStep("signature", a, ON)).toEqual({})
  })

  it("requires the responsible-party details whenever a responsible party signs, with valid formats", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "responsibleParty"
    })
    expect(Object.keys(validateStep("signature", a, ON)).sort()).toEqual(RESPONSIBLE_REQUIRED)

    const filled = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "responsibleParty"
      x.signing.responsibleParty = {
        firstName: "Pat",
        middleName: "",
        lastName: "Guardian",
        suffix: "",
        ssn: "12",
        relationship: "parent",
        dateOfBirth: "1980-01-01",
        street: "2 Example St",
        apartment: "",
        city: "Testville",
        state: "MA",
        zip: "02101",
        county: "",
        phone: "6175550100",
        phoneType: "mobile",
        secondPhone: "",
        email: "not-an-email",
      }
    })
    expect(Object.keys(validateStep("signature", filled, ON)).sort()).toEqual([
      "signing.responsibleParty.email",
      "signing.responsibleParty.ssn",
    ])
  })

  it("ignores stale responsible-party and minor answers for an adult who signs", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "applicant"
      x.signing.emancipatedMinor = "no"
      x.signing.responsibleParty.firstName = ""
    })
    expect(validateStep("signature", a, ON)).toEqual({})
  })

  it("keeps voter registration optional", () => {
    const a = answers((x) => {
      x.persons[0].dateOfBirth = "1950-04-02"
      x.signature.signedBy = "applicant"
      x.signing.registerToVote = "yes"
    })
    expect(validateStep("signature", a, ON)).toEqual({})
  })
})
