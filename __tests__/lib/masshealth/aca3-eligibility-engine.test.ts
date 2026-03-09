import { describe, expect, it } from "vitest"

import {
  evaluateAca3Eligibility,
  type Aca3EligibilityApplicantInput,
} from "@/lib/masshealth/aca3-eligibility-engine"

function makeInput(overrides: Partial<Aca3EligibilityApplicantInput> = {}): Aca3EligibilityApplicantInput {
  return {
    applicantId: "A12345",
    age: 30,
    stateResident: "MA",
    identityVerified: true,
    citizenshipStatus: "US_CITIZEN",
    married: false,
    taxDependents: 0,
    taxFiler: true,
    pregnant: false,
    unbornChildren: 0,
    disabled: false,
    medicalVerification: true,
    hasOtherInsurance: false,
    income: {
      wages: 20000,
      selfEmployment: 0,
      unemployment: 0,
      socialSecurityTaxable: 0,
      rentalIncome: 0,
      interest: 0,
      pension: 0,
    },
    verification: {
      ssnVerified: true,
      incomeVerified: true,
      immigrationVerified: true,
    },
    ...overrides,
  }
}

describe("lib/masshealth/aca3-eligibility-engine", () => {
  it("denies when applicant is not a Massachusetts resident", () => {
    const result = evaluateAca3Eligibility(
      makeInput({
        stateResident: "NY",
      }),
    )

    expect(result.status).toBe("DENIED")
    expect(result.eligible_program).toBe("Ineligible")
    expect(result.findings.some((finding) => finding.code === "RESIDENCY_DENIED")).toBe(true)
  })

  it("returns MassHealth Standard for pregnant applicant under threshold", () => {
    const result = evaluateAca3Eligibility(
      makeInput({
        pregnant: true,
        unbornChildren: 1,
        income: {
          wages: 25000,
        },
      }),
    )

    expect(result.status).toBe("APPROVED")
    expect(result.eligible_program).toBe("MassHealth Standard")
    expect(result.household_size).toBe(2)
  })

  it("returns Family Assistance for child above standard threshold and under 300% FPL", () => {
    const result = evaluateAca3Eligibility(
      makeInput({
        age: 10,
        income: {
          wages: 35000,
        },
      }),
    )

    expect(result.status).toBe("APPROVED")
    expect(result.eligible_program).toBe("MassHealth Family Assistance")
    expect(result.fpl_percent).toBeGreaterThan(150)
    expect(result.fpl_percent).toBeLessThanOrEqual(300)
  })

  it("redirects applicants age 65 and older to ACA-2", () => {
    const result = evaluateAca3Eligibility(
      makeInput({
        age: 65,
      }),
    )

    expect(result.status).toBe("REDIRECT_ACA2")
    expect(result.eligible_program).toBe("Redirect to ACA-2")
    expect(result.findings.some((finding) => finding.code === "AGE_REDIRECT")).toBe(true)
  })
})
