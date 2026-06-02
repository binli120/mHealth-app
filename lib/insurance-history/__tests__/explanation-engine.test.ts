// lib/insurance-history/__tests__/explanation-engine.test.ts

import { describe, it, expect } from "vitest"
import {
  computeChangeFactor,
  applyRulesTemplate,
  FALLBACK_EXPLANATION,
} from "@/lib/insurance-history/explanation-engine"
import type { CoverageRecord } from "@/lib/insurance-history/types"

function makeRecord(overrides: Partial<CoverageRecord> = {}): CoverageRecord {
  return {
    id: "test-id",
    userId: "user-1",
    coverageYear: 2026,
    planName: "CarePlus",
    programCode: "careplus",
    premiumMonthly: 0,
    householdSize: 1,
    annualIncome: 20000,
    fplPercent: 125,
    source: "platform",
    applicationId: null,
    documentId: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("computeChangeFactor", () => {
  it("detects income drop below 138% FPL (connectorcare → careplus)", () => {
    const current = makeRecord({ fplPercent: 125, programCode: "careplus" })
    const prior = makeRecord({ fplPercent: 210, programCode: "connectorcare", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.fplDelta).toBe(-85)
    expect(cf.programChange).toEqual({ from: "connectorcare", to: "careplus" })
  })

  it("detects income rise above 138% FPL (careplus → connectorcare)", () => {
    const current = makeRecord({ fplPercent: 210, programCode: "connectorcare" })
    const prior = makeRecord({ fplPercent: 125, programCode: "careplus", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.fplDelta).toBe(85)
  })

  it("detects household size increase", () => {
    const current = makeRecord({ householdSize: 3 })
    const prior = makeRecord({ householdSize: 1, coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.householdDelta).toBe(2)
  })

  it("detects household size decrease", () => {
    const current = makeRecord({ householdSize: 1 })
    const prior = makeRecord({ householdSize: 3, coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.householdDelta).toBe(-2)
  })

  it("detects gained employer coverage", () => {
    const current = makeRecord({ programCode: "employer_sponsored_insurance" })
    const prior = makeRecord({ programCode: "connectorcare", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.gainedEmployer).toBe(true)
  })

  it("detects lost employer coverage", () => {
    const current = makeRecord({ programCode: "connectorcare" })
    const prior = makeRecord({ programCode: "employer_sponsored_insurance", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.lostEmployer).toBe(true)
  })

  it("detects pregnancy plan", () => {
    const current = makeRecord({ programCode: "pregnancy_standard" })
    const prior = makeRecord({ programCode: "connectorcare", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.pregnancy).toBe(true)
  })

  it("detects Medicare transition", () => {
    const current = makeRecord({ programCode: "medicare_savings_program_senior" })
    const prior = makeRecord({ programCode: "careplus", coverageYear: 2025 })
    const cf = computeChangeFactor(current, prior)
    expect(cf.medicare).toBe(true)
  })

  it("returns all nulls/false for no prior record", () => {
    const current = makeRecord()
    const cf = computeChangeFactor(current, null)
    expect(cf.fplDelta).toBeNull()
    expect(cf.incomeDelta).toBeNull()
    expect(cf.householdDelta).toBeNull()
    expect(cf.programChange).toBeNull()
    expect(cf.gainedEmployer).toBe(false)
    expect(cf.lostEmployer).toBe(false)
    expect(cf.pregnancy).toBe(false)
    expect(cf.medicare).toBe(false)
  })
})

describe("applyRulesTemplate", () => {
  it("returns oldest-record message when no prior", () => {
    const current = makeRecord({ fplPercent: 125, programCode: "careplus" })
    const result = applyRulesTemplate(current, null)
    expect(result).toBe("This is the earliest coverage record on file.")
  })

  it("matches income-dropped-below-138 template", () => {
    const current = makeRecord({ fplPercent: 125, programCode: "careplus" })
    const prior = makeRecord({ fplPercent: 210, programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("138%")
    expect(result).toContain("CarePlus")
  })

  it("matches income-rose-above-138 template", () => {
    const current = makeRecord({ fplPercent: 210, programCode: "connectorcare" })
    const prior = makeRecord({ fplPercent: 125, programCode: "careplus", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("138%")
  })

  it("matches income-above-300 template (connectorcare → federal_tax_credits)", () => {
    const current = makeRecord({ fplPercent: 350, programCode: "federal_tax_credits" })
    const prior = makeRecord({ fplPercent: 210, programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("300%")
  })

  it("matches income-above-400 template", () => {
    const current = makeRecord({ fplPercent: 420, programCode: "employer_or_connector" })
    const prior = makeRecord({ fplPercent: 350, programCode: "federal_tax_credits", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("400%")
  })

  it("matches household-increased template", () => {
    const current = makeRecord({ householdSize: 3, fplPercent: 125 })
    const prior = makeRecord({ householdSize: 1, fplPercent: 125, coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/household grew|household size/i)
  })

  it("matches household-decreased template", () => {
    const current = makeRecord({ householdSize: 1, fplPercent: 125 })
    const prior = makeRecord({ householdSize: 3, fplPercent: 125, coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/household size/i)
  })

  it("matches gained-employer template", () => {
    const current = makeRecord({ programCode: "employer_sponsored_insurance" })
    const prior = makeRecord({ programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/employer/i)
  })

  it("matches lost-employer template", () => {
    const current = makeRecord({ programCode: "connectorcare" })
    const prior = makeRecord({ programCode: "employer_sponsored_insurance", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/lost.*employer|employer.*insurance/i)
  })

  it("matches pregnancy template", () => {
    const current = makeRecord({ programCode: "pregnancy_standard" })
    const prior = makeRecord({ programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/pregnan/i)
  })

  it("matches medicare template", () => {
    const current = makeRecord({ programCode: "medicare_savings_program_senior" })
    const prior = makeRecord({ programCode: "careplus", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toMatch(/medicare/i)
  })

  it("returns null for unmatched multi-factor change (triggers LLM fallback)", () => {
    const current = makeRecord({ fplPercent: 200, householdSize: 3, programCode: "connectorcare" })
    const prior = makeRecord({ fplPercent: 350, householdSize: 1, programCode: "federal_tax_credits", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toBeNull()
  })

  it("FPL boundary: exactly 138% is treated as below threshold for careplus", () => {
    const current = makeRecord({ fplPercent: 138, programCode: "careplus" })
    const prior = makeRecord({ fplPercent: 139, programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("138%")
  })

  it("FPL boundary: exactly 300% is treated as above for connectorcare exit", () => {
    const current = makeRecord({ fplPercent: 300, programCode: "federal_tax_credits" })
    const prior = makeRecord({ fplPercent: 299, programCode: "connectorcare", coverageYear: 2025 })
    const result = applyRulesTemplate(current, prior)
    expect(result).toContain("300%")
  })
})

describe("FALLBACK_EXPLANATION", () => {
  it("is a non-empty string", () => {
    expect(typeof FALLBACK_EXPLANATION).toBe("string")
    expect(FALLBACK_EXPLANATION.length).toBeGreaterThan(10)
  })
})
