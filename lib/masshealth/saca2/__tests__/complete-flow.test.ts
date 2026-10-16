/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { getWizardSteps } from "@/lib/masshealth/saca2/wizard-state"
import { completeFacilityCouple, completeSingleSenior } from "./complete-answers"

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
})
