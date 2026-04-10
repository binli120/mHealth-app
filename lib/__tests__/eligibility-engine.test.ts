import { describe, it, expect } from "vitest"
import {
  getAnnualFPL,
  getMonthlyFPL,
  getIncomeAsFPLPercent,
  runEligibilityCheck,
  FPL_TABLE_2026,
} from "@/lib/eligibility-engine"
import type { ScreenerData } from "@/lib/eligibility-engine"

// ── FPL math ──────────────────────────────────────────────────────────────────

describe("getAnnualFPL", () => {
  it("returns base amount for household of 1", () => {
    expect(getAnnualFPL(1)).toBe(15_060)
  })

  it("adds $5,380 per additional person", () => {
    expect(getAnnualFPL(2)).toBe(20_440)
    expect(getAnnualFPL(4)).toBe(31_200)
    expect(getAnnualFPL(8)).toBe(15_060 + 7 * 5_380) // 52,720
  })

  it("clamps to 1 for household of 0 or negative", () => {
    expect(getAnnualFPL(0)).toBe(getAnnualFPL(1))
    expect(getAnnualFPL(-5)).toBe(getAnnualFPL(1))
  })
})

describe("getMonthlyFPL", () => {
  it("returns annual FPL divided by 12, rounded", () => {
    expect(getMonthlyFPL(1)).toBe(Math.round(15_060 / 12))
    expect(getMonthlyFPL(4)).toBe(Math.round(31_200 / 12))
  })
})

describe("getIncomeAsFPLPercent", () => {
  it("returns 100 when income equals FPL", () => {
    expect(getIncomeAsFPLPercent(15_060, 1)).toBe(100)
  })

  it("returns 0 for zero income", () => {
    expect(getIncomeAsFPLPercent(0, 1)).toBe(0)
  })

  it("correctly calculates 138% FPL", () => {
    const fpl = getAnnualFPL(1)
    expect(getIncomeAsFPLPercent(Math.round(fpl * 1.38), 1)).toBe(138)
  })

  it("rounds to nearest integer", () => {
    // 50% of FPL for HH1 = 7530 → 50%
    expect(getIncomeAsFPLPercent(7_530, 1)).toBe(50)
  })
})

// ── FPL reference table ───────────────────────────────────────────────────────

describe("FPL_TABLE_2026", () => {
  it("has 8 entries", () => {
    expect(FPL_TABLE_2026).toHaveLength(8)
  })

  it("each entry has correct household size", () => {
    FPL_TABLE_2026.forEach((row, i) => {
      expect(row.householdSize).toBe(i + 1)
    })
  })

  it("annualFPL matches getAnnualFPL", () => {
    FPL_TABLE_2026.forEach((row) => {
      expect(row.annualFPL).toBe(getAnnualFPL(row.householdSize))
    })
  })

  it("pct138 is 138% of annualFPL, rounded", () => {
    FPL_TABLE_2026.forEach((row) => {
      expect(row.pct138).toBe(Math.round(row.annualFPL * 1.38))
    })
  })
})

// ── runEligibilityCheck — helper ──────────────────────────────────────────────

function base(overrides: Partial<ScreenerData> = {}): ScreenerData {
  return {
    livesInMA:            true,
    age:                  30,
    isPregnant:           false,
    hasDisability:        false,
    hasMedicare:          false,
    householdSize:        1,
    annualIncome:         0,
    citizenshipStatus:    "citizen",
    hasEmployerInsurance: false,
    ...overrides,
  }
}

// ── Non-MA resident ───────────────────────────────────────────────────────────

describe("runEligibilityCheck — non-MA resident", () => {
  it("returns a single not_eligible_non_ma result", () => {
    const report = runEligibilityCheck(base({ livesInMA: false }))
    expect(report.results).toHaveLength(1)
    expect(report.results[0].code).toBe("not_eligible_non_ma")
    expect(report.results[0].status).toBe("unlikely")
  })

  it("still calculates FPL fields correctly", () => {
    const report = runEligibilityCheck(base({ livesInMA: false, annualIncome: 15_060, householdSize: 1 }))
    expect(report.fplPercent).toBe(100)
    expect(report.annualFPL).toBe(15_060)
  })

  it("summary mentions Massachusetts", () => {
    const report = runEligibilityCheck(base({ livesInMA: false }))
    expect(report.summary.toLowerCase()).toContain("massachusetts")
  })
})

// ── Undocumented status ───────────────────────────────────────────────────────

describe("runEligibilityCheck — undocumented", () => {
  it("returns MassHealth Limited for non-pregnant undocumented", () => {
    const report = runEligibilityCheck(base({ citizenshipStatus: "undocumented", isPregnant: false }))
    expect(report.results.some((r) => r.code === "masshealth_limited")).toBe(true)
    expect(report.results.some((r) => r.code === "pregnancy_undocumented_standard")).toBe(false)
  })

  it("adds pregnancy track for pregnant undocumented", () => {
    const report = runEligibilityCheck(base({ citizenshipStatus: "undocumented", isPregnant: true }))
    const codes = report.results.map((r) => r.code)
    expect(codes).toContain("masshealth_limited")
    expect(codes).toContain("pregnancy_undocumented_standard")
  })

  it("pregnancy result has 'likely' status", () => {
    const report = runEligibilityCheck(base({ citizenshipStatus: "undocumented", isPregnant: true }))
    const pregnancy = report.results.find((r) => r.code === "pregnancy_undocumented_standard")
    expect(pregnancy?.status).toBe("likely")
  })
})

// ── Pregnancy (qualified) ─────────────────────────────────────────────────────

