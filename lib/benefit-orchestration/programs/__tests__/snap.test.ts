import { describe, it, expect } from "vitest"
import { evaluateSnap } from "@/lib/benefit-orchestration/programs/snap"
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

describe("evaluateSnap — hard exclusions", () => {
  it("returns null for non-MA resident", () => {
    expect(evaluateSnap(profile({ stateResident: false }), 50)).toBeNull()
  })

  it("returns null for undocumented", () => {
    expect(evaluateSnap(profile({ citizenshipStatus: "undocumented" }), 50)).toBeNull()
  })

  it("returns null for 'other' citizenship", () => {
    expect(evaluateSnap(profile({ citizenshipStatus: "other" }), 50)).toBeNull()
  })

  it("returns null when income exceeds 130% FPL (not categorically eligible)", () => {
    const fpl = getAnnualFPL(1)
    // 140% FPL monthly
    const wages = Math.round((fpl * 1.4) / 12)
    const p = profile({ income: { ...emptyIncome(), wages } })
    expect(evaluateSnap(p, 140)).toBeNull()
  })
})

// ── Categorical eligibility (SSI bypasses gross income test) ─────────────────

describe("evaluateSnap — categorical eligibility via SSI", () => {
  it("returns a result for SSI recipient even above 130% FPL", () => {
    const fpl = getAnnualFPL(1)
    const wages = Math.round((fpl * 1.5) / 12) // 150% FPL — above gross limit
    const p = profile({
      income: { ...emptyIncome(), wages, ssi: 100 }, // SSI makes them categorically eligible
    })
    expect(evaluateSnap(p, 150)).not.toBeNull()
  })
})

// ── Happy path — low income ───────────────────────────────────────────────────

describe("evaluateSnap — happy path", () => {
  it("returns a result for citizen with zero income", () => {
    const result = evaluateSnap(profile(), 0)
    expect(result).not.toBeNull()
    expect(result?.programId).toBe("snap")
  })

  it("eligibilityStatus is 'likely' for very low income", () => {
    const result = evaluateSnap(profile(), 0)
    expect(result?.eligibilityStatus).toBe("likely")
  })

  it("estimated monthly value > 0 for zero-income household", () => {
    const result = evaluateSnap(profile(), 0)
    expect(result?.estimatedMonthlyValue).toBeGreaterThan(0)
  })

  it("estimated monthly value ≤ max for household size 1 ($292)", () => {
    const result = evaluateSnap(profile(), 0)
    expect(result?.estimatedMonthlyValue).toBeLessThanOrEqual(292)
  })

  it("programId is 'snap'", () => {
    expect(evaluateSnap(profile(), 50)?.programId).toBe("snap")
  })

  it("administeredBy is 'MA DTA'", () => {
    expect(evaluateSnap(profile(), 50)?.administeredBy).toBe("MA DTA")
  })
})

// ── Asset test for elderly/disabled ──────────────────────────────────────────

describe("evaluateSnap — asset test (elderly)", () => {
  it("returns 'possibly' result when elderly household exceeds $4,250 asset limit", () => {
    const p = profile({
      over65: true,
      assets: { bankAccounts: 5000, investments: 0, realEstate: 0, vehicles: 0, other: 0 },
    })
    const result = evaluateSnap(p, 80)
    expect(result).not.toBeNull()
    expect(result?.eligibilityStatus).toBe("possibly")
    expect(result?.ineligibleReason).toBeTruthy()
  })

  it("does not fail asset test for non-elderly household with same assets", () => {
    const p = profile({
      age: 35,
      over65: false,
      assets: { bankAccounts: 5000, investments: 0, realEstate: 0, vehicles: 0, other: 0 },
    })
    const result = evaluateSnap(p, 80)
    // Non-elderly → categorical eligibility waives asset test → should still pass
    expect(result?.eligibilityStatus).not.toBe("possibly")
  })
})

// ── Household size scaling ────────────────────────────────────────────────────

describe("evaluateSnap — household size scaling", () => {
  it("larger household gets higher max benefit", () => {
    const single = evaluateSnap(profile({ householdSize: 1 }), 50)
    const family = evaluateSnap(profile({
      householdSize: 4,
      householdMembers: [
        member({}),
        member({ id: "m2" }),
        member({ id: "m3" }),
      ],
    }), 50)
    expect((family?.estimatedMonthlyValue ?? 0)).toBeGreaterThan(single?.estimatedMonthlyValue ?? 0)
  })
})

// ── Confidence levels ─────────────────────────────────────────────────────────

describe("evaluateSnap — confidence levels", () => {
  it("confidence is 90 for income ≤80% FPL", () => {
    const result = evaluateSnap(profile(), 50)
    expect(result?.confidence).toBe(90)
  })

  it("confidence is 82 for income 80–100% FPL", () => {
    // 90% FPL — set via grossFPL
    const fpl = getAnnualFPL(1)
    const wages = Math.round((fpl * 0.90) / 12)
    const p = profile({ income: { ...emptyIncome(), wages } })
    const result = evaluateSnap(p, 90)
    expect(result?.confidence).toBe(82)
  })
})

// ── Result structure ──────────────────────────────────────────────────────────

describe("evaluateSnap — result structure", () => {
  it("has bundleWith tafdc and eaedc", () => {
    const result = evaluateSnap(profile(), 50)
    expect(result?.bundleWith).toContain("tafdc")
    expect(result?.bundleWith).toContain("eaedc")
  })

  it("applicationUrl is dta.mass.gov", () => {
    expect(evaluateSnap(profile(), 50)?.applicationUrl).toContain("dta.mass.gov")
  })

  it("estimatedAnnualValue equals estimatedMonthlyValue * 12", () => {
    const result = evaluateSnap(profile(), 50)!
    expect(result.estimatedAnnualValue).toBe(result.estimatedMonthlyValue * 12)
  })
})
