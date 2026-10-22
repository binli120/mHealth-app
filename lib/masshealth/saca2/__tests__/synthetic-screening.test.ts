/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { evaluateSaca2Eligibility } from "@/lib/masshealth/saca2/eligibility-engine"
import { SACA2_RULE_POLICY, type Saca2RulePolicy } from "@/lib/masshealth/saca2/eligibility/policy"
import { SACA2_RULE_IDS } from "@/lib/masshealth/saca2/eligibility/types"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { SACA2_SYNTHETIC_CASES, getSyntheticCase } from "@/lib/masshealth/saca2/synthetic-cases"

const ALL_CONFIRMED = Object.fromEntries(
  SACA2_RULE_IDS.map((id) => [id, { ...SACA2_RULE_POLICY[id], confirmed: true }]),
) as Saca2RulePolicy
const onOf = (c: { referenceDate: string }) => new Date(`${c.referenceDate}T12:00:00Z`)
const cases = SACA2_SYNTHETIC_CASES.map((c) => [c.id, c] as const)

describe("synthetic cases: screening outcomes", () => {
  it.each(cases)("%s: status as shipped", (_id, c) => {
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).status).toBe(c.expectedScreening.asShipped)
  })

  it.each(cases)("%s: status if every rule were confirmed", (_id, c) => {
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c), { policy: ALL_CONFIRMED }).status).toBe(c.expectedScreening.ifAllConfirmed)
  })

  it.each(cases)("%s: each rule's own verdict", (_id, c) => {
    const rules = evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).rules
    expect(Object.fromEntries(rules.map((r) => [r.id, r.verdict]))).toEqual(c.expectedScreening.verdicts)
  })

  it("couple in a nursing facility: transfers, allowance, patient-paid amount, community-spouse band", () => {
    const c = getSyntheticCase("couple-spouse-in-nursing-facility")
    const e = evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).estimates
    expect(e.transfersInWindow).toEqual({ count: 1, total: 30000, penaltyDays: 66, lookBackStart: "2021-10-13" })
    expect(e.spousalAllowance).toEqual({ mmmna: 4066.5, excessShelter: 2153.5, allowance: 2766.5 })
    expect(e.patientPaidAmount).toBe(0)
    expect(e.countableAssets).toBe(72000)
    expect(e.communitySpouseResource).toEqual({ min: 32532, max: 162660 })
  })

  it("mixed-age couple: two-person household with biweekly wages", () => {
    const c = getSyntheticCase("mixed-age-couple")
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).estimates).toMatchObject({ householdSize: 2, monthlyIncome: 2466.67, fplPercent: 137 })
  })

  it("overflow accounts: $3,200 against the $2,000 limit", () => {
    const c = getSyntheticCase("overflow-accounts")
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).estimates).toMatchObject({ countableAssets: 3200, assetLimit: 2000 })
  })

  it("senior parent of a child under 19: links to the ACA-3 chooser", () => {
    const c = getSyntheticCase("senior-parent-of-child-under-19")
    expect(evaluateSaca2Eligibility(c.answers, SACA2_FIGURES, onOf(c)).redirect_href).toBe("/application/type?recommended=aca3")
  })
})
