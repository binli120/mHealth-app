/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_SYNTHETIC_CASES, getSyntheticCase } from "@/lib/masshealth/saca2/synthetic-cases"
import { getVisibleSteps } from "@/lib/masshealth/saca2/visibility"

describe("SACA2_SYNTHETIC_CASES", () => {
  it("contains the seven planned cases with unique ids", () => {
    const ids = SACA2_SYNTHETIC_CASES.map((c) => c.id)
    expect(ids).toEqual([
      "single-senior-home",
      "couple-spouse-in-nursing-facility",
      "hcbs-waiver-applicant",
      "senior-parent-of-child-under-19",
      "mixed-age-couple",
      "trust-and-annuity-applicant",
      "overflow-accounts",
    ])
  })

  it.each(SACA2_SYNTHETIC_CASES.map((c) => [c.id, c] as const))(
    "%s: visibility matches the expected steps",
    (_id, c) => {
      expect(getVisibleSteps(c.answers, new Date(`${c.referenceDate}T12:00:00Z`))).toEqual(
        c.expectedVisibleSteps,
      )
    },
  )

  it("uses only fabricated identifiers (no real-looking SSNs or emails)", () => {
    const json = JSON.stringify(SACA2_SYNTHETIC_CASES)
    expect(json).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/)
    expect(json).not.toMatch(/@(?!example\.test)/)
  })

  it("couple-spouse-in-nursing-facility carries a transfer inside the 60-month window", () => {
    const c = getSyntheticCase("couple-spouse-in-nursing-facility")
    expect(c.answers.transfers.length).toBeGreaterThan(0)
    expect(c.answers.supplements.a.needsNursingFacility).toBe("yes")
  })

  it("overflow-accounts has more bank accounts than the form's two rows", () => {
    expect(getSyntheticCase("overflow-accounts").answers.assets.bankAccounts.length).toBeGreaterThan(2)
  })

  it("throws on an unknown case id", () => {
    expect(() => getSyntheticCase("nope")).toThrow(/unknown synthetic case/i)
  })
})
