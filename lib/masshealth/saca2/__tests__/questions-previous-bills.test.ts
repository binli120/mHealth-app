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

describe("previousBills step", () => {
  it("requires the first answer only when nothing is answered", () => {
    expect(validateStep("previousBills", answers(), ON)).toEqual({
      "previousMedicalBills.hasBills": "This question is required.",
    })
  })

  it("is complete when there are no previous bills", () => {
    expect(validateStep("previousBills", answers((a) => (a.previousMedicalBills.hasBills = "no")), ON)).toEqual({})
  })

  it("asks whether coverage is wanted for that period when there are bills", () => {
    const errors = validateStep("previousBills", answers((a) => (a.previousMedicalBills.hasBills = "yes")), ON)
    expect(errors).toEqual({ "previousMedicalBills.wantsCoverageForPeriod": "This question is required." })
  })

  it("needs nothing more when coverage for the period is not wanted", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "yes"
      x.previousMedicalBills.wantsCoverageForPeriod = "no"
    })
    expect(validateStep("previousBills", a, ON)).toEqual({})
  })

  it("needs the earliest date and at least one person when coverage for the period is wanted", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "yes"
      x.previousMedicalBills.wantsCoverageForPeriod = "yes"
    })
    expect(validateStep("previousBills", a, ON)).toEqual({
      "previousMedicalBills.earliestDate": "This question is required.",
      "previousMedicalBills.requests": "Add at least one.",
    })
  })

  it("validates each requested person", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "yes"
      x.previousMedicalBills.wantsCoverageForPeriod = "yes"
      x.previousMedicalBills.earliestDate = "2026-08-01"
      x.previousMedicalBills.requests = [{ name: "", earliestDateRequested: null, circumstancesChanged: null }]
    })
    expect(validateStep("previousBills", a, ON)).toEqual({
      "previousMedicalBills.requests.0.name": "This question is required.",
      "previousMedicalBills.requests.0.earliestDateRequested": "This question is required.",
      "previousMedicalBills.requests.0.circumstancesChanged": "This question is required.",
    })
  })

  it("passes a complete request", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "yes"
      x.previousMedicalBills.wantsCoverageForPeriod = "yes"
      x.previousMedicalBills.earliestDate = "2026-08-01"
      x.previousMedicalBills.requests = [
        { name: "Edna Testcase", earliestDateRequested: "2026-08-01", circumstancesChanged: "no" },
      ]
    })
    expect(validateStep("previousBills", a, ON)).toEqual({})
  })

  it("ignores stale answers once the first answer flips back to no", () => {
    const a = answers((x) => {
      x.previousMedicalBills.hasBills = "no"
      x.previousMedicalBills.wantsCoverageForPeriod = "yes"
      x.previousMedicalBills.earliestDate = null
      x.previousMedicalBills.requests = []
    })
    expect(validateStep("previousBills", a, ON)).toEqual({})
  })
})
