import { describe, it, expect } from "vitest"
import { evaluateMassHealth } from "@/lib/benefit-orchestration/programs/masshealth"
import type { FamilyProfile, HouseholdMemberProfile } from "@/lib/benefit-orchestration/types"
import { emptyIncome } from "@/lib/benefit-orchestration/fpl-utils"
import { getAnnualFPL } from "@/lib/eligibility-engine"

function member(overrides: Partial<HouseholdMemberProfile> = {}): HouseholdMemberProfile {
  return {
    id: "m1",
    relationship: "child",
    age: 8,
    pregnant: false,
    disabled: false,
    over65: false,
    citizenshipStatus: "citizen",
    hasMedicare: false,
    income: emptyIncome(),
    isTaxDependent: true,
    isStudent: false,
    isCaringForChild: false,
    ...overrides,
  }
}

function profile(overrides: Partial<FamilyProfile> = {}): FamilyProfile {
  return {
    age: 35,
    pregnant: false,
    disabled: false,
    blind: false,
    over65: false,
    hasMedicare: false,
    hasPrivateInsurance: false,
    hasEmployerInsurance: false,
    citizenshipStatus: "citizen",
    stateResident: true,
    employmentStatus: "employed",
    income: emptyIncome(),
    assets: { bankAccounts: 0, investments: 0, realEstate: 0, vehicles: 0, other: 0 },
    housingStatus: "renter",
    monthlyRent: 1000,
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

// ── Non-MA resident ───────────────────────────────────────────────────────────

describe("evaluateMassHealth — non-MA resident", () => {
  it("returns empty array", () => {
    expect(evaluateMassHealth(profile({ stateResident: false }), 100)).toEqual([])
  })
})

// ── Undocumented ──────────────────────────────────────────────────────────────

describe("evaluateMassHealth — undocumented", () => {
  it("returns MassHealth Limited for non-pregnant", () => {
    const results = evaluateMassHealth(profile({ citizenshipStatus: "undocumented" }), 80)
    expect(results).toHaveLength(1)
    expect(results[0].programId).toBe("masshealth_limited")
    expect(results[0].eligibilityStatus).toBe("likely")
  })

  it("adds pregnancy track for pregnant undocumented", () => {
    const results = evaluateMassHealth(
      profile({ citizenshipStatus: "undocumented", pregnant: true }),
      80
    )
    const ids = results.map((r) => r.programId)
    expect(ids).toContain("masshealth_limited")
    expect(ids).toContain("masshealth_standard_pregnancy")
  })

  it("pregnancy result has high confidence", () => {
    const results = evaluateMassHealth(
      profile({ citizenshipStatus: "undocumented", pregnant: true }),
      80
    )
    const preg = results.find((r) => r.programId === "masshealth_standard_pregnancy")
    expect(preg?.confidence).toBeGreaterThanOrEqual(85)
  })
})

// ── Pregnancy (qualified) ─────────────────────────────────────────────────────

describe("evaluateMassHealth — pregnancy, qualified", () => {
  it("includes pregnancy result at ≤200% FPL", () => {
    const results = evaluateMassHealth(profile({ pregnant: true }), 150)
    expect(results.some((r) => r.programId === "masshealth_standard_pregnancy")).toBe(true)
  })

  it("does NOT include pregnancy result above 200% FPL", () => {
    // evaluateMassHealth computes MAGI internally — must set income high enough
    // For HH1 (FPL=$15,060), 200% = $30,120/yr → $2,510/mo. Use $3,000/mo wages.
    const p = profile({
      pregnant: true,
      income: { ...emptyIncome(), wages: 3_000 }, // MAGI ≈ 239% FPL
    })
    const results = evaluateMassHealth(p, 239)
    expect(results.some((r) => r.programId === "masshealth_standard_pregnancy")).toBe(false)
  })

  it("estimated monthly value for pregnancy is $800", () => {
    const results = evaluateMassHealth(profile({ pregnant: true }), 150)
    const preg = results.find((r) => r.programId === "masshealth_standard_pregnancy")
    expect(preg?.estimatedMonthlyValue).toBe(800)
  })
})

// ── Children in household ─────────────────────────────────────────────────────

describe("evaluateMassHealth — children in household", () => {
  it("returns masshealth_standard for children at ≤150% FPL", () => {
    const p = profile({
      householdMembers: [member({ relationship: "child", age: 5 })],
      householdSize: 2,
    })
    const results = evaluateMassHealth(p, 100)
    expect(results.some((r) => r.programId === "masshealth_standard")).toBe(true)
  })

  it("returns masshealth_family_assistance for children at 150–300% FPL", () => {
    // HH2 FPL=$20,440 → 200% = $40,880/yr → $3,407/mo. Use $3,500/mo wages (MAGI ≈ 206% FPL).
    const p = profile({
      income: { ...emptyIncome(), wages: 3_500 },
      householdMembers: [member({ relationship: "child", age: 10 })],
      householdSize: 2,
    })
    const results = evaluateMassHealth(p, 206)
    expect(results.some((r) => r.programId === "masshealth_family_assistance")).toBe(true)
  })

  it("monthly value scales by number of children", () => {
    const p = profile({
      householdMembers: [
        member({ relationship: "child", age: 6 }),
        member({ id: "m2", relationship: "child", age: 8 }),
      ],
      householdSize: 3,
    })
    const results = evaluateMassHealth(p, 100)
    const child = results.find((r) => r.programId === "masshealth_standard")
    expect(child?.estimatedMonthlyValue).toBe(800) // 400 * 2 children
  })

  it("does not add child result if no children in household", () => {
    const results = evaluateMassHealth(profile({ householdMembers: [] }), 100)
    // Adult profile — should have CarePlus, not child track
    const childResult = results.find((r) => r.programId === "masshealth_standard")
    // Only CarePlus applies for adult with no children
    expect(childResult).toBeUndefined()
  })
})

// ── Adults 19–64 ──────────────────────────────────────────────────────────────

describe("evaluateMassHealth — adults 19–64", () => {
  it("returns CarePlus for non-disabled adult ≤138% FPL without Medicare", () => {
    // MAGI = 0 → 0% FPL → qualifies for CarePlus
    const results = evaluateMassHealth(profile({ age: 30 }), 100)
    expect(results.some((r) => r.programId === "masshealth_careplus")).toBe(true)
  })

  it("returns MassHealth Standard for disabled adult ≤133% FPL", () => {
    const results = evaluateMassHealth(profile({ age: 40, disabled: true }), 100)
    expect(results.some((r) => r.programId === "masshealth_standard")).toBe(true)
    // Should NOT have careplus if standard fires
    expect(results.some((r) => r.programId === "masshealth_careplus")).toBe(false)
  })

  it("returns ConnectorCare for adult at 139–300% FPL", () => {
    const p = profile({
      age: 35,
      income: { ...emptyIncome(), wages: Math.round((getAnnualFPL(1) * 2) / 12) },
    })
    const results = evaluateMassHealth(p, 200)
    expect(results.some((r) => r.programId === "connector_care")).toBe(true)
  })

  it("returns health_connector_credits for adult at 300–500% FPL", () => {
    const p = profile({
      age: 35,
      income: { ...emptyIncome(), wages: Math.round((getAnnualFPL(1) * 4) / 12) },
    })
    const results = evaluateMassHealth(p, 400)
    expect(results.some((r) => r.programId === "health_connector_credits")).toBe(true)
  })

  it("returns empty for adult above 500% FPL", () => {
    // HH1 FPL=$15,060 → 500% = $75,300/yr → $6,275/mo. Use $7,000/mo wages.
    const p = profile({
      age: 35,
      income: { ...emptyIncome(), wages: 7_000 }, // MAGI ≈ 558% FPL
    })
    const results = evaluateMassHealth(p, 558)
    expect(results).toHaveLength(0)
  })

  it("does NOT return CarePlus for Medicare enrollees", () => {
    const results = evaluateMassHealth(profile({ age: 50, hasMedicare: true }), 100)
    expect(results.some((r) => r.programId === "masshealth_careplus")).toBe(false)
  })
})

// ── Seniors 65+ ───────────────────────────────────────────────────────────────

describe("evaluateMassHealth — seniors 65+", () => {
  it("returns masshealth_standard dual eligible for Medicare + ≤100% FPL", () => {
    const results = evaluateMassHealth(profile({ age: 70, hasMedicare: true }), 90)
    expect(results.some((r) => r.programId === "masshealth_standard")).toBe(true)
  })

  it("estimated annual value for dual eligible is $8400", () => {
    const results = evaluateMassHealth(profile({ age: 70, hasMedicare: true }), 90)
    const r = results.find((r) => r.programId === "masshealth_standard")
    expect(r?.estimatedAnnualValue).toBe(8400)
  })
})
