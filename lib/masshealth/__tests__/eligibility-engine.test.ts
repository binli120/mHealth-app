/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect } from "vitest"
import {
  getAnnualFPL,
  getMonthlyFPL,
  getIncomeAsFPLPercent,
  runEligibilityCheck,
  FPL_TABLE_2026,
  type ScreenerData,
} from "@/lib/eligibility-engine"

// ─── FPL Helpers ─────────────────────────────────────────────────────────────

describe("getAnnualFPL (2026)", () => {
  it("returns $15,060 for household of 1", () => {
    expect(getAnnualFPL(1)).toBe(15060)
  })

  it("returns $20,440 for household of 2", () => {
    expect(getAnnualFPL(2)).toBe(20440)
  })

  it("returns $25,820 for household of 3", () => {
    expect(getAnnualFPL(3)).toBe(25820)
  })

  it("returns $31,200 for household of 4", () => {
    expect(getAnnualFPL(4)).toBe(31200)
  })

  it("handles size 0 gracefully (clamps to 1)", () => {
    expect(getAnnualFPL(0)).toBe(15060)
  })
})

describe("getMonthlyFPL", () => {
  it("returns the monthly equivalent of annual FPL for size 1", () => {
    expect(getMonthlyFPL(1)).toBe(Math.round(15060 / 12))
  })
})

describe("getIncomeAsFPLPercent", () => {
  it("returns 100% when income equals 1-person FPL", () => {
    expect(getIncomeAsFPLPercent(15060, 1)).toBe(100)
  })

  it("returns 0% when income is 0", () => {
    expect(getIncomeAsFPLPercent(0, 1)).toBe(0)
  })

  it("returns ~138% at CarePlus threshold for 1 person", () => {
    // 138% of $15,060 = $20,783
    const income = Math.round(15060 * 1.38)
    expect(getIncomeAsFPLPercent(income, 1)).toBe(138)
  })
})

describe("FPL_TABLE_2026", () => {
  it("has 8 rows (household sizes 1–8)", () => {
    expect(FPL_TABLE_2026).toHaveLength(8)
  })

  it("row 1 has correct annual FPL", () => {
    expect(FPL_TABLE_2026[0].annualFPL).toBe(15060)
  })

  it("each row has expected keys", () => {
    const row = FPL_TABLE_2026[0]
    expect(row).toHaveProperty("householdSize")
    expect(row).toHaveProperty("annualFPL")
    expect(row).toHaveProperty("monthlyFPL")
    expect(row).toHaveProperty("pct138")
    expect(row).toHaveProperty("pct200")
    expect(row).toHaveProperty("pct300")
    expect(row).toHaveProperty("pct400")
  })
})

// ─── Rule Engine ─────────────────────────────────────────────────────────────

// Helper to build a full ScreenerData with sensible defaults
function makeData(overrides: Partial<ScreenerData> = {}): ScreenerData {
  return {
    livesInMA: true,
    age: 35,
    isPregnant: false,
    hasDisability: false,
    hasMedicare: false,
    householdSize: 1,
    annualIncome: 0,
    citizenshipStatus: "citizen",
    hasEmployerInsurance: false,
    ...overrides,
  }
}

describe("runEligibilityCheck — Non-MA resident", () => {
  it("returns a single 'Not Eligible' result", () => {
    const report = runEligibilityCheck(makeData({ livesInMA: false }))
    expect(report.results).toHaveLength(1)
    expect(report.results[0].color).toBe("red")
    expect(report.results[0].status).toBe("unlikely")
  })
})

describe("runEligibilityCheck — Undocumented resident", () => {
  it("returns MassHealth Limited for non-pregnant undocumented person", () => {
    const report = runEligibilityCheck(
      makeData({ citizenshipStatus: "undocumented", isPregnant: false })
    )
    expect(report.results.some((r) => r.program === "MassHealth Limited")).toBe(true)
  })

  it("includes pregnancy Standard coverage for pregnant undocumented person", () => {
    const report = runEligibilityCheck(
      makeData({ citizenshipStatus: "undocumented", isPregnant: true })
    )
    const programs = report.results.map((r) => r.program)
    expect(programs).toContain("MassHealth Standard – Pregnancy")
  })
})

