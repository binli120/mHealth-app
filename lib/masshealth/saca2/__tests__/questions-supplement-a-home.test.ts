/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type HomeProperty, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

function errs(a: Saca2Answers, ...prefixes: string[]): Record<string, string> {
  const all = validateStep("suppA", a, ON)
  return Object.fromEntries(Object.entries(all).filter(([key]) => prefixes.some((p) => key === p || key.startsWith(`${p}.`))))
}

const HOME = ["supplements.a.home", "supplements.a.intendsToReturnHome"]
const LTCI = "supplements.a.longTermCareInsurance"
const TAX = ["supplements.a.taxReturnsFiled", "supplements.a.hasCopiesOfTaxReturns"]

const property: HomeProperty = {
  ownerNames: "Walter Testcase",
  propertyAddress: "1 Example St, Testville MA",
  ownershipType: "individual",
  fairMarketValue: 450000,
}

describe("Supplement A: home and relatives", () => {
  it("requires whether you own a home, and the return-home question", () => {
    expect(Object.keys(errs(answers(), ...HOME)).sort()).toEqual([
      "supplements.a.home.ownsHome",
      "supplements.a.home.ownsOtherRealEstate",
      "supplements.a.intendsToReturnHome",
    ])
  })

  it("hides the return-home question for an HCBS Waiver applicant", () => {
    const a = answers((x) => (x.supplements.a.applyingHcbsWaiver = "yes"))
    expect(errs(a, "supplements.a.intendsToReturnHome")).toEqual({})
  })

  it("asks about the property and the six relatives only when you own a home", () => {
    const no = answers((x) => (x.supplements.a.home.ownsHome = "no"))
    expect(Object.keys(errs(no, ...HOME)).sort()).toEqual([
      "supplements.a.home.ownsOtherRealEstate",
      "supplements.a.intendsToReturnHome",
    ])
    const yes = answers((x) => (x.supplements.a.home.ownsHome = "yes"))
    expect(Object.keys(errs(yes, ...HOME)).sort()).toEqual([
      "supplements.a.home.caregiverChild.has",
      "supplements.a.home.childUnder21.has",
      "supplements.a.home.dependentRelative.has",
      "supplements.a.home.disabledChild.has",
      "supplements.a.home.ownsOtherRealEstate",
      "supplements.a.home.properties",
      "supplements.a.home.sibling.has",
      "supplements.a.home.spouse.has",
      "supplements.a.intendsToReturnHome",
    ])
  })

  it("validates property rows", () => {
    const a = answers((x) => {
      x.supplements.a.home.ownsHome = "yes"
      x.supplements.a.home.properties = [{ ownerNames: "", propertyAddress: "", ownershipType: null, fairMarketValue: null }]
    })
    expect(Object.keys(errs(a, "supplements.a.home.properties")).sort()).toEqual([
      "supplements.a.home.properties.0.fairMarketValue",
      "supplements.a.home.properties.0.ownerNames",
      "supplements.a.home.properties.0.ownershipType",
      "supplements.a.home.properties.0.propertyAddress",
    ])
    a.supplements.a.home.properties = [property]
    expect(errs(a, "supplements.a.home.properties")).toEqual({})
  })

  it.each([
    ["spouse", {}],
    ["disabledChild", {}],
    ["sibling", {}],
    ["caregiverChild", {}],
  ] as const)("asks for the name and whether %s lives in the home when yes", (key) => {
    const a = answers((x) => {
      x.supplements.a.home.ownsHome = "yes"
      x.supplements.a.home[key].has = "yes"
    })
    expect(errs(a, `supplements.a.home.${key}`)).toEqual({
      [`supplements.a.home.${key}.livesInHome`]: "This question is required.",
      [`supplements.a.home.${key}.name`]: "This question is required.",
    })
  })

  it("asks a child under 21 for a date of birth and a dependent relative for the relationship", () => {
    const a = answers((x) => {
      x.supplements.a.home.ownsHome = "yes"
      x.supplements.a.home.childUnder21.has = "yes"
      x.supplements.a.home.dependentRelative.has = "yes"
    })
    expect(Object.keys(errs(a, "supplements.a.home.childUnder21", "supplements.a.home.dependentRelative")).sort()).toEqual([
      "supplements.a.home.childUnder21.dateOfBirth",
      "supplements.a.home.childUnder21.livesInHome",
      "supplements.a.home.childUnder21.name",
      "supplements.a.home.dependentRelative.livesInHome",
      "supplements.a.home.dependentRelative.name",
      "supplements.a.home.dependentRelative.relationshipDescription",
    ])
  })

  it("ignores relatives and properties left behind after ownsHome flips to no", () => {
    const a = answers((x) => {
      x.supplements.a.home.ownsHome = "no"
      x.supplements.a.home.spouse.has = "yes"
      x.supplements.a.home.properties = [{ ownerNames: "", propertyAddress: "", ownershipType: null, fairMarketValue: null }]
    })
    expect(errs(a, "supplements.a.home.spouse", "supplements.a.home.properties")).toEqual({})
  })

  it("asks for a description of other real estate when yes", () => {
    const a = answers((x) => (x.supplements.a.home.ownsOtherRealEstate = "yes"))
    expect(errs(a, "supplements.a.home.ownsOtherRealEstate", "supplements.a.home.otherRealEstateDescription")).toEqual({
      "supplements.a.home.otherRealEstateDescription": "This question is required.",
    })
  })
})

