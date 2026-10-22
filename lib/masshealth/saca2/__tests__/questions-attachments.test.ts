/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type ArdData, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

const rep: Partial<ArdData> = {
  repName: "Quinn Rep",
  repPhone: "6175550101",
  repStreet: "3 Example St",
  repCity: "Testville",
  repState: "MA",
  repZip: "02101",
}

const ard = (over: Partial<ArdData>) => (a: Saca2Answers) => {
  a.attachments.ard = { ...a.attachments.ard, ...rep, ...over }
}

describe("ard step", () => {
  it("requires choosing which section applies", () => {
    expect(validateStep("ard", answers(), ON)).toEqual({ "attachments.ard.section": "This question is required." })
  })

  it("requires the representative's contact details for every section", () => {
    const a = answers((x) => (x.attachments.ard.section = "applicantDesignates"))
    expect(Object.keys(validateStep("ard", a, ON)).sort()).toEqual([
      "attachments.ard.repCity",
      "attachments.ard.repKind",
      "attachments.ard.repName",
      "attachments.ard.repPhone",
      "attachments.ard.repStreet",
      "attachments.ard.repZip",
    ])
  })

  it("section 1 with a person needs only the contact details", () => {
    const a = answers(ard({ section: "applicantDesignates", repKind: "person" }))
    expect(validateStep("ard", a, ON)).toEqual({})
  })

  it("section 1 with an organization also needs the organization and staff details", () => {
    const a = answers(ard({ section: "applicantDesignates", repKind: "organization" }))
    expect(Object.keys(validateStep("ard", a, ON)).sort()).toEqual([
      "attachments.ard.orgName",
      "attachments.ard.staffEmail",
      "attachments.ard.staffName",
    ])
    a.attachments.ard.orgName = "Example Advocates"
    a.attachments.ard.staffName = "Sam Staff"
    a.attachments.ard.staffEmail = "sam@example.test"
    expect(validateStep("ard", a, ON)).toEqual({})
  })

  it("section 2 needs officer details only when an organization is named", () => {
    const person = answers(ard({ section: "cannotDesignate" }))
    expect(validateStep("ard", person, ON)).toEqual({})
    const org = answers(ard({ section: "cannotDesignate", orgName: "Example Advocates" }))
    expect(Object.keys(validateStep("ard", org, ON)).sort()).toEqual([
      "attachments.ard.officerName",
      "attachments.ard.officerTitle",
    ])
  })

  it("section 3 needs a description of the legal document", () => {
    const a = answers(ard({ section: "appointedByLaw" }))
    expect(validateStep("ard", a, ON)).toEqual({ "attachments.ard.legalDocument": "This question is required." })
    a.attachments.ard.legalDocument = "Guardianship order, Suffolk Probate Court"
    expect(validateStep("ard", a, ON)).toEqual({})
  })

  it("ignores answers belonging to a section that is no longer selected", () => {
    const a = answers(ard({ section: "appointedByLaw", legalDocument: "Order", repKind: "organization", orgName: "", staffName: "", staffEmail: "" }))
    expect(validateStep("ard", a, ON)).toEqual({})
  })

  it("validates formats", () => {
    const a = answers(ard({ section: "applicantDesignates", repKind: "person", repZip: "12", repState: "Massachusetts", repEmail: "nope", repPhone: "555" }))
    expect(Object.keys(validateStep("ard", a, ON)).sort()).toEqual([
      "attachments.ard.repEmail",
      "attachments.ard.repPhone",
      "attachments.ard.repState",
      "attachments.ard.repZip",
    ])
  })
})

describe("irs4506 step", () => {
  const withSsn = (a: Saca2Answers) => {
    a.persons[0].hasSsn = "yes"
    a.persons[0].ssn = "123-45-6789"
  }

  it("requires the joint-return answer, and at least one period", () => {
    expect(validateStep("irs4506", answers(withSsn), ON)).toEqual({
      "attachments.irs4506.jointReturn": "This question is required.",
      "attachments.irs4506.yearsRequested": "Add at least one.",
    })
  })

  it("is complete with a joint answer and a requested period", () => {
    const a = answers((x) => {
      withSsn(x)
      x.attachments.irs4506.jointReturn = "no"
      x.attachments.irs4506.yearsRequested = [{ periodEnd: "2025-12-31" }]
    })
    expect(validateStep("irs4506", a, ON)).toEqual({})
  })

  it("requires each period end date", () => {
    const a = answers((x) => {
      withSsn(x)
      x.attachments.irs4506.jointReturn = "yes"
      x.attachments.irs4506.yearsRequested = [{ periodEnd: null }]
    })
    expect(validateStep("irs4506", a, ON)).toEqual({ "attachments.irs4506.yearsRequested.0.periodEnd": "This question is required." })
  })

  it("asks for a taxpayer ID only when Person 1 has no SSN", () => {
    const base = (x: Saca2Answers) => {
      x.attachments.irs4506.jointReturn = "no"
      x.attachments.irs4506.yearsRequested = [{ periodEnd: "2025-12-31" }]
    }
    const none = answers((x) => {
      x.persons[0].hasSsn = "no"
      base(x)
    })
    expect(validateStep("irs4506", none, ON)).toEqual({ "attachments.irs4506.taxpayerId": "This question is required." })
    none.attachments.irs4506.taxpayerId = "900-70-1234"
    expect(validateStep("irs4506", none, ON)).toEqual({})
    const has = answers((x) => {
      withSsn(x)
      base(x)
    })
    expect(validateStep("irs4506", has, ON)).toEqual({})
  })

  it("requires the form number", () => {
    const a = answers((x) => {
      withSsn(x)
      x.attachments.irs4506.jointReturn = "no"
      x.attachments.irs4506.formNumber = ""
      x.attachments.irs4506.yearsRequested = [{ periodEnd: "2025-12-31" }]
    })
    expect(validateStep("irs4506", a, ON)).toEqual({ "attachments.irs4506.formNumber": "This question is required." })
  })
})