describe("runEligibilityCheck — Pregnant adult (≤200% FPL)", () => {
  it("qualifies for MassHealth Standard Pregnancy at 150% FPL", () => {
    const income = Math.round(15060 * 1.5) // 150% FPL for size 1
    const report = runEligibilityCheck(
      makeData({ isPregnant: true, annualIncome: income, householdSize: 1 })
    )
    expect(report.results.some((r) => r.program === "MassHealth Standard – Pregnancy")).toBe(true)
    expect(report.results[0].status).toBe("likely")
  })

  it("does NOT qualify for pregnancy Standard above 200% FPL", () => {
    const income = Math.round(15060 * 2.5) // 250% FPL
    const report = runEligibilityCheck(
      makeData({ isPregnant: true, annualIncome: income, householdSize: 1 })
    )
    expect(report.results.some((r) => r.program === "MassHealth Standard – Pregnancy")).toBe(false)
  })
})

describe("runEligibilityCheck — Children under 19", () => {
  it("child at 100% FPL qualifies for MassHealth Standard", () => {
    const report = runEligibilityCheck(
      makeData({ age: 10, annualIncome: 15060, householdSize: 1 })
    )
    expect(report.results[0].program).toBe("MassHealth Standard")
    expect(report.results[0].status).toBe("likely")
  })

  it("child at 200% FPL qualifies for CHIP (Family Assistance)", () => {
    const income = Math.round(15060 * 2.0) // 200% FPL
    const report = runEligibilityCheck(
      makeData({ age: 8, annualIncome: income, householdSize: 1 })
    )
    expect(report.results[0].program).toBe("MassHealth Family Assistance (CHIP)")
  })

  it("child at 350% FPL gets Health Connector suggestion", () => {
    const income = Math.round(15060 * 3.5) // 350% FPL
    const report = runEligibilityCheck(
      makeData({ age: 15, annualIncome: income, householdSize: 1 })
    )
    expect(report.results[0].program).toBe("Health Connector Plans")
  })
})

describe("runEligibilityCheck — Adults 19–64", () => {
  it("qualifies for CarePlus at 100% FPL (no Medicare)", () => {
    const report = runEligibilityCheck(
      makeData({ age: 30, annualIncome: 15060, householdSize: 1, hasMedicare: false })
    )
    expect(report.results[0].program).toBe("MassHealth CarePlus")
    expect(report.results[0].status).toBe("likely")
  })

  it("qualifies for CarePlus at exactly 138% FPL threshold", () => {
    // 138% of $15,060 = $20,783 → getIncomeAsFPLPercent = 138%
    const income = Math.round(15060 * 1.38)
    const report = runEligibilityCheck(
      makeData({ age: 40, annualIncome: income, householdSize: 1, hasMedicare: false })
    )
    expect(report.results.some((r) => r.program === "MassHealth CarePlus")).toBe(true)
  })

  it("qualifies for ConnectorCare at 200% FPL", () => {
    const income = Math.round(15060 * 2.0) // 200% FPL
    const report = runEligibilityCheck(
      makeData({ age: 35, annualIncome: income, householdSize: 1, hasMedicare: false })
    )
    expect(report.results.some((r) => r.program === "ConnectorCare")).toBe(true)
  })

  it("qualifies for ConnectorCare at 300% FPL (upper bound)", () => {
    const income = Math.round(15060 * 3.0) // exactly 300% FPL
    const report = runEligibilityCheck(
      makeData({ age: 45, annualIncome: income, householdSize: 1, hasMedicare: false })
    )
    expect(report.results.some((r) => r.program === "ConnectorCare")).toBe(true)
  })

  it("gets tax credit plans at 350% FPL (above ConnectorCare)", () => {
    const income = Math.round(15060 * 3.5)
    const report = runEligibilityCheck(
      makeData({ age: 50, annualIncome: income, householdSize: 1, hasMedicare: false })
    )
    expect(
      report.results.some((r) => r.program === "Health Connector with Federal Tax Credits")
    ).toBe(true)
  })

  it("gets unsubsidized plans above 500% FPL", () => {
    const income = Math.round(15060 * 6)
    const report = runEligibilityCheck(
      makeData({ age: 55, annualIncome: income, householdSize: 1, hasMedicare: false })
    )
    expect(
      report.results.some((r) => r.program === "Health Connector or Employer Plans")
    ).toBe(true)
  })

  it("disabled adult at 130% FPL qualifies for Standard (not CarePlus)", () => {
    const income = Math.round(15060 * 1.3)
    const report = runEligibilityCheck(
      makeData({ age: 40, annualIncome: income, householdSize: 1, hasDisability: true })
    )
    expect(report.results[0].program).toBe("MassHealth Standard")
  })

  it("Medicare recipient at 100% FPL gets Medicare Savings Program", () => {
    const report = runEligibilityCheck(
      makeData({ age: 60, annualIncome: 15060, householdSize: 1, hasMedicare: true })
    )
    expect(report.results.some((r) => r.program === "Medicare Savings Program")).toBe(true)
  })
})