describe("runEligibilityCheck — pregnant, qualified, ≤200% FPL", () => {
  it("includes pregnancy_standard result", () => {
    const report = runEligibilityCheck(
      base({ isPregnant: true, annualIncome: 20_000, householdSize: 2 })
    )
    expect(report.results.some((r) => r.code === "pregnancy_standard")).toBe(true)
  })

  it("does NOT include pregnancy_standard above 200% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ isPregnant: true, annualIncome: Math.round(fpl * 2.1), householdSize: 1 })
    )
    expect(report.results.some((r) => r.code === "pregnancy_standard")).toBe(false)
  })
})

// ── Children under 19 ─────────────────────────────────────────────────────────

describe("runEligibilityCheck — child under 19", () => {
  it("returns child_standard for child at ≤150% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 10, annualIncome: Math.round(fpl * 1.0), householdSize: 1 })
    )
    expect(report.results.some((r) => r.code === "child_standard")).toBe(true)
  })

  it("returns family_assistance_chip for child between 150–300% FPL", () => {
    const fpl = getAnnualFPL(2)
    const report = runEligibilityCheck(
      base({ age: 12, annualIncome: Math.round(fpl * 2.0), householdSize: 2 })
    )
    expect(report.results.some((r) => r.code === "family_assistance_chip")).toBe(true)
  })

  it("returns health_connector_child_plans for child above 300% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 15, annualIncome: Math.round(fpl * 3.5), householdSize: 1 })
    )
    expect(report.results.some((r) => r.code === "health_connector_child_plans")).toBe(true)
  })
})

// ── Adults 19–64 ──────────────────────────────────────────────────────────────

describe("runEligibilityCheck — adult 19–64", () => {
  it("returns careplus for income ≤138% FPL without Medicare", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 30, annualIncome: Math.round(fpl * 1.0), hasMedicare: false })
    )
    expect(report.results.some((r) => r.code === "careplus")).toBe(true)
  })

  it("returns connectorcare for income 139–300% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 30, annualIncome: Math.round(fpl * 2.0), hasMedicare: false })
    )
    expect(report.results.some((r) => r.code === "connectorcare")).toBe(true)
  })

  it("returns federal_tax_credits for income 300–500% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 30, annualIncome: Math.round(fpl * 4.0), hasMedicare: false })
    )
    expect(report.results.some((r) => r.code === "federal_tax_credits")).toBe(true)
  })

  it("returns employer_or_connector above 500% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 30, annualIncome: Math.round(fpl * 6.0), hasMedicare: false })
    )
    expect(report.results.some((r) => r.code === "employer_or_connector")).toBe(true)
  })

  it("returns adult_disability_standard for disabled adult at ≤133% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 40, hasDisability: true, annualIncome: Math.round(fpl * 1.0) })
    )
    expect(report.results.some((r) => r.code === "adult_disability_standard")).toBe(true)
  })

  it("returns medicare_savings_program_adult for Medicare + ≤135% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 50, hasMedicare: true, annualIncome: Math.round(fpl * 1.0) })
    )
    expect(report.results.some((r) => r.code === "medicare_savings_program_adult")).toBe(true)
  })

  it("includes employer_sponsored_insurance note when applicable", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 40, hasEmployerInsurance: true, annualIncome: Math.round(fpl * 2.0) })
    )
    expect(report.results.some((r) => r.code === "employer_sponsored_insurance")).toBe(true)
  })
})

// ── Seniors 65+ ───────────────────────────────────────────────────────────────

describe("runEligibilityCheck — senior 65+", () => {
  it("returns dual_eligible_standard for Medicare + ≤100% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 70, hasMedicare: true, annualIncome: Math.round(fpl * 0.9) })
    )
    expect(report.results.some((r) => r.code === "dual_eligible_standard")).toBe(true)
  })

  it("returns medicare_savings_program_senior for Medicare + ≤135% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 70, hasMedicare: true, annualIncome: Math.round(fpl * 1.1) })
    )
    expect(report.results.some((r) => r.code === "medicare_savings_program_senior")).toBe(true)
  })

  it("returns medigap_plans for Medicare + >135% FPL", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 70, hasMedicare: true, annualIncome: Math.round(fpl * 1.5) })
    )
    expect(report.results.some((r) => r.code === "medigap_plans")).toBe(true)
  })

  it("returns senior_no_medicare_standard for 65+ without Medicare", () => {
    const report = runEligibilityCheck(base({ age: 65, hasMedicare: false }))
    expect(report.results.some((r) => r.code === "senior_no_medicare_standard")).toBe(true)
  })
})

// ── Fallback ──────────────────────────────────────────────────────────────────

describe("runEligibilityCheck — fallback", () => {
  it("returns full_application_recommended when no rule matches", () => {
    // Scenario: 'other' citizenship + adult 35 — no specific rule fires
    const report = runEligibilityCheck(base({ citizenshipStatus: "other", age: 35 }))
    expect(report.results.some((r) => r.code === "full_application_recommended")).toBe(true)
  })
})

// ── Result ordering ───────────────────────────────────────────────────────────

describe("runEligibilityCheck — result ordering", () => {
  it("results are sorted by priority ascending", () => {
    const fpl = getAnnualFPL(1)
    const report = runEligibilityCheck(
      base({ age: 70, hasMedicare: true, annualIncome: Math.round(fpl * 0.9) })
    )
    for (let i = 1; i < report.results.length; i++) {
      expect(report.results[i].priority).toBeGreaterThanOrEqual(report.results[i - 1].priority)
    }
  })
})
