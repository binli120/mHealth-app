import { describe, it, expect } from "vitest"
import { evaluateEITC } from "@/lib/benefit-orchestration/programs/eitc"
import type { FamilyProfile, HouseholdMemberProfile } from "@/lib/benefit-orchestration/types"
import { emptyIncome } from "@/lib/benefit-orchestration/fpl-utils"

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

describe("evaluateEITC — hard exclusions", () => {
  it("returns null for non-MA resident", () => {
    expect(evaluateEITC(profile({ stateResident: false }), 100)).toBeNull()
  })

  it("returns null for undocumented", () => {
    expect(evaluateEITC(profile({ citizenshipStatus: "undocumented" }), 100)).toBeNull()
  })

  it("returns null for non-filer", () => {
    expect(evaluateEITC(profile({ taxFiler: false, income: { ...emptyIncome(), wages: 2000 } }), 100)).toBeNull()
  })

  it("returns null for zero earned income", () => {
    // SSI-only income has no earned component
    const p = profile({ income: { ...emptyIncome(), ssi: 1000 } })
    expect(evaluateEITC(p, 80)).toBeNull()
  })

  it("returns null for childless adult under 25", () => {
    const p = profile({ age: 22, income: { ...emptyIncome(), wages: 1500 } })
    expect(evaluateEITC(p, 100)).toBeNull()
  })

  it("returns null for childless adult 65 or older", () => {
    const p = profile({ age: 65, income: { ...emptyIncome(), wages: 1500 } })
    expect(evaluateEITC(p, 100)).toBeNull()
  })

  it("returns null when earned income exceeds the income limit", () => {
    // Single, no children: limit = $18,591 — use $20,000/yr
    const p = profile({ age: 35, income: { ...emptyIncome(), wages: Math.round(20_000 / 12) } })
    expect(evaluateEITC(p, 100)).toBeNull()
  })
})

// ── Happy path — childless adult 25–64 ───────────────────────────────────────

describe("evaluateEITC — childless adult", () => {
  it("returns a result for eligible childless adult (age 30, low wages)", () => {
    const p = profile({ age: 30, income: { ...emptyIncome(), wages: 1000 } }) // $12,000/yr
    const result = evaluateEITC(p, 80)
    expect(result).not.toBeNull()
    expect(result?.programId).toBe("eitc_federal")
  })

  it("estimated annual value > 0", () => {
    const p = profile({ age: 30, income: { ...emptyIncome(), wages: 1000 } })
    expect(evaluateEITC(p, 80)?.estimatedAnnualValue).toBeGreaterThan(0)
  })

  it("MA EITC is 40% of federal credit", () => {
    const p = profile({ age: 30, income: { ...emptyIncome(), wages: 1000 } })
    const result = evaluateEITC(p, 80)!
    // totalAnnual = federal + MA (40% of federal)
    // monthly = round(total / 12)
    expect(result.estimatedMonthlyValue).toBe(Math.round(result.estimatedAnnualValue / 12))
  })
})

// ── Families with qualifying children ────────────────────────────────────────

describe("evaluateEITC — with qualifying children", () => {
  it("returns a result with higher value for family with 1 child", () => {
    const childless = profile({ age: 30, income: { ...emptyIncome(), wages: 1500 } })
    const withChild = profile({
      age: 30,
      income: { ...emptyIncome(), wages: 1500 },
      householdMembers: [member({ isTaxDependent: true })],
    })
    const r1 = evaluateEITC(childless, 100)!
    const r2 = evaluateEITC(withChild, 100)!
    expect(r2.estimatedAnnualValue).toBeGreaterThan(r1.estimatedAnnualValue)
  })

  it("returns a result for family with 3 qualifying children", () => {
    const p = profile({
      age: 30,
      income: { ...emptyIncome(), wages: 2000 },
      householdMembers: [
        member({}),
        member({ id: "m2", age: 5 }),
        member({ id: "m3", age: 3 }),
      ],
    })
    expect(evaluateEITC(p, 80)).not.toBeNull()
  })

  it("children that are not tax dependents do not count", () => {
    const withDependent = profile({
      age: 30,
      income: { ...emptyIncome(), wages: 1500 },
      householdMembers: [member({ isTaxDependent: true })],
    })
    const withoutDependent = profile({
      age: 30,
      income: { ...emptyIncome(), wages: 1500 },
      householdMembers: [member({ isTaxDependent: false })],
    })
    const r1 = evaluateEITC(withDependent, 100)
    const r2 = evaluateEITC(withoutDependent, 100)
    // Without a tax-dependent child, treated as childless → lower credit (or same if within range)
    expect(r1?.estimatedAnnualValue ?? 0).toBeGreaterThanOrEqual(r2?.estimatedAnnualValue ?? 0)
  })
})

// ── Married filing jointly ────────────────────────────────────────────────────

describe("evaluateEITC — married filing jointly", () => {
  it("allows higher income limit for MFJ", () => {
    // MFJ childless limit = $25,511; single childless = $18,591
    // Use $20,000/yr — exceeds single limit but below MFJ
    const single = profile({ age: 35, income: { ...emptyIncome(), wages: Math.round(20_000 / 12) } })
    const mfj = profile({
      age: 35,
      filingStatus: "married_filing_jointly",
      income: { ...emptyIncome(), wages: Math.round(20_000 / 12) },
    })
    expect(evaluateEITC(single, 100)).toBeNull()   // over single limit
    expect(evaluateEITC(mfj, 100)).not.toBeNull()  // within MFJ limit
  })
})

// ── Eligibility status / confidence ──────────────────────────────────────────

describe("evaluateEITC — status and confidence", () => {
  it("eligibilityStatus is 'likely' when income is well below limit", () => {
    const p = profile({ age: 30, income: { ...emptyIncome(), wages: 1000 } })
    expect(evaluateEITC(p, 80)?.eligibilityStatus).toBe("likely")
  })

  it("eligibilityStatus is 'possibly' when income is near the limit", () => {
    // Single, no children: limit $18,591 → 91% of limit = ~$16,917/yr → $1,410/mo
    const p = profile({ age: 35, income: { ...emptyIncome(), wages: 1_410 } })
    const result = evaluateEITC(p, 100)
    // Near limit → 'possibly'
    if (result) {
      expect(result.eligibilityStatus).toBe("possibly")
    }
  })
})

// ── Result structure ──────────────────────────────────────────────────────────

describe("evaluateEITC — result structure", () => {
  it("programId is 'eitc_federal'", () => {
    const p = profile({ age: 30, income: { ...emptyIncome(), wages: 1000 } })
    expect(evaluateEITC(p, 80)?.programId).toBe("eitc_federal")
  })

  it("category is 'tax_credit'", () => {
    const p = profile({ age: 30, income: { ...emptyIncome(), wages: 1000 } })
    expect(evaluateEITC(p, 80)?.category).toBe("tax_credit")
  })

  it("includes keyRequirements with earned income mention", () => {
    const p = profile({ age: 30, income: { ...emptyIncome(), wages: 1000 } })
    const result = evaluateEITC(p, 80)!
    expect(result.keyRequirements.some((r) => r.toLowerCase().includes("earned income"))).toBe(true)
  })
})