describe("Supplement A: long-term-care insurance", () => {
  it("requires the opening question, then rows when yes", () => {
    expect(errs(answers(), LTCI)).toEqual({ "supplements.a.longTermCareInsurance.hasPolicy": "This question is required." })
    const yes = answers((x) => (x.supplements.a.longTermCareInsurance.hasPolicy = "yes"))
    expect(errs(yes, LTCI)).toEqual({ "supplements.a.longTermCareInsurance.policies": "Add at least one." })
    yes.supplements.a.longTermCareInsurance.policies = [{ companyAndPolicyNumber: "", policyholder: "", effectiveDate: null, premium: null }]
    expect(Object.keys(errs(yes, LTCI)).sort()).toEqual([
      "supplements.a.longTermCareInsurance.policies.0.companyAndPolicyNumber",
      "supplements.a.longTermCareInsurance.policies.0.effectiveDate",
      "supplements.a.longTermCareInsurance.policies.0.policyholder",
      "supplements.a.longTermCareInsurance.policies.0.premium",
    ])
    yes.supplements.a.longTermCareInsurance.policies = [{ companyAndPolicyNumber: "Example LTC / P-1", policyholder: "Walter", effectiveDate: "2015-01-01", premium: 250 }]
    expect(errs(yes, LTCI)).toEqual({})
  })

  it("ignores stale policies after the answer flips to no", () => {
    const a = answers((x) => {
      x.supplements.a.longTermCareInsurance.hasPolicy = "no"
      x.supplements.a.longTermCareInsurance.policies = [{ companyAndPolicyNumber: "", policyholder: "", effectiveDate: null, premium: null }]
    })
    expect(errs(a, LTCI)).toEqual({})
  })
})

describe("Supplement A: tax returns", () => {
  it("requires which returns were filed, and whether copies were kept when any were filed", () => {
    expect(errs(answers(), ...TAX)).toEqual({ "supplements.a.taxReturnsFiled": "This question is required." })
    expect(errs(answers((x) => (x.supplements.a.taxReturnsFiled = "neither")), ...TAX)).toEqual({})
    for (const filed of ["bothYears", "oneYear"] as const) {
      const a = answers((x) => (x.supplements.a.taxReturnsFiled = filed))
      expect(errs(a, ...TAX)).toEqual({ "supplements.a.hasCopiesOfTaxReturns": "This question is required." })
      a.supplements.a.hasCopiesOfTaxReturns = "no"
      expect(errs(a, ...TAX)).toEqual({})
    }
  })

  it("ignores a stale copies answer when no returns were filed", () => {
    const a = answers((x) => {
      x.supplements.a.taxReturnsFiled = "neither"
      x.supplements.a.hasCopiesOfTaxReturns = null
    })
    expect(errs(a, ...TAX)).toEqual({})
  })
})
