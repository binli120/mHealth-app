/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type HraEntry, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

describe("healthInsurance step", () => {
  it("requires the two opening questions", () => {
    expect(Object.keys(validateStep("healthInsurance", answers(), ON)).sort()).toEqual([
      "health.employerOfferedCoverage",
      "health.hasOtherCoverage",
    ])
  })

  it("is complete when nothing is offered and there is no other coverage", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "no"
    })
    expect(validateStep("healthInsurance", a, ON)).toEqual({})
  })

  it("asks which type of coverage when the answer is yes and nothing is ticked", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "yes"
    })
    expect(validateStep("healthInsurance", a, ON)).toEqual({ "health.hasOtherCoverage": "Select the type of coverage." })
  })

  it("collects Medicare details and the Part B question", () => {
    const base = (x: Saca2Answers) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "yes"
      x.health.hasMedicare = true
    }
    expect(validateStep("healthInsurance", answers(base), ON)).toEqual({
      "health.medicare": "Add at least one.",
      "health.wantsPartBHelp": "This question is required.",
    })

    const row = {
      personName: "Edna Testcase",
      claimNumber: "1EG4-TE5-MK72",
      coverageStart: "2020-01-01",
      hasPartD: "no" as const,
      partDStart: null,
      hasMedigap: "no" as const,
      medigapPlan: "",
      medigapStart: null,
    }
    const ok = answers((x) => {
      base(x)
      x.health.medicare = [row]
      x.health.wantsPartBHelp = "no"
    })
    expect(validateStep("healthInsurance", ok, ON)).toEqual({})

    const needNames = answers((x) => {
      base(x)
      x.health.medicare = [row]
      x.health.wantsPartBHelp = "yes"
    })
    expect(validateStep("healthInsurance", needNames, ON)).toEqual({ "health.partBHelpNames": "This question is required." })

    const needMedigap = answers((x) => {
      base(x)
      x.health.medicare = [{ ...row, hasMedigap: "yes" }]
      x.health.wantsPartBHelp = "no"
    })
    expect(validateStep("healthInsurance", needMedigap, ON)).toEqual({ "health.medicare.0.medigapPlan": "This question is required." })
  })

  it("requires the covered names and policy number for other coverage types", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "yes"
      x.health.otherPrograms.tricare = true
    })
    expect(Object.keys(validateStep("healthInsurance", a, ON)).sort()).toEqual([
      "health.otherCoverageDetails.coveredNames",
      "health.otherCoverageDetails.policyNumber",
    ])
    a.health.otherCoverageDetails = { coveredNames: "Edna", policyNumber: "T-1", startEndDates: "" }
    expect(validateStep("healthInsurance", a, ON)).toEqual({})
  })

  it("requires employer coverage rows when enrolled in employer coverage", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "yes"
      x.health.hasOtherCoverage = "yes"
      x.health.enrolledInEmployerCoverage = true
    })
    expect(validateStep("healthInsurance", a, ON)).toEqual({ "health.employerCoverage": "Add at least one." })
    a.health.employerCoverage = [{ employerName: "Acme", planName: "Gold", coveredNames: "Edna", policyNumber: "", startEndDates: "" }]
    expect(validateStep("healthInsurance", a, ON)).toEqual({})
  })

  it("ignores stale coverage details once the gate flips back to no", () => {
    const a = answers((x) => {
      x.health.employerOfferedCoverage = "no"
      x.health.hasOtherCoverage = "no"
      x.health.hasMedicare = true
      x.health.otherPrograms.tricare = true
      x.health.enrolledInEmployerCoverage = true
    })
    expect(validateStep("healthInsurance", a, ON)).toEqual({})
  })
})

describe("hra step", () => {
  const entry = (over: Partial<HraEntry> = {}): HraEntry => ({
    individualName: "Edna Testcase",
    dateOfBirth: "1950-04-02",
    employerName: "Acme",
    federalTaxId: "",
    hraType: "qsehra",
    startDate: null,
    endDate: null,
    maxSelfOnlyAmount: 1500,
    qsehraFamilyIntent: "no",
    qsehraFamilyMax: null,
    ichraAcceptIntent: null,
    ...over,
  })

  it("requires the opening question, and is complete when no one is offered an HRA", () => {
    expect(validateStep("hra", answers(), ON)).toEqual({ "health.hra.anyoneOffered": "This question is required." })
    expect(validateStep("hra", answers((x) => (x.health.hra.anyoneOffered = "no")), ON)).toEqual({})
  })

  it("asks for at least one entry when someone is offered an HRA", () => {
    expect(validateStep("hra", answers((x) => (x.health.hra.anyoneOffered = "yes")), ON)).toEqual({
      "health.hra.entries": "Add at least one.",
    })
  })

  it("validates a QSEHRA entry, including the family question", () => {
    const missing = answers((x) => {
      x.health.hra.anyoneOffered = "yes"
      x.health.hra.entries = [entry({ individualName: "", dateOfBirth: null, employerName: "", hraType: null, maxSelfOnlyAmount: null })]
    })
    expect(Object.keys(validateStep("hra", missing, ON)).sort()).toEqual([
      "health.hra.entries.0.dateOfBirth",
      "health.hra.entries.0.employerName",
      "health.hra.entries.0.hraType",
      "health.hra.entries.0.individualName",
      "health.hra.entries.0.maxSelfOnlyAmount",
    ])

    const familyMax = answers((x) => {
      x.health.hra.anyoneOffered = "yes"
      x.health.hra.entries = [entry({ qsehraFamilyIntent: "yes" })]
    })
    expect(validateStep("hra", familyMax, ON)).toEqual({ "health.hra.entries.0.qsehraFamilyMax": "This question is required." })

    const ok = answers((x) => {
      x.health.hra.anyoneOffered = "yes"
      x.health.hra.entries = [entry({ qsehraFamilyIntent: "yes", qsehraFamilyMax: 3000 })]
    })
    expect(validateStep("hra", ok, ON)).toEqual({})
  })

  it("asks the ICHRA question only for ICHRA entries", () => {
    const a = answers((x) => {
      x.health.hra.anyoneOffered = "yes"
      x.health.hra.entries = [entry({ hraType: "ichra", qsehraFamilyIntent: null })]
    })
    expect(validateStep("hra", a, ON)).toEqual({ "health.hra.entries.0.ichraAcceptIntent": "This question is required." })
    a.health.hra.entries = [entry({ hraType: "ichra", qsehraFamilyIntent: null, ichraAcceptIntent: "no" })]
    expect(validateStep("hra", a, ON)).toEqual({})
  })
})