describe("runEligibilityCheck — Seniors 65+", () => {
  it("dual eligible: 65+ with Medicare at 80% FPL gets Standard + Medicare Savings", () => {
    const income = Math.round(15060 * 0.8)
    const report = runEligibilityCheck(
      makeData({ age: 70, annualIncome: income, householdSize: 1, hasMedicare: true })
    )
    const programs = report.results.map((r) => r.program)
    expect(programs).toContain("MassHealth Standard (Dual Eligible)")
    expect(programs).toContain("Medicare Savings Program")
  })

  it("senior at 120% FPL gets Medicare Savings Program (not Standard)", () => {
    const income = Math.round(15060 * 1.2)
    const report = runEligibilityCheck(
      makeData({ age: 68, annualIncome: income, householdSize: 1, hasMedicare: true })
    )
    const programs = report.results.map((r) => r.program)
    expect(programs).toContain("Medicare Savings Program")
    expect(programs).not.toContain("MassHealth Standard (Dual Eligible)")
  })

  it("senior at 200% FPL (above MSP limit) gets Medigap suggestion", () => {
    const income = Math.round(15060 * 2.0)
    const report = runEligibilityCheck(
      makeData({ age: 72, annualIncome: income, householdSize: 1, hasMedicare: true })
    )
    expect(
      report.results.some((r) => r.program === "Medicare Supplement (Medigap) Plans")
    ).toBe(true)
  })
})

describe("runEligibilityCheck — FPL % in report", () => {
  it("reports fplPercent correctly", () => {
    const report = runEligibilityCheck(makeData({ annualIncome: 15060, householdSize: 1 }))
    expect(report.fplPercent).toBe(100)
  })

  it("report includes annualFPL and monthlyFPL", () => {
    const report = runEligibilityCheck(makeData({ householdSize: 2 }))
    expect(report.annualFPL).toBe(20440)
    expect(report.monthlyFPL).toBe(Math.round(20440 / 12))
  })

  it("report always includes a non-empty summary string", () => {
    const report = runEligibilityCheck(makeData())
    expect(typeof report.summary).toBe("string")
    expect(report.summary.length).toBeGreaterThan(10)
  })
})

describe("runEligibilityCheck — results ordering", () => {
  it("results are sorted by priority (ascending)", () => {
    const report = runEligibilityCheck(
      makeData({ age: 70, annualIncome: 5000, householdSize: 1, hasMedicare: true })
    )
    const priorities = report.results.map((r) => r.priority)
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1])
    }
  })
})
