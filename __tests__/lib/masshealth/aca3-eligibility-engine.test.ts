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

  // ── Program assignment ───────────────────────────────────────────────────────

  it("returns MassHealth CarePlus for adult (19-64) at or below 138% FPL", () => {
    // 1-person household FPL = $15,060; 138% = $20,783 — use $18,000
    const result = evaluateAca3Eligibility(
      makeInput({ age: 35, income: { wages: 18000 } }),
    )

    expect(result.status).toBe("APPROVED")
    expect(result.eligible_program).toBe("MassHealth CarePlus")
    expect(result.fpl_percent).toBeLessThanOrEqual(138)
  })

  it("returns Health Connector for adult (19-64) above 138% FPL", () => {
    // 1-person household FPL = $15,060; above 138% = above ~$20,783 — use $30,000
    const result = evaluateAca3Eligibility(
      makeInput({ age: 40, income: { wages: 30000 } }),
    )

    expect(result.status).toBe("APPROVED")
    expect(result.eligible_program).toBe("Health Connector")
    expect(result.fpl_percent).toBeGreaterThan(138)
  })

  it("returns MassHealth Standard for child (under 19) at or below 150% FPL", () => {
    // 1-person household FPL = $15,060; 150% = $22,590 — use $15,000
    const result = evaluateAca3Eligibility(
      makeInput({ age: 8, income: { wages: 15000 } }),
    )

    expect(result.status).toBe("APPROVED")
    expect(result.eligible_program).toBe("MassHealth Standard")
    expect(result.fpl_percent).toBeLessThanOrEqual(150)
  })

  it("returns Health Connector for child (under 19) above 300% FPL", () => {
    // 1-person household FPL = $15,060; 300% = $45,180 — use $50,000
    const result = evaluateAca3Eligibility(
      makeInput({ age: 15, income: { wages: 50000 } }),
    )

    expect(result.status).toBe("APPROVED")
    expect(result.eligible_program).toBe("Health Connector")
    expect(result.fpl_percent).toBeGreaterThan(300)
  })

  it("returns MassHealth CommonHealth for a disabled applicant", () => {
    const result = evaluateAca3Eligibility(
      makeInput({ disabled: true, medicalVerification: true }),
    )

    expect(result.status).toBe("APPROVED")
    expect(result.eligible_program).toBe("MassHealth CommonHealth")
  })

  // ── Status transitions ───────────────────────────────────────────────────────

  it("sets status PENDING_VERIFICATION when identity is not verified", () => {
    const result = evaluateAca3Eligibility(
      makeInput({ identityVerified: false }),
    )

    expect(result.status).toBe("PENDING_VERIFICATION")
    expect(result.findings.some((f) => f.code === "IDENTITY_PENDING")).toBe(true)
    expect(result.required_documents).toContain("SSN verification")
    expect(result.required_documents).toContain("Passport or Birth Certificate")
  })

  it("sets status TPL_REQUIRED when applicant has other insurance", () => {
    const result = evaluateAca3Eligibility(
      makeInput({ hasOtherInsurance: true }),
    )

    expect(result.status).toBe("TPL_REQUIRED")
    expect(result.findings.some((f) => f.code === "TPL_REQUIRED")).toBe(true)
    expect(result.required_documents).toContain("TPL form")
  })

  it("sets status PENDING_DOCUMENTS when disabled without medical verification", () => {
    const result = evaluateAca3Eligibility(
      makeInput({ disabled: true, medicalVerification: false }),
    )

    expect(result.status).toBe("PENDING_DOCUMENTS")
    expect(
      result.findings.some((f) => f.code === "DISABILITY_MEDICAL_VERIFICATION_REQUIRED"),
    ).toBe(true)
    expect(result.required_documents).toContain("Disability Supplement form")
    expect(result.required_documents).toContain("Medical verification")
  })

  it("sets status PENDING_DOCUMENTS when verification checks fail", () => {
    const result = evaluateAca3Eligibility(
      makeInput({
        verification: { ssnVerified: false, incomeVerified: true, immigrationVerified: true },
      }),
    )

    expect(result.status).toBe("PENDING_DOCUMENTS")
    expect(result.findings.some((f) => f.code === "VERIFICATION_MISMATCH")).toBe(true)
    expect(result.required_documents).toContain("Verification documents")
  })

  it("sets status LIMITED_COVERAGE for non-qualified immigration status", () => {
    const result = evaluateAca3Eligibility(
      makeInput({ citizenshipStatus: "UNDOCUMENTED" }),
    )

    // Status is LIMITED_COVERAGE; program is still determined by income/age rules.
    expect(result.status).toBe("LIMITED_COVERAGE")
    expect(result.findings.some((f) => f.code === "LIMITED_COVERAGE")).toBe(true)
  })

  // ── Household size calculation ───────────────────────────────────────────────

  it("computes household size correctly for married applicant with dependents", () => {
    // Applicant + spouse + 2 dependents = 4
    const result = evaluateAca3Eligibility(
      makeInput({ married: true, taxDependents: 2 }),
    )

    expect(result.household_size).toBe(4)
  })

  it("adds unborn children to household size when pregnant", () => {
    // Applicant + 1 unborn child = 2
    const result = evaluateAca3Eligibility(
      makeInput({ pregnant: true, unbornChildren: 1 }),
    )

    expect(result.household_size).toBe(2)
  })

  // ── Rule results ─────────────────────────────────────────────────────────────

  it("includes all 14 rule result entries", () => {
    const result = evaluateAca3Eligibility(makeInput())
    const ruleIds = result.rule_results.map((r) => r.id)

    for (let i = 1; i <= 14; i++) {
      const pad = String(i).padStart(2, "0")
      expect(ruleIds.some((id) => id.includes(`RULE_${pad}`))).toBe(true)
    }
  })

  it("includes RULES_PASS finding when the applicant passes all checks cleanly", () => {
    const result = evaluateAca3Eligibility(makeInput())

    expect(result.findings.some((f) => f.code === "RULES_PASS" && f.level === "success")).toBe(true)
  })
})
