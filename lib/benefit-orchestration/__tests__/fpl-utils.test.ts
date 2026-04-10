import { describe, it, expect } from "vitest"
import {
  sumIncome,
  computeTotalMonthlyIncome,
  computeEarnedIncome,
  computeTotalAssets,
  computeDerivedFields,
  computeMAGIMonthly,
  emptyIncome,
  getAnnualFPL,
  getMonthlyFPL,
  getIncomeAsFPLPercent,
  FPL_TABLE_2026,
} from "@/lib/benefit-orchestration/fpl-utils"
import type { FamilyProfile, IncomeBreakdown, HouseholdMemberProfile } from "@/lib/benefit-orchestration/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function income(overrides: Partial<IncomeBreakdown> = {}): IncomeBreakdown {
  return { ...emptyIncome(), ...overrides }
}

function member(overrides: Partial<HouseholdMemberProfile>): HouseholdMemberProfile {
  return {
    id: "m1",
    relationship: "child",
    age: 5,
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
    utilityTypes: ["heat"],
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

// ── Re-exports from eligibility-engine ───────────────────────────────────────

describe("re-exported FPL functions", () => {
  it("getAnnualFPL(1) returns 15060", () => {
    expect(getAnnualFPL(1)).toBe(15_060)
  })

  it("getMonthlyFPL(1) equals round(15060/12)", () => {
    expect(getMonthlyFPL(1)).toBe(Math.round(15_060 / 12))
  })

  it("getIncomeAsFPLPercent(15060, 1) equals 100", () => {
    expect(getIncomeAsFPLPercent(15_060, 1)).toBe(100)
  })

  it("FPL_TABLE_2026 has 8 entries", () => {
    expect(FPL_TABLE_2026).toHaveLength(8)
  })
})

// ── sumIncome ─────────────────────────────────────────────────────────────────

describe("sumIncome", () => {
  it("returns 0 for empty income", () => {
    expect(sumIncome(emptyIncome())).toBe(0)
  })

  it("sums all 12 income fields", () => {
    const inc = income({
      wages: 1000,
      selfEmployment: 200,
      unemployment: 300,
      socialSecurity: 400,
      ssi: 50,
      pension: 100,
      rental: 150,
      interest: 25,
      childSupport: 75,
      alimony: 80,
      veterans: 120,
      other: 50,
    })
    expect(sumIncome(inc)).toBe(2550)
  })

  it("handles a single non-zero field", () => {
    expect(sumIncome(income({ wages: 3000 }))).toBe(3000)
  })
})

// ── emptyIncome ───────────────────────────────────────────────────────────────

describe("emptyIncome", () => {
  it("returns an object with 12 zero fields", () => {
    const empty = emptyIncome()
    expect(Object.values(empty).every((v) => v === 0)).toBe(true)
    expect(Object.keys(empty)).toHaveLength(12)
  })
})

// ── computeTotalMonthlyIncome ─────────────────────────────────────────────────

describe("computeTotalMonthlyIncome", () => {
  it("returns primary income when no members", () => {
    const p = profile({ income: income({ wages: 2000 }) })
    expect(computeTotalMonthlyIncome(p)).toBe(2000)
  })

  it("adds member income to primary income", () => {
    const p = profile({
      income: income({ wages: 2000 }),
      householdMembers: [
        member({ income: income({ wages: 500 }) }),
        member({ id: "m2", income: income({ socialSecurity: 300 }) }),
      ],
    })
    expect(computeTotalMonthlyIncome(p)).toBe(2800)
  })

  it("returns 0 when all income is zero", () => {
    expect(computeTotalMonthlyIncome(profile())).toBe(0)
  })
})

// ── computeEarnedIncome ───────────────────────────────────────────────────────

describe("computeEarnedIncome", () => {
  it("includes wages and self-employment only", () => {
    const p = profile({
      income: income({ wages: 1000, selfEmployment: 500, socialSecurity: 800 }),
    })
    expect(computeEarnedIncome(p)).toBe(1500)
  })

  it("includes member earned income", () => {
    const p = profile({
      income: income({ wages: 1000 }),
      householdMembers: [member({ income: income({ wages: 600, selfEmployment: 200 }) })],
    })
    expect(computeEarnedIncome(p)).toBe(1800)
  })

  it("returns 0 for SSI/SS-only income", () => {
    const p = profile({ income: income({ socialSecurity: 900, ssi: 200 }) })
    expect(computeEarnedIncome(p)).toBe(0)
  })
})

// ── computeTotalAssets ────────────────────────────────────────────────────────

describe("computeTotalAssets", () => {
  it("returns 0 for default profile", () => {
    expect(computeTotalAssets(profile())).toBe(0)
  })

  it("sums all 5 asset fields", () => {
    const p = profile({
      assets: { bankAccounts: 1000, investments: 2000, realEstate: 50000, vehicles: 5000, other: 500 },
    })
    expect(computeTotalAssets(p)).toBe(58_500)
  })
})

// ── computeDerivedFields ──────────────────────────────────────────────────────

describe("computeDerivedFields", () => {
  it("householdSize is 1 + member count", () => {
    const p = profile({ householdMembers: [member({}), member({ id: "m2" })] })
    const derived = computeDerivedFields(p)
    expect(derived.householdSize).toBe(3)
  })

  it("counts children under 5 correctly", () => {
    const p = profile({
      age: 30,
      householdMembers: [
        member({ age: 2 }),
        member({ id: "m2", age: 4 }),
        member({ id: "m3", age: 6 }),
      ],
    })
    const derived = computeDerivedFields(p)
    expect(derived.childrenUnder5).toBe(2)
  })

  it("counts children under 19 correctly", () => {
    const p = profile({
      age: 35,
      householdMembers: [
        member({ age: 10 }),
        member({ id: "m2", age: 17 }),
        member({ id: "m3", age: 20, relationship: "other_relative" }),
      ],
    })
    const derived = computeDerivedFields(p)
    expect(derived.childrenUnder19).toBe(2)
  })

  it("includes primary applicant in child counts when age < 19", () => {
    const p = profile({
      age: 15,
      householdMembers: [member({ age: 8 })],
    })
    const derived = computeDerivedFields(p)
    expect(derived.childrenUnder19).toBe(2) // primary (15) + member (8)
    expect(derived.childrenUnder18).toBe(2)
  })

  it("does not count primary adult in child fields", () => {
    const p = profile({ age: 35, householdMembers: [] })
    const derived = computeDerivedFields(p)
    expect(derived.childrenUnder5).toBe(0)
    expect(derived.childrenUnder19).toBe(0)
  })
})

// ── computeMAGIMonthly ────────────────────────────────────────────────────────

describe("computeMAGIMonthly", () => {
  it("includes wages, self-employment, unemployment in MAGI", () => {
    const p = profile({
      income: income({ wages: 2000, selfEmployment: 500, unemployment: 300 }),
    })
    expect(computeMAGIMonthly(p)).toBe(2800)
  })

  it("includes 85% of social security in MAGI", () => {
    const p = profile({ income: income({ socialSecurity: 1000 }) })
    expect(computeMAGIMonthly(p)).toBe(850)
  })

  it("excludes SSI, child support, alimony, veterans from MAGI", () => {
    const p = profile({
      income: income({ ssi: 500, childSupport: 200, alimony: 100, veterans: 150 }),
    })
    expect(computeMAGIMonthly(p)).toBe(0)
  })

  it("adds member MAGI to primary MAGI", () => {
    const p = profile({
      income: income({ wages: 2000 }),
      householdMembers: [member({ income: income({ wages: 1000 }) })],
    })
    expect(computeMAGIMonthly(p)).toBe(3000)
  })

  it("returns 0 for no income profile", () => {
    expect(computeMAGIMonthly(profile())).toBe(0)
  })
})
