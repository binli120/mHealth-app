/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { evaluateAssets } from "@/lib/masshealth/saca2/eligibility/rules/assets"
import type { Saca2AssetInputs, Saca2EligibilityInputs } from "@/lib/masshealth/saca2/eligibility/types"
import { cents, facilityCouple, makeAssets, makeInputs, makePerson, makeSuppA } from "./helpers"

const run = (inputs: Saca2EligibilityInputs) => evaluateAssets(inputs, SACA2_FIGURES)
const single = (assets: Partial<Saca2AssetInputs>) => makeInputs({ assets: makeAssets(assets) })
const codes = (o: { findings: Array<{ code: string }> }) => o.findings.map((f) => f.code)
const bank = (...dollars: number[]) => dollars.map((d) => ({ open: true, balance: cents(d) }))

describe("evaluateAssets: single applicant ($2,000)", () => {
  it("counts open accounts only and passes at the limit", () => {
    const o = run(single({ bankAccounts: [...bank(1500), { open: false, balance: null }] }))
    expect(o.verdict).toBe("pass")
    expect(o.estimates).toMatchObject({ countableAssets: 1500, assetLimit: 2000 })
    expect(run(single({ bankAccounts: bank(2000) })).verdict).toBe("pass")
  })

  it("fails one cent over the limit", () => {
    const o = run(single({ bankAccounts: bank(2000.01) }))
    expect(o.verdict).toBe("fail")
    expect(codes(o)).toContain("SACA2_ASSETS_OVER_LIMIT")
  })

  it("reviews unanswered gates and missing or invalid amounts", () => {
    const gates = { ...makeAssets().gates, securities: null }
    expect(codes(run(single({ gates })))).toContain("SACA2_ASSET_ANSWERS_MISSING")
    expect(run(single({ bankAccounts: [{ open: true, balance: null }] })).verdict).toBe("review")
    expect(run(single({ bankAccounts: [{ open: true, balance: INVALID_AMOUNT }] })).verdict).toBe("review")
  })

  it("keeps a fail even when other data is missing (missing data can only add assets)", () => {
    expect(run(single({ bankAccounts: [...bank(5000), { open: true, balance: null }] })).verdict).toBe("fail")
  })

  it("excludes the vehicle with the highest equity and counts the rest", () => {
    const o = run(single({
      vehicles: [
        { fairMarketValue: cents(9000), amountOwed: cents(0) },
        { fairMarketValue: cents(4000), amountOwed: cents(1000) },
      ],
    }))
    expect(o.estimates.countableAssets).toBe(3000)
    expect(o.verdict).toBe("fail")
  })

  it("counts life-insurance cash value only when total face value is over $1,500 per person", () => {
    const at = run(single({ lifeInsurance: [{ faceValue: cents(1500), cashSurrenderValue: cents(800) }] }))
    expect(at.estimates.countableAssets).toBe(0)
    const over = run(single({ lifeInsurance: [{ faceValue: cents(1500.01), cashSurrenderValue: cents(800) }] }))
    expect(over.estimates.countableAssets).toBe(800)
    expect(run(single({ lifeInsurance: [{ faceValue: cents(5000), cashSurrenderValue: null }] })).verdict).toBe("review")
  })

  it("counts revocable trusts and reviews others; reviews annuities and deposits; excludes burial", () => {
    expect(run(single({ trusts: [{ revocable: true, principal: cents(5000) }] })).verdict).toBe("fail")
    const irrevocable = run(single({ trusts: [{ revocable: false, principal: cents(90000) }] }))
    expect(irrevocable.verdict).toBe("review")
    expect(irrevocable.estimates.countableAssets).toBe(0)
    expect(codes(run(single({ annuities: 1 })))).toContain("SACA2_ANNUITY_REVIEW")
    expect(codes(run(single({ deposits: 1 })))).toContain("SACA2_DEPOSIT_REVIEW")
    const burial = run(single({ burial: 2 }))
    expect(burial.verdict).toBe("pass")
    expect(codes(burial)).toContain("SACA2_BURIAL_EXCLUDED")
  })

  it("does not count the home of someone living in the community", () => {
    expect(run(single({ primaryResidence: [cents(300000)] })).verdict).toBe("pass")
  })
})

