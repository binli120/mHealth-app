/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { buildSaca2DocumentChecklist } from "@/lib/masshealth/saca2/document-checklist"
import { readSaca2EligibilityInputs } from "@/lib/masshealth/saca2/eligibility/inputs"
import type { Saca2DocumentId, Saca2EligibilityInputs } from "@/lib/masshealth/saca2/eligibility/types"
import { completeFacilityCouple, completeSingleSenior } from "./complete-answers"
import { ON, cents, facilityCouple, incomeLine, makeAssets, makeInputs, makePerson, makeSuppA } from "../eligibility/__tests__/helpers"

const ids = (inputs: Saca2EligibilityInputs) => buildSaca2DocumentChecklist(inputs).map((item) => item.id)

describe("buildSaca2DocumentChecklist", () => {
  it("asks for nothing when nothing triggers a document", () => {
    expect(ids(makeInputs())).toEqual([])
  })

  it.each<[string, Saca2EligibilityInputs, Saca2DocumentId]>([
    ["pay stubs", makeInputs({ persons: [makePerson({ hasIncome: "yes", income: [incomeLine("wages", 100)] })] }), "payStubs"],
    ["benefit statements", makeInputs({ persons: [makePerson({ hasIncome: "yes", income: [incomeLine("pension", 100)] })] }), "benefitStatements"],
    ["rental", makeInputs({ persons: [makePerson({ hasIncome: "yes", rental: [{ amount: cents(100), isLoss: false }] })] }), "rentalIncome"],
    ["accounts", makeInputs({ assets: makeAssets({ bankAccounts: [{ open: true, balance: 0 }] }) }), "accountStatements"],
    ["real estate", makeInputs({ assets: makeAssets({ otherRealEstate: [cents(1)] }) }), "realEstate"],
    ["life insurance", makeInputs({ assets: makeAssets({ lifeInsurance: [{ faceValue: cents(1000), cashSurrenderValue: null }] }) }), "lifeInsurance"],
    ["securities", makeInputs({ assets: makeAssets({ securities: [{ kind: "stocks", value: 0 }] }) }), "securities"],
    ["annuities", makeInputs({ assets: makeAssets({ annuities: 1 }) }), "annuities"],
    ["trusts", makeInputs({ assets: makeAssets({ trusts: [{ revocable: false, principal: 0 }] }) }), "trusts"],
    ["vehicles", makeInputs({ assets: makeAssets({ vehicles: [{ fairMarketValue: 0, amountOwed: null }] }) }), "vehicles"],
    ["burial", makeInputs({ assets: makeAssets({ burial: 1 }) }), "burial"],
    ["facility deposit", makeInputs({ assets: makeAssets({ deposits: 1 }) }), "facilityDeposit"],
    ["transfers", makeInputs({ suppA: makeSuppA({ transfers: [{ date: "2024-01-01", amount: 0 }] }) }), "transfers"],
    ["spouse expenses", facilityCouple(), "spouseExpenses"],
    ["family income", makeInputs({ hasSpouse: true, persons: [makePerson(), makePerson({ index: 1 })], suppA: makeSuppA({ familyAtHome: "yes" }) }), "familyIncome"],
    ["LTC insurance", makeInputs({ suppA: makeSuppA({ ltcPolicies: 1 }) }), "ltcInsurance"],
    ["tax returns", makeInputs({ suppA: makeSuppA({ taxReturnsFiled: "bothYears", hasCopiesOfTaxReturns: "yes" }) }), "taxReturns"],
    ["IRS 4506", makeInputs({ paperwork: { signedBy: "applicant", ardSection: null, irs4506Needed: true } }), "irs4506"],
    ["guardianship expenses", makeInputs({ suppA: makeSuppA({ paysGuardianshipExpenses: "yes" }) }), "guardianshipExpenses"],
    ["immigration", makeInputs({ persons: [makePerson({ citizen: "no", hasEligibleImmigrationStatus: "yes" })] }), "immigration"],
    ["citizenship", makeInputs({ persons: [makePerson({ hasMedicareOrSsiOrSsdi: "no" })] }), "citizenshipIdentity"],
    ["Medicare card", makeInputs({ health: { hasMedicare: true, medigapOrPartD: false, wantsPartBHelp: null, employerCoverageSupplement: false } }), "medicareCard"],
    ["premium bills", makeInputs({ health: { hasMedicare: true, medigapOrPartD: true, wantsPartBHelp: null, employerCoverageSupplement: false } }), "premiumBills"],
    ["employer coverage", makeInputs({ health: { hasMedicare: false, medigapOrPartD: false, wantsPartBHelp: null, employerCoverageSupplement: true } }), "employerCoverage"],
    ["ARD-1122", makeInputs({ paperwork: { signedBy: "authorizedRepresentative", ardSection: "appointedByLaw", irs4506Needed: false } }), "ard1122"],
    ["legal authority", makeInputs({ paperwork: { signedBy: "authorizedRepresentative", ardSection: "appointedByLaw", irs4506Needed: false } }), "legalAuthority"],
  ])("%s", (_name, inputs, id) => {
    expect(ids(inputs)).toContain(id)
  })

  it("asks for 60 months of statements from facility applicants and current ones otherwise", () => {
    const facility = facilityCouple({ assets: makeAssets({ bankAccounts: [{ open: true, balance: 0 }] }) })
    expect(buildSaca2DocumentChecklist(facility).find((i) => i.id === "accountStatements")?.label).toMatch(/past 60 months/)
    const home = makeInputs({ assets: makeAssets({ bankAccounts: [{ open: true, balance: 0 }] }) })
    expect(buildSaca2DocumentChecklist(home).find((i) => i.id === "accountStatements")?.label).toMatch(/^Current statements/)
  })

  it("asks for the cash-surrender letter only above $1,500 face value per person", () => {
    const policy = (dollars: number, hasSpouse = false) =>
      ids(makeInputs({ hasSpouse, assets: makeAssets({ lifeInsurance: [{ faceValue: cents(dollars), cashSurrenderValue: null }] }) }))
    expect(policy(1500)).not.toContain("cashSurrenderLetter")
    expect(policy(1500.01)).toContain("cashSurrenderLetter")
    expect(policy(3000, true)).not.toContain("cashSurrenderLetter")
    expect(policy(3000.01, true)).toContain("cashSurrenderLetter")
  })

  it("does not ask for citizenship proof from someone who gets Medicare, SSI, or SSDI, or from a non-applicant", () => {
    expect(ids(makeInputs())).not.toContain("citizenshipIdentity")
    expect(ids(makeInputs({ persons: [makePerson({ applying: false, hasMedicareOrSsiOrSsdi: "no" })] }))).not.toContain("citizenshipIdentity")
  })

  it("lists nothing from hidden answers (vehicle rows under a No gate)", () => {
    const a = completeSingleSenior()
    a.assets.vehicles = [{ owner: "you", vehicleType: "Car", yearMakeModel: "", fairMarketValue: 9000, amountOwed: null }]
    expect(ids(readSaca2EligibilityInputs(a, ON))).not.toContain("vehicles")
  })

  it("builds the facility couple's list in a stable order with no duplicates", () => {
    const list = ids(readSaca2EligibilityInputs(completeFacilityCouple(), ON))
    expect(new Set(list).size).toBe(list.length)
    expect(list.indexOf("accountStatements")).toBeLessThan(list.indexOf("realEstate"))
    expect(list).toEqual(expect.arrayContaining(["transfers", "spouseExpenses", "medicareCard", "premiumBills", "ard1122", "taxReturns"]))
  })

  it("never lists spouse-side items when there is no spouse, even if stale values are present", () => {
    const stale = makeInputs({
      hasSpouse: false,
      persons: [makePerson(), makePerson({ index: 1, applying: false, hasIncome: "yes", income: [incomeLine("wages", 100)] })],
      suppA: makeSuppA({ familyAtHome: "yes", spouseExpenses: facilityCouple().suppA?.spouseExpenses ?? null }),
    })
    const list = ids(stale)
    expect(list).not.toContain("familyIncome")
    expect(list).not.toContain("spouseExpenses")
    expect(list).not.toContain("payStubs")
  })

  it("asks for the cash-surrender letter when a face value is missing or invalid", () => {
    const withValue = (faceValue: number | null | "invalid") =>
      ids(makeInputs({ assets: makeAssets({ lifeInsurance: [{ faceValue, cashSurrenderValue: null }] }) }))
    expect(withValue(null)).toContain("cashSurrenderLetter")
    expect(withValue("invalid")).toContain("cashSurrenderLetter")
  })
})

describe("buildSaca2DocumentChecklist: cash-surrender letter reason", () => {
  const letter = (faceValue: number | null | "invalid") =>
    buildSaca2DocumentChecklist(makeInputs({ assets: makeAssets({ lifeInsurance: [{ faceValue, cashSurrenderValue: null }] }) })).find((i) => i.id === "cashSurrenderLetter")

  it("explains a high face value with the $1,500 limit", () => {
    expect(letter(cents(2000))?.reason).toBe("Total face value is more than $1,500 per person.")
  })

  it("explains a missing or invalid face value separately", () => {
    expect(letter(null)?.reason).toBe("A life insurance face value is missing or invalid.")
    expect(letter("invalid")?.reason).toBe("A life insurance face value is missing or invalid.")
  })
})

