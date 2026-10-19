/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { evaluateSpousalAllowance } from "@/lib/masshealth/saca2/eligibility/rules/spousal-allowance"
import type { Saca2EligibilityInputs, Saca2SpouseExpenses } from "@/lib/masshealth/saca2/eligibility/types"
import { ON, cents, facilityCouple } from "./helpers"

const at = (iso: string) => new Date(`${iso}T12:00:00Z`)
const run = (inputs: Saca2EligibilityInputs, on = ON) => evaluateSpousalAllowance(inputs, SACA2_FIGURES, on)
function withExpenses(patch: Partial<Saca2SpouseExpenses>): Saca2EligibilityInputs {
  const inputs = facilityCouple()
  const suppA = inputs.suppA
  if (!suppA?.spouseExpenses) throw new Error("facilityCouple fixture must have spouse expenses")
  inputs.suppA = { ...suppA, spouseExpenses: { ...suppA.spouseExpenses, ...patch } }
  return inputs
}

describe("evaluateSpousalAllowance", () => {
  it("estimates the allowance on 2026-10-13 (heat standard $945, shelter $811.50, minimum $2,705)", () => {
    const o = run(facilityCouple())
    expect(o.verdict).toBe("pass")
    expect(o.estimates.spousalAllowance).toEqual({ mmmna: 3738.5, excessShelter: 1033.5, allowance: 2738.5 })
  })

  it("switches the SNAP utility standard on 2026-10-01", () => {
    expect(run(facilityCouple(), at("2026-09-30")).estimates.spousalAllowance).toEqual({ mmmna: 3707.5, excessShelter: 1002.5, allowance: 2707.5 })
    expect(run(facilityCouple(), at("2026-10-01")).estimates.spousalAllowance?.allowance).toBe(2738.5)
  })

  it("switches the minimum MMMNA and shelter standard on 2026-07-01", () => {
    expect(run(facilityCouple(), at("2026-06-30")).estimates.spousalAllowance).toEqual({ mmmna: 3664.62, excessShelter: 1020.87, allowance: 2664.62 })
    expect(run(facilityCouple(), at("2026-07-01")).estimates.spousalAllowance).toEqual({ mmmna: 3707.5, excessShelter: 1002.5, allowance: 2707.5 })
  })

  it("caps the MMMNA at $4,066.50", () => {
    expect(run(withExpenses({ rent: cents(3000) })).estimates.spousalAllowance?.mmmna).toBe(4066.5)
  })

  it("uses the no-heat standard when the spouse pays utilities but not heat, and none when neither", () => {
    expect(run(withExpenses({ paysHeat: "no" })).estimates.spousalAllowance?.excessShelter).toBe(663.5)
    expect(run(withExpenses({ paysHeat: "no", paysUtilities: "no" })).estimates.spousalAllowance?.excessShelter).toBe(88.5)
  })

  it("never goes below 0 when the spouse's income is high", () => {
    const inputs = facilityCouple()
    inputs.persons[1].income = [{ kind: "pension", amount: cents(9000), frequency: "monthly", isLoss: false }]
    expect(run(inputs).estimates.spousalAllowance?.allowance).toBe(0)
  })

  it("reviews missing heat answers, invalid amounts, unknown spouse income, and family at home", () => {
    expect(run(withExpenses({ paysHeat: null })).findings[0].code).toBe("SACA2_UTILITY_ANSWERS_MISSING")
    expect(run(withExpenses({ mortgage: INVALID_AMOUNT })).findings[0].code).toBe("SACA2_SHELTER_VALUE_INVALID")
    const noIncome = facilityCouple()
    noIncome.persons[1].hasIncome = null
    expect(run(noIncome).findings[0].code).toBe("SACA2_SPOUSE_INCOME_MISSING")
    const family = withExpenses({})
    if (family.suppA) family.suppA = { ...family.suppA, familyAtHome: "yes" }
    const o = run(family)
    expect(o.verdict).toBe("review")
    expect(o.estimates.spousalAllowance?.allowance).toBe(2738.5)
  })

  it("reviews an unanswered family-at-home question and spouse one-time income instead of passing", () => {
    const unanswered = withExpenses({})
    if (unanswered.suppA) unanswered.suppA = { ...unanswered.suppA, familyAtHome: null }
    const a = run(unanswered)
    expect(a.verdict).toBe("review")
    expect(a.findings.map((f) => f.code)).toContain("SACA2_FAMILY_ANSWER_MISSING")

    const oneTime = facilityCouple()
    oneTime.persons[1].oneTimeIncomeThisYear = 1
    const b = run(oneTime)
    expect(b.verdict).toBe("review")
    expect(b.findings.map((f) => f.code)).toContain("SACA2_SPOUSE_ONE_TIME_INCOME")
  })

  it("does not apply without a spouse (householdHasSpouse), when the spouse is in a facility, or for community applicants", () => {
    expect(run({ ...facilityCouple(), hasSpouse: false }).verdict).toBe("notApplicable")
    const both = facilityCouple()
    both.persons[1].inInstitution = "yes"
    expect(run(both).verdict).toBe("notApplicable")
    expect(run({ ...facilityCouple(), programs: { masshealthHsn: true, longTermCare: false, hcbsWaiver: false }, suppA: null }).verdict).toBe("notApplicable")
  })
})