describe("evaluateAssets: facility applicant's home", () => {
  const facilitySingle = (suppA: Parameters<typeof makeSuppA>[0]) =>
    makeInputs({
      persons: [makePerson({ inInstitution: "yes" })],
      programs: { masshealthHsn: false, longTermCare: true, hcbsWaiver: false },
      suppA: makeSuppA({ needsNursingFacility: "yes", ...suppA }),
      assets: makeAssets({ primaryResidence: [cents(300000)] }),
    })

  it("counts the home when the applicant does not intend to return and no relative lives there", () => {
    const o = run(facilitySingle({ intendsToReturnHome: "no" }))
    expect(o.verdict).toBe("fail")
    expect(codes(o)).toContain("SACA2_HOME_COUNTED")
  })

  it("excludes the home with intent to return or a dependent relative living there", () => {
    expect(run(facilitySingle({ intendsToReturnHome: "yes" })).verdict).toBe("pass")
    const occupants = { spouse: false, childUnder21: false, disabledChild: false, dependentRelative: true }
    expect(run(facilitySingle({ intendsToReturnHome: "no", occupants })).verdict).toBe("pass")
  })
})

describe("evaluateAssets: couples", () => {
  const communityCouple = (spouseApplying: boolean, dollars: number) =>
    makeInputs({
      persons: [makePerson(), makePerson({ index: 1, applying: spouseApplying, livesWithPerson1: "yes" })],
      hasSpouse: true,
      householdSize: 2,
      assets: makeAssets({ bankAccounts: bank(dollars) }),
    })

  it("uses $3,000 for a couple living together and notes when only one spouse applies", () => {
    expect(run(communityCouple(true, 3000)).verdict).toBe("pass")
    expect(run(communityCouple(true, 3000.01)).verdict).toBe("fail")
    const one = run(communityCouple(false, 2900))
    expect(one.estimates.assetLimit).toBe(3000)
    expect(codes(one)).toContain("SACA2_ONE_SPOUSE_APPLYING")
  })

  it("uses the community-spouse band when the applicant is in a facility and the spouse is at home", () => {
    const at = (dollars: number) => run(facilityCouple({ assets: makeAssets({ bankAccounts: bank(dollars) }) }))
    expect(at(34532).verdict).toBe("pass")
    const middle = at(34532.01)
    expect(middle.verdict).toBe("review")
    expect(middle.estimates.communitySpouseResource).toEqual({ min: 32532, max: 162660 })
    expect(middle.estimates.assetLimit).toBeUndefined()
    expect(at(164660).verdict).toBe("review")
    expect(at(164660.01).verdict).toBe("fail")
  })

  it("reviews when both spouses are in a facility or the spouse lives elsewhere", () => {
    const both = facilityCouple()
    both.persons[1].inInstitution = "yes"
    expect(codes(run(both))).toContain("SACA2_BOTH_SPOUSES_IN_FACILITY")
    const apart = makeInputs({ persons: [makePerson(), makePerson({ index: 1, livesWithPerson1: "no" })], hasSpouse: true })
    expect(codes(run(apart))).toContain("SACA2_SPOUSE_LIVES_APART")
  })

  it("doubles the life-insurance threshold with a spouse", () => {
    const o = run(communityCouple(true, 0))
    expect(o.verdict).toBe("pass")
    expect(o.estimates.countableAssets).toBe(0)
    const withPolicy = communityCouple(true, 0)
    withPolicy.assets.lifeInsurance = [{ faceValue: cents(3000), cashSurrenderValue: cents(2500) }]
    expect(run(withPolicy).estimates.countableAssets).toBe(0)
    withPolicy.assets.lifeInsurance = [{ faceValue: cents(3000.01), cashSurrenderValue: cents(2500) }]
    expect(run(withPolicy).estimates.countableAssets).toBe(2500)
  })
})

describe("evaluateAssets: missing answers never add assets", () => {
  it("does not count a vehicle whose loan balance is unanswered, and reviews", () => {
    const o = run(single({ vehicles: [
      { fairMarketValue: cents(9000), amountOwed: null },
      { fairMarketValue: cents(4000), amountOwed: cents(0) },
    ] }))
    expect(o.verdict).toBe("review")
    expect(o.estimates.countableAssets).toBe(0)
    expect(codes(o)).toContain("SACA2_ASSET_VALUE_MISSING")
  })

  it("does not count the home and reviews when intent to return is unanswered", () => {
    const o = run(makeInputs({
      persons: [makePerson({ inInstitution: "yes" })],
      programs: { masshealthHsn: false, longTermCare: true, hcbsWaiver: false },
      suppA: makeSuppA({ needsNursingFacility: "yes", intendsToReturnHome: null }),
      assets: makeAssets({ primaryResidence: [cents(300000)] }),
    }))
    expect(o.verdict).toBe("review")
    expect(o.estimates.countableAssets).toBe(0)
    expect(codes(o)).toContain("SACA2_HOME_ANSWER_MISSING")
  })

  it("reviews when the spouse's facility answer is unanswered", () => {
    const i = facilityCouple()
    i.persons[1].inInstitution = null
    const o = run(i)
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_SPOUSE_FACILITY_UNKNOWN")
  })
})
