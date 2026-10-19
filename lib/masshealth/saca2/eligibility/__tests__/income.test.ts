/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { evaluateIncome } from "@/lib/masshealth/saca2/eligibility/rules/income"
import type { Saca2EligibilityInputs, Saca2IncomeLine } from "@/lib/masshealth/saca2/eligibility/types"
import { ON, cents, facilityCouple, incomeLine, makeInputs, makePerson } from "./helpers"

const run = (inputs: Saca2EligibilityInputs, allowance: number | null = null) => evaluateIncome(inputs, SACA2_FIGURES, ON, allowance)
const single = (...income: Saca2IncomeLine[]) => makeInputs({ persons: [makePerson({ hasIncome: "yes", income })] })
const codes = (o: { findings: Array<{ code: string }> }) => o.findings.map((f) => f.code)

describe("evaluateIncome: community (100% FPL)", () => {
  it("passes at exactly 100% FPL for one person and reviews one cent over", () => {
    expect(run(single(incomeLine("socialSecurity", 1330)))).toMatchObject({
      verdict: "pass",
      estimates: { householdSize: 1, monthlyIncome: 1330, fplPercent: 100, incomeLimit: { kind: "fpl100", monthly: 1330 } },
    })
    const over = run(single(incomeLine("socialSecurity", 1330.01)))
    expect(over.verdict).toBe("review")
    expect(codes(over)).toContain("SACA2_INCOME_OVER_FPL100")
  })

  it("normalizes frequencies before comparing", () => {
    expect(run(single(incomeLine("wages", 250, "weekly"))).estimates.monthlyIncome).toBe(1083.33)
    expect(run(single(incomeLine("pension", 3000, "quarterly"))).estimates.monthlyIncome).toBe(1000)
  })

  it("adds a spouse living with Person 1 and uses the household-of-two row", () => {
    const inputs = makeInputs({
      persons: [
        makePerson({ hasIncome: "yes", income: [incomeLine("socialSecurity", 1600)] }),
        makePerson({ index: 1, age: 58, livesWithPerson1: "yes", hasIncome: "yes", income: [incomeLine("wages", 400, "every2weeks")] }),
      ],
      hasSpouse: true,
      householdSize: 2,
    })
    expect(run(inputs).estimates).toMatchObject({ householdSize: 2, monthlyIncome: 2466.67, fplPercent: 137, incomeLimit: { monthly: 1804 } })
  })

  it("uses the extrapolated row beyond 8 and reviews a corrupt household size without throwing", () => {
    const nine = { ...single(incomeLine("socialSecurity", 1000)), householdSize: 9 }
    expect(run(nine).estimates).toMatchObject({ incomeLimit: { kind: "fpl100", monthly: 5118 }, fplPercent: 20 })
    const zero = { ...single(incomeLine("socialSecurity", 1000)), householdSize: 0 }
    expect(codes(run(zero))).toContain("SACA2_HOUSEHOLD_SIZE_UNKNOWN")
  })

  it("reviews missing income details, one-time income, and a non-spouse Person 2 who applies", () => {
    expect(codes(run(makeInputs({ persons: [makePerson({ hasIncome: null })] })))).toContain("SACA2_INCOME_DETAILS_MISSING")
    expect(codes(run(single(incomeLine("lottery", 5000, "oneTime"))))).toContain("SACA2_ONE_TIME_INCOME")
    const other = makeInputs({ persons: [makePerson(), makePerson({ index: 1, livesWithPerson1: "yes" })], hasSpouse: false })
    expect(codes(run(other))).toContain("SACA2_OTHER_PERSON_APPLYING")
  })

  it("does not apply when no one is applying", () => {
    expect(run(makeInputs({ persons: [makePerson({ applying: false })] })).verdict).toBe("notApplicable")
  })
})

describe("evaluateIncome: long-term care ($2,982 special income limit)", () => {
  it("passes at the limit, reviews over it, and estimates the patient-paid amount", () => {
    const o = run(facilityCouple(), cents(2738.5))
    expect(o).toMatchObject({
      verdict: "pass",
      estimates: { monthlyIncome: 2700, incomeLimit: { kind: "specialIncomeLimit", monthly: 2982 }, patientPaidAmount: 0 },
    })
    const over = facilityCouple()
    over.persons[0].income = [incomeLine("pension", 2982.01)]
    expect(codes(run(over))).toContain("SACA2_INCOME_OVER_SPECIAL_LIMIT")
  })

  it("subtracts the personal needs allowance and Part B when there is no spousal allowance", () => {
    const inputs = facilityCouple({ hasSpouse: false })
    inputs.health = { ...inputs.health, hasMedicare: true }
    expect(run(inputs, null).estimates).toMatchObject({ patientPaidAmount: 2424.3, partBPremium: 202.9 })
  })

  it("uses the special income limit for HCBS but gives no patient-paid amount", () => {
    const inputs = makeInputs({
      persons: [makePerson({ hasIncome: "yes", income: [incomeLine("socialSecurity", 1500)] })],
      programs: { masshealthHsn: false, longTermCare: false, hcbsWaiver: true },
    })
    const o = run(inputs)
    expect(o.verdict).toBe("pass")
    expect(o.estimates.incomeLimit?.kind).toBe("specialIncomeLimit")
    expect(o.estimates.patientPaidAmount).toBeUndefined()
  })

  it("reviews when both spouses apply with long-term care", () => {
    const inputs = facilityCouple()
    inputs.persons[1].applying = true
    expect(codes(run(inputs))).toContain("SACA2_BOTH_SPOUSES_LONG_TERM_CARE")
  })

  it("reviews instead of assuming a $0 spousal allowance when a spouse exists but the allowance is unknown", () => {
    const o = run(facilityCouple(), null)
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_PATIENT_PAID_AMOUNT_UNKNOWN")
    expect(o.estimates.patientPaidAmount).toBeUndefined()
  })
})

describe("evaluateIncome: Person 1 not applying", () => {
  it("reviews rather than silently using Person 1's income", () => {
    const inputs = makeInputs({ persons: [makePerson({ applying: false }), makePerson({ index: 1, livesWithPerson1: "yes" })], hasSpouse: true, householdSize: 2 })
    expect(codes(run(inputs))).toContain("SACA2_PERSON1_NOT_APPLYING")
  })
})
