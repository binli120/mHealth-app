import { describe, expect, it } from "vitest"

import syntheticCases from "@/data/aca3-synthetic-patient-cases.json"
import { evaluateAca3Eligibility } from "@/lib/masshealth/aca3-eligibility-engine"
import type {
  Aca3EligibilityApplicantInput,
  Aca3EligibilityResult,
  EligibilityFinding,
} from "@/lib/masshealth/types"

interface SyntheticPersona {
  age: number
  sexAtBirth: "female" | "male" | "other"
  pregnant: boolean
  conditions: string[]
  married: boolean
  taxDependents: number
  unbornChildren: number
  annualIncome: number
  computedHouseholdSize: number
  notes: string[]
}

interface SyntheticExpected {
  status: Aca3EligibilityResult["status"]
  eligibleProgram: string
  householdSize: number
  findingCodes: string[]
  requiredDocuments?: string[]
}

interface SyntheticCase {
  caseId: string
  label: string
  persona: SyntheticPersona
  input: Aca3EligibilityApplicantInput
  expected: SyntheticExpected
}

const cases = syntheticCases as SyntheticCase[]

function hasFinding(findings: EligibilityFinding[], code: string): boolean {
  return findings.some((finding) => finding.code === code)
}

describe("lib/masshealth synthetic ACA-3 patient cases", () => {
  it("ships a broad case catalog for regression testing", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30)
  })

  for (const testCase of cases) {
    it(`${testCase.caseId} -> ${testCase.expected.status} / ${testCase.expected.eligibleProgram}`, () => {
      const result = evaluateAca3Eligibility(testCase.input)

      expect(result.status).toBe(testCase.expected.status)
      expect(result.eligible_program).toBe(testCase.expected.eligibleProgram)
      expect(result.household_size).toBe(testCase.expected.householdSize)
      expect(result.applicant_id).toBe(testCase.caseId)

      for (const findingCode of testCase.expected.findingCodes) {
        expect(hasFinding(result.findings, findingCode)).toBe(true)
      }

      for (const requiredDocument of testCase.expected.requiredDocuments ?? []) {
        expect(result.required_documents).toContain(requiredDocument)
      }
    })
  }
})
