/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import type { Saca2Person } from "@/lib/masshealth/saca2/types"
import { getWizardSteps } from "@/lib/masshealth/saca2/wizard-state"
import { completeFacilityCouple, completeHomeWithAllSupplements, completeRichHousehold, completeSingleSenior } from "./complete-answers"

const ON = new Date("2026-10-13T12:00:00Z")

describe("complete fixtures", () => {
  it("a single senior at home sees the expected steps and every one validates clean", () => {
    const a = completeSingleSenior()
    const steps = getWizardSteps(a, ON)
    expect(steps).toEqual([
      "intake",
      "person1",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "pca",
      "signature",
    ])
    for (const step of steps) {
      expect(validateStep(step, a, ON), step).toEqual({})
    }
  })

  it("a nursing-facility couple sees the expected steps and every one validates clean", () => {
    const a = completeFacilityCouple()
    expect(a.persons).toHaveLength(2)
    const steps = getWizardSteps(a, ON)
    expect(steps).toEqual([
      "intake",
      "person1",
      "person2",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "signature",
      "suppA",
      "ard",
    ])
    for (const step of steps) {
      expect(validateStep(step, a, ON), step).toEqual({})
    }
  })

  it("a rich household sees the expected steps and every one validates clean", () => {
    const a = completeRichHousehold()
    expect(a.persons).toHaveLength(2)
    const steps = getWizardSteps(a, ON)
    expect(steps).toEqual([
      "intake",
      "person1",
      "person2",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "signature",
    ])
    for (const step of steps) {
      expect(validateStep(step, a, ON), step).toEqual({})
    }
  })

  it("returns fresh objects on every call", () => {
    const first = completeRichHousehold()
    first.persons[0].income[0].amount = 1
    expect(completeRichHousehold().persons[0].income[0].amount).toBe(2000)
  })

  it("dropping one required answer per new person-block area is caught by the right step", () => {
    const noAptc = completeRichHousehold()
    noAptc.persons[0].tax.agreesToFileIfAptc = null
    expect(validateStep("person1", noAptc, ON)).toEqual({
      "persons.0.tax.agreesToFileIfAptc": "This question is required.",
    })
    expect(validateStep("person2", noAptc, ON)).toEqual({})

    const noPregnant = completeRichHousehold()
    noPregnant.persons[0].pregnant = null
    expect(validateStep("person1", noPregnant, ON)).toEqual({ "persons.0.pregnant": "This question is required." })

    const noRentOrOwn = completeRichHousehold()
    noRentOrOwn.persons[0].rentOrOwn = null
    expect(validateStep("person1", noRentOrOwn, ON)).toEqual({ "persons.0.rentOrOwn": "This question is required." })

    const noNextYear = completeRichHousehold()
    noNextYear.persons[0].oneTimeIncome.nextYear = null
    expect(validateStep("person1", noNextYear, ON)).toEqual({
      "persons.0.oneTimeIncome.nextYear": "This question is required.",
    })

    const noDeductions = completeRichHousehold()
    noDeductions.persons[0].deductions.none = false
    for (const key of Object.keys(noDeductions.persons[0].deductions.amounts) as Array<keyof Saca2Person["deductions"]["amounts"]>) {
      noDeductions.persons[0].deductions.amounts[key] = null
    }
    expect(validateStep("person1", noDeductions, ON)).toEqual({
      "persons.0.deductions.none": "Check None or enter at least one deduction.",
    })

    const noSeasonal = completeRichHousehold()
    noSeasonal.persons[0].income[0].seasonal = null
    expect(validateStep("person1", noSeasonal, ON)).toEqual({
      "persons.0.income.0.seasonal": "This question is required.",
    })

    const noAccommodation = completeRichHousehold()
    noAccommodation.persons[1].needsAccommodation = null
    expect(validateStep("person2", noAccommodation, ON)).toEqual({
      "persons.1.needsAccommodation": "This question is required.",
    })
    expect(validateStep("person1", noAccommodation, ON)).toEqual({})
  })

  it("dropping one required answer is caught by exactly the right step", () => {
    const missingGate = completeSingleSenior()
    missingGate.assets.gates.vehicles = null
    expect(validateStep("assets", missingGate, ON)).toEqual({ "assets.gates.vehicles": "This question is required." })
    expect(validateStep("healthInsurance", missingGate, ON)).toEqual({})

    const missingPca = completeSingleSenior()
    missingPca.pca.needsPca = null
    expect(validateStep("pca", missingPca, ON)).toEqual({ "pca.needsPca": "This question is required." })

    const missingBankRow = completeFacilityCouple()
    missingBankRow.assets.bankAccounts = []
    expect(validateStep("assets", missingBankRow, ON)).toEqual({ "assets.bankAccounts": "Add at least one." })
  })

  it("a home applicant who triggers every supplement sees all of them and every step validates clean", () => {
    const a = completeHomeWithAllSupplements()
    const steps = getWizardSteps(a, ON)
    expect(steps).toEqual([
      "intake",
      "person1",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "pca",
      "signature",
      "suppA",
      "suppB",
      "suppC",
      "suppD",
      "ard",
      "irs4506",
    ])
    for (const step of steps) {
      expect(validateStep(step, a, ON), step).toEqual({})
    }
  })

  it("every step except additionalCoverage is exercised by at least one fixture", () => {
    const seen = new Set<string>()
    for (const fixture of [completeSingleSenior(), completeFacilityCouple(), completeHomeWithAllSupplements(), completeRichHousehold()]) {
      for (const step of getWizardSteps(fixture, ON)) seen.add(step)
    }
    expect([...seen].sort()).toEqual(
      ["aian", "ard", "assets", "healthInsurance", "hra", "intake", "irs4506", "pca", "person1", "person2", "previousBills", "signature", "suppA", "suppB", "suppC", "suppD"].sort(),
    )
  })

  it("dropping a required supplement answer is caught by the right step", () => {
    const missingTransfer = completeHomeWithAllSupplements()
    missingTransfer.supplements.a.transferAnswers.trust = null
    expect(validateStep("suppA", missingTransfer, ON)).toEqual({
      "supplements.a.transferAnswers.trust": "This question is required.",
    })

    const missingJob = completeHomeWithAllSupplements()
    missingJob.supplements.d.jobs = []
    expect(validateStep("suppD", missingJob, ON)).toEqual({ "supplements.d.jobs": "Add at least one." })

    const missingYears = completeHomeWithAllSupplements()
    missingYears.attachments.irs4506.yearsRequested = []
    expect(validateStep("irs4506", missingYears, ON)).toEqual({ "attachments.irs4506.yearsRequested": "Add at least one." })
  })
})
