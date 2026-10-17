/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { getWizardSteps } from "@/lib/masshealth/saca2/wizard-state"
import { completeFacilityCouple, completeHomeWithAllSupplements, completeSingleSenior } from "./complete-answers"

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
    for (const fixture of [completeSingleSenior(), completeFacilityCouple(), completeHomeWithAllSupplements()]) {
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
