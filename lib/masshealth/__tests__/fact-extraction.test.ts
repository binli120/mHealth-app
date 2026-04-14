/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect } from "vitest"

import {
  isSufficientForEvaluation,
  applyFactDefaults,
  summarizeExtractedFacts,
} from "@/lib/masshealth/fact-extraction"
import type { ScreenerData } from "@/lib/eligibility-engine"

// ── isSufficientForEvaluation ─────────────────────────────────────────────────

describe("isSufficientForEvaluation", () => {
  it("returns false when all facts are missing", () => {
    expect(isSufficientForEvaluation({})).toBe(false)
  })

  it("returns false when only age is present", () => {
    expect(isSufficientForEvaluation({ age: 30 })).toBe(false)
  })

  it("returns false when age and householdSize are present but income is missing", () => {
    expect(isSufficientForEvaluation({ age: 30, householdSize: 2 })).toBe(false)
  })

  it("returns false when income and householdSize are present but age is missing", () => {
    expect(isSufficientForEvaluation({ householdSize: 2, annualIncome: 30000 })).toBe(false)
  })

  it("returns true when age, householdSize, and annualIncome are all present", () => {
    expect(
      isSufficientForEvaluation({ age: 30, householdSize: 2, annualIncome: 30000 }),
    ).toBe(true)
  })

  it("returns true even when annualIncome is 0", () => {
    expect(
      isSufficientForEvaluation({ age: 25, householdSize: 1, annualIncome: 0 }),
    ).toBe(true)
  })

  it("returns true with all optional fields present", () => {
    const facts: Partial<ScreenerData> = {
      age: 35,
      householdSize: 4,
      annualIncome: 60000,
      livesInMA: true,
      isPregnant: false,
      hasDisability: false,
      hasMedicare: false,
      hasEmployerInsurance: true,
      citizenshipStatus: "citizen",
    }
    expect(isSufficientForEvaluation(facts)).toBe(true)
  })
})

// ── applyFactDefaults ─────────────────────────────────────────────────────────

describe("applyFactDefaults", () => {
  it("fills all defaults for empty facts", () => {
    const result = applyFactDefaults({})
    expect(result.livesInMA).toBe(true)
    expect(result.age).toBe(30)
    expect(result.householdSize).toBe(1)
    expect(result.annualIncome).toBe(0)
    expect(result.isPregnant).toBe(false)
    expect(result.hasDisability).toBe(false)
    expect(result.hasMedicare).toBe(false)
    expect(result.hasEmployerInsurance).toBe(false)
    expect(result.citizenshipStatus).toBe("citizen")
  })

  it("preserves provided facts without overriding with defaults", () => {
    const facts: Partial<ScreenerData> = {
      age: 65,
      householdSize: 3,
      annualIncome: 25000,
      livesInMA: false,
      isPregnant: true,
      hasMedicare: true,
      citizenshipStatus: "qualified_immigrant",
    }
    const result = applyFactDefaults(facts)
    expect(result.age).toBe(65)
    expect(result.householdSize).toBe(3)
    expect(result.annualIncome).toBe(25000)
    expect(result.livesInMA).toBe(false)
    expect(result.isPregnant).toBe(true)
    expect(result.hasMedicare).toBe(true)
    expect(result.citizenshipStatus).toBe("qualified_immigrant")
  })

  it("returns a complete ScreenerData object (no undefined fields)", () => {
    const result = applyFactDefaults({ age: 40 })
    const requiredKeys: (keyof ScreenerData)[] = [
      "livesInMA", "age", "householdSize", "annualIncome",
      "isPregnant", "hasDisability", "hasMedicare", "hasEmployerInsurance", "citizenshipStatus",
    ]
    requiredKeys.forEach((key) => {
      expect(result[key]).not.toBeUndefined()
    })
  })

  it("keeps livesInMA as false when explicitly set to false", () => {
    const result = applyFactDefaults({ livesInMA: false })
    expect(result.livesInMA).toBe(false)
  })
})

// ── summarizeExtractedFacts ───────────────────────────────────────────────────

describe("summarizeExtractedFacts", () => {
  it("returns a no-facts message for empty facts", () => {
    const result = summarizeExtractedFacts({})
    expect(result).toContain("No eligibility facts")
  })

  it("includes age when present", () => {
    const result = summarizeExtractedFacts({ age: 42 })
    expect(result).toContain("42")
    expect(result).toContain("Age")
  })

  it("includes household size when present", () => {
    const result = summarizeExtractedFacts({ householdSize: 4 })
    expect(result).toContain("4")
    expect(result).toContain("Household size")
  })

  it("formats annual income with $ and thousands separator", () => {
    const result = summarizeExtractedFacts({ annualIncome: 45000 })
    expect(result).toContain("$45,000")
  })

  it("lists still-needed fields when core facts are missing", () => {
    const result = summarizeExtractedFacts({ age: 30 })
    expect(result).toContain("Still needed")
    expect(result).toContain("household size")
    expect(result).toContain("annual income")
  })

  it("does not show 'Still needed' when all core facts are present", () => {
    const result = summarizeExtractedFacts({
      age: 30,
      householdSize: 2,
      annualIncome: 30000,
      livesInMA: true,
    })
    expect(result).not.toContain("Still needed")
  })

  it("shows citizenship status when present", () => {
    const result = summarizeExtractedFacts({ citizenshipStatus: "undocumented" })
    expect(result).toContain("undocumented")
  })

  it("shows pregnancy status when present", () => {
    const result = summarizeExtractedFacts({ isPregnant: true })
    expect(result).toContain("Pregnant")
    expect(result).toContain("Yes")
  })

  it("shows Medicare status when present", () => {
    const result = summarizeExtractedFacts({ hasMedicare: true })
    expect(result).toContain("Medicare")
  })
})
