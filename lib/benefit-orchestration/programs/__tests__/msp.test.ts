import { describe, it, expect } from "vitest"
import { evaluateMSP } from "@/lib/benefit-orchestration/programs/msp"
import type { FamilyProfile } from "@/lib/benefit-orchestration/types"
import { emptyIncome } from "@/lib/benefit-orchestration/fpl-utils"

function profile(overrides: Partial<FamilyProfile> = {}): FamilyProfile {
  return {
    age: 70,
    pregnant: false,
    disabled: false,
    blind: false,
    over65: true,
    hasMedicare: true,
    hasPrivateInsurance: false,
    hasEmployerInsurance: false,
    citizenshipStatus: "citizen",
    stateResident: true,
    employmentStatus: "retired",
    income: emptyIncome(),
    assets: { bankAccounts: 0, investments: 0, realEstate: 0, vehicles: 0, other: 0 },
    housingStatus: "owner",
    monthlyRent: 0,
    utilityTypes: [],
    taxFiler: true,
    filingStatus: "single",
    householdMembers: [],
    householdSize: 1,
    childrenUnder5: 0,
    childrenUnder13: 0,
    childrenUnder18: 0,
    childrenUnder19: 0,
    ...overrides,
  }
}

// ── Hard exclusions ───────────────────────────────────────────────────────────

describe("evaluateMSP — hard exclusions", () => {
  it("returns null for non-MA resident", () => {
    expect(evaluateMSP(profile({ stateResident: false }), 80)).toBeNull()
  })

  it("returns null when not enrolled in Medicare", () => {
    expect(evaluateMSP(profile({ hasMedicare: false }), 80)).toBeNull()
  })

  it("returns null for undocumented", () => {
    expect(evaluateMSP(profile({ citizenshipStatus: "undocumented" }), 80)).toBeNull()
  })

  it("returns null for 'other' citizenship", () => {
    expect(evaluateMSP(profile({ citizenshipStatus: "other" }), 80)).toBeNull()
  })

  it("returns null when FPL exceeds 135%", () => {
    expect(evaluateMSP(profile(), 136)).toBeNull()
    expect(evaluateMSP(profile(), 200)).toBeNull()
  })
})

// ── QMB (≤100% FPL) ──────────────────────────────────────────────────────────

describe("evaluateMSP — QMB at ≤100% FPL", () => {
  it("returns a result with 'likely' status", () => {
    const result = evaluateMSP(profile(), 90)
    expect(result?.eligibilityStatus).toBe("likely")
  })

  it("estimated monthly value includes Part B premium + copay coverage (~$385)", () => {
    const result = evaluateMSP(profile(), 90)
    expect(result?.estimatedMonthlyValue).toBe(385) // 185 + 200
  })

  it("confidence is 87", () => {
    expect(evaluateMSP(profile(), 80)?.confidence).toBe(87)
  })

  it("valueNote mentions QMB", () => {
    expect(evaluateMSP(profile(), 90)?.valueNote).toContain("QMB")
  })
})

// ── SLMB (100–120% FPL) ──────────────────────────────────────────────────────

describe("evaluateMSP — SLMB at 100–120% FPL", () => {
  it("returns 'likely' status", () => {
    expect(evaluateMSP(profile(), 110)?.eligibilityStatus).toBe("likely")
  })

  it("estimated monthly value equals Part B premium ($185)", () => {
    expect(evaluateMSP(profile(), 110)?.estimatedMonthlyValue).toBe(185)
  })

  it("confidence is 82", () => {
    expect(evaluateMSP(profile(), 110)?.confidence).toBe(82)
  })

  it("valueNote mentions SLMB", () => {
    expect(evaluateMSP(profile(), 110)?.valueNote).toContain("SLMB")
  })
})

// ── QI (120–135% FPL) ────────────────────────────────────────────────────────

describe("evaluateMSP — QI at 120–135% FPL", () => {
  it("returns 'possibly' status", () => {
    expect(evaluateMSP(profile(), 130)?.eligibilityStatus).toBe("possibly")
  })

  it("estimated monthly value equals Part B premium ($185)", () => {
    expect(evaluateMSP(profile(), 130)?.estimatedMonthlyValue).toBe(185)
  })

  it("confidence is 75", () => {
    expect(evaluateMSP(profile(), 130)?.confidence).toBe(75)
  })

  it("valueNote mentions QI", () => {
    expect(evaluateMSP(profile(), 130)?.valueNote).toContain("QI")
  })
})

// ── Result structure ──────────────────────────────────────────────────────────

describe("evaluateMSP — result structure", () => {
  it("programId is 'msp'", () => {
    expect(evaluateMSP(profile(), 80)?.programId).toBe("msp")
  })

  it("category is 'healthcare'", () => {
    expect(evaluateMSP(profile(), 80)?.category).toBe("healthcare")
  })

  it("administeredBy is 'MA MassHealth'", () => {
    expect(evaluateMSP(profile(), 80)?.administeredBy).toBe("MA MassHealth")
  })

  it("estimatedAnnualValue equals estimatedMonthlyValue × 12", () => {
    const result = evaluateMSP(profile(), 80)!
    expect(result.estimatedAnnualValue).toBe(result.estimatedMonthlyValue * 12)
  })

  it("bundleWith includes masshealth programs", () => {
    const result = evaluateMSP(profile(), 80)!
    expect(result.bundleWith).toBeTruthy()
    expect(result.bundleWith?.length).toBeGreaterThan(0)
  })

  it("processingTime is defined", () => {
    expect(evaluateMSP(profile(), 80)?.processingTime).toBeTruthy()
  })

  it("exactly at 135% FPL still qualifies", () => {
    expect(evaluateMSP(profile(), 135)).not.toBeNull()
  })

  it("exactly at 136% FPL does not qualify", () => {
    expect(evaluateMSP(profile(), 136)).toBeNull()
  })
})
