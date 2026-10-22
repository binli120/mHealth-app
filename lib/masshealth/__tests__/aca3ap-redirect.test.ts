/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { evaluateAca3ApEligibility } from "@/lib/masshealth/aca3ap-eligibility-engine"
import type { Aca3ApEligibilityApplicantInput } from "@/lib/masshealth/types"

function input(overrides: Partial<Aca3ApEligibilityApplicantInput> = {}): Aca3ApEligibilityApplicantInput {
  return {
    applicantId: "test-1",
    age: 40,
    maResident: true,
    citizenshipStatus: "US_CITIZEN",
    addingToExistingCase: true,
    existingHouseholdSize: 2,
    pregnant: false,
    unbornChildren: 0,
    disabled: false,
    medicalVerification: false,
    hasOtherInsurance: false,
    income: {},
    identityVerified: true,
    verification: { ssnVerified: true, incomeVerified: true, immigrationVerified: true },
    ...overrides,
  }
}

describe("ACA-3-AP REDIRECT_SACA2 link", () => {
  it("links a 65+ person to the SACA-2 chooser", () => {
    const r = evaluateAca3ApEligibility(input({ age: 70 }))
    expect(r.status).toBe("REDIRECT_SACA2")
    expect(r.redirect_href).toBe("/application/type?recommended=saca2")
  })

  it("adds no link otherwise and keeps the existing behavior", () => {
    const young = evaluateAca3ApEligibility(input())
    expect(young.status).toBe("APPROVED")
    expect("redirect_href" in young).toBe(false)
    const denied = evaluateAca3ApEligibility(input({ age: 70, maResident: false }))
    expect(denied.status).toBe("DENIED")
    expect("redirect_href" in denied).toBe(false)
  })
})
