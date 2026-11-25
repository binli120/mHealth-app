/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type AianMember, type EmployerJob, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

const member = (over: Partial<AianMember> = {}): AianMember => ({
  name: "Test Member",
  federallyRecognizedTribe: "no",
  tribeName: "",
  massRecognizedTribe: "no",
  massTribeName: "",
  receivedIhsService: "yes",
  eligibleForIhs: null,
  excludedIncomeAmount: null,
  excludedIncomeFrequency: null,
  ...over,
})

describe("suppB step", () => {
  it("asks for at least one member", () => {
    expect(validateStep("suppB", answers(), ON)).toEqual({ "supplements.b.members": "Add at least one." })
  })

  it("validates the required answers per member", () => {
    const blank = member({ name: "", federallyRecognizedTribe: null, massRecognizedTribe: null, receivedIhsService: null })
    const a = answers((x) => (x.supplements.b.members = [blank]))
    expect(Object.keys(validateStep("suppB", a, ON)).sort()).toEqual([
      "supplements.b.members.0.federallyRecognizedTribe",
      "supplements.b.members.0.massRecognizedTribe",
      "supplements.b.members.0.name",
      "supplements.b.members.0.receivedIhsService",
    ])
  })

  it("asks tribe names only for a yes, and IHS eligibility only when no IHS service was received", () => {
    const a = answers((x) => {
      x.supplements.b.members = [
        member({ federallyRecognizedTribe: "yes", massRecognizedTribe: "yes", receivedIhsService: "no" }),
      ]
    })
    expect(Object.keys(validateStep("suppB", a, ON)).sort()).toEqual([
      "supplements.b.members.0.eligibleForIhs",
      "supplements.b.members.0.massTribeName",
      "supplements.b.members.0.tribeName",
    ])
    a.supplements.b.members = [
      member({
        federallyRecognizedTribe: "yes",
        tribeName: "Example Tribe",
        massRecognizedTribe: "yes",
        massTribeName: "Example MA Tribe",
        receivedIhsService: "no",
        eligibleForIhs: "yes",
      }),
    ]
    expect(validateStep("suppB", a, ON)).toEqual({})
  })

  it("requires how often when an excluded income amount is given", () => {
    const a = answers((x) => (x.supplements.b.members = [member({ excludedIncomeAmount: 200 })]))
    expect(validateStep("suppB", a, ON)).toEqual({ "supplements.b.members.0.excludedIncomeFrequency": "This question is required." })
    a.supplements.b.members = [member({ excludedIncomeAmount: 200, excludedIncomeFrequency: "monthly" })]
    expect(validateStep("suppB", a, ON)).toEqual({})
  })
})

const job = (over: Partial<EmployerJob> = {}): EmployerJob => ({
  employeeName: "Edna Testcase",
  employeeSsn: "",
  eligibleWithinThreeMonths: "yes",
  waitingPeriodEnds: null,
  employerName: "Acme",
  employerFederalTaxId: "",
  employerAddress: "9 Work Rd",
  employerCity: "Testville",
  employerState: "MA",
  employerZip: "02101",
  employerPhone: "6175550100",
  contactName: "HR",
  contactPhone: "",
  contactEmail: "",
  individualPlanName: "Gold Individual",
  individualMeetsMinimumValue: "yes",
  individualPremium: 120,
  individualPremiumFrequency: "monthly",
  familyPlanName: "",
  familyMeetsMinimumValue: null,
  familyPremium: null,
  familyPremiumFrequency: null,
  upcomingChange: "none",
  changeEndDate: null,
  changePremium: null,
  changePremiumFrequency: null,
  changeDate: null,
  ...over,
})

describe("suppD step", () => {
  it("asks for at least one job", () => {
    expect(validateStep("suppD", answers(), ON)).toEqual({ "supplements.d.jobs": "Add at least one." })
  })

  it("passes a complete job", () => {
    expect(validateStep("suppD", answers((x) => (x.supplements.d.jobs = [job()])), ON)).toEqual({})
  })

  it("stops after the eligibility question when no one can enroll within three months", () => {
    const a = answers((x) => {
      x.supplements.d.jobs = [
        job({ eligibleWithinThreeMonths: "no", employerName: "", individualPlanName: "", individualMeetsMinimumValue: null, individualPremium: null, individualPremiumFrequency: null }),
      ]
    })
    expect(validateStep("suppD", a, ON)).toEqual({})
  })

  it("requires the employee, employer, and lowest-cost individual plan when eligible", () => {
    const a = answers((x) => {
      x.supplements.d.jobs = [
        job({ employeeName: "", employerName: "", individualPlanName: "", individualMeetsMinimumValue: null, individualPremium: null, individualPremiumFrequency: null }),
      ]
    })
    expect(Object.keys(validateStep("suppD", a, ON)).sort()).toEqual([
      "supplements.d.jobs.0.employeeName",
      "supplements.d.jobs.0.employerName",
      "supplements.d.jobs.0.individualMeetsMinimumValue",
      "supplements.d.jobs.0.individualPlanName",
      "supplements.d.jobs.0.individualPremium",
      "supplements.d.jobs.0.individualPremiumFrequency",
    ])
  })

  it("keeps the household-member plan optional but validates formats", () => {
    const ok = answers((x) => (x.supplements.d.jobs = [job({ familyPlanName: "Family Plus" })]))
    expect(validateStep("suppD", ok, ON)).toEqual({})
    const bad = answers((x) => (x.supplements.d.jobs = [job({ employerZip: "12", employerState: "Massachusetts", contactEmail: "nope", employeeSsn: "1" })]))
    expect(Object.keys(validateStep("suppD", bad, ON)).sort()).toEqual([
      "supplements.d.jobs.0.contactEmail",
      "supplements.d.jobs.0.employeeSsn",
      "supplements.d.jobs.0.employerState",
      "supplements.d.jobs.0.employerZip",
    ])
  })

  it("asks the follow-up questions for a pending employer change", () => {
    const stops = answers((x) => (x.supplements.d.jobs = [job({ upcomingChange: "employerWillNotOffer" })]))
    expect(validateStep("suppD", stops, ON)).toEqual({ "supplements.d.jobs.0.changeEndDate": "This question is required." })
    const drops = answers((x) => (x.supplements.d.jobs = [job({ upcomingChange: "personWillDrop", changeEndDate: "2026-12-31" })]))
    expect(validateStep("suppD", drops, ON)).toEqual({})
    const changes = answers((x) => (x.supplements.d.jobs = [job({ upcomingChange: "employerWillChange" })]))
    expect(Object.keys(validateStep("suppD", changes, ON)).sort()).toEqual([
      "supplements.d.jobs.0.changeDate",
      "supplements.d.jobs.0.changePremium",
      "supplements.d.jobs.0.changePremiumFrequency",
    ])
  })

  it("does not ask about changes once the job is not eligible, even with a stale selection", () => {
    const a = answers((x) => (x.supplements.d.jobs = [job({ eligibleWithinThreeMonths: "no", upcomingChange: "employerWillChange" })]))
    expect(validateStep("suppD", a, ON)).toEqual({})
  })
})
