/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it, vi } from "vitest"

import { completeFacilityCouple, completeHomeWithAllSupplements, completeSingleSenior } from "../../__tests__/complete-answers"
import { getStepContent } from "../../questions"
import type { Saca2Answers } from "../../types"
import { WRAPPED_TEXTS, lineWidths, measureHelvetica, wrapLines } from "../derived-supp-a"
import { SUPP_A_ENTRIES } from "../field-map/supp-a"
import { FIELD_MAP } from "../field-map"
import { getFieldInfo } from "../inventory"
import { NEVER_FILL } from "../never-fill"
import { buildOverflowSheets } from "../overflow-plan"
import { pagesToKeep } from "../page-selection"
import { fillSaca2Pdf } from "../pdf-fill"
import { isCheckboxEncoder } from "../encoders"
import { readFilled, type FilledValues } from "./helpers/read-filled"

// each test fills the 1.7 MB template; the full suite runs many files in parallel
vi.setConfig({ testTimeout: 60_000 })

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"
const MAPPED = new Set(SUPP_A_ENTRIES.flatMap((e) => e.fields))
const SIGNATURE_FIELDS = ["Date_SuppA_Signature_2", "Print name_SuppA_Signature_2"]

/** Fills with the real map and reads back only the fields this region maps (checkboxes: only those selected). */
async function fillRegion(answers: Saca2Answers): Promise<FilledValues> {
  const { text, checks } = await readFilled(await fillSaca2Pdf(answers, null, ON))
  return {
    text: Object.fromEntries(Object.entries(text).filter(([name]) => MAPPED.has(name))),
    checks: Object.fromEntries(Object.entries(checks).filter(([name, state]) => MAPPED.has(name) && state !== null)),
  }
}

const NAME_1 = "Last name first name middle initial_SuppA"
const SSN_1 = "Social security number_SuppA"
const NURSING = "Do you need long-term-care services in a nursing home type facility?_SuppA"
const HCBS = "Are you applying for or getting long-term-care services at home under a Home- and Community-Based Services Waiver?_SuppA"
const PACE = "Are you applying for or getting long-term-care services and supports through Program of All-Inclusive Care for the Elderly (PACE)?_SuppA"
const FACILITY = "Name and address of hospital nursing facility or other institution_SuppA"
const PLACED = "Were you placed here by another state?_SuppA"
const GUARDIAN = "Do you have to pay guardianship expenses for a court-appointed guardian?"
const SPOUSE_NAME = "Spouses last name first name middle initial_SuppA"
const SPOUSE_SSN = "Social security number__SuppA_2"
const HEAT = "Does your spouse pay for heat?"
const UTILITIES = "Does your spouse pay for utilities?"
const FAMILY_GATE = "Is a child, parent, brother, and/or sister living with your spouse?"
const Q6 = (letter: string) => `In the past 60 months_6${letter}`
const DEPOSIT = "Have you, your spouse, or someone acting on your behalf given a deposit?"
const OWNS_HOME = "Real estate?"
const INTENDS = "15. Do you intend to return to your home?"
const OTHER_RE = "16 Do you or your spouse own or have a legal interest in other real estate not listed in 8 above?"
const OTHER_RE_LINE = (n: number) => `If Yes please describe the property and list its address below ${n}`
const LTC = "17. Do you or your spouse have long-term-care insurance?"
const TAX = "18. Did you or your spouse file U.S. income tax returns in the last two years?"

const WORD = "abcdefghi"
const words = (count: number) => Array.from({ length: count }, () => WORD).join(" ")

function withSsns(a: Saca2Answers): Saca2Answers {
  a.persons[0].hasSsn = "yes"
  a.persons[0].ssn = "123-45-6789"
  if (a.persons[1]) {
    a.persons[1].hasSsn = "yes"
    a.persons[1].ssn = "987-65-4321"
  }
  return a
}

function facilityCouple(): Saca2Answers {
  return withSsns(completeFacilityCouple())
}

/** The facility couple with every Supplement A group filled, and rows beyond the form's capacity. */
function richSuppA(): Saca2Answers {
  const a = withSsns(completeFacilityCouple())
  const sa = a.supplements.a
  sa.facility.placedByOtherState = "yes"
  sa.facility.placedFromState = "New Hampshire"
  sa.facility.paysGuardianshipExpenses = "yes"
  sa.spouseMonthlyExpenses = {
    rent: 1200,
    mortgage: 900,
    homeownersInsurance: 100.5,
    realEstateTaxes: 300,
    condoOrCoopFee: 250,
    assistedLivingRoomAndBoard: 2000,
    paysHeat: "yes",
    paysUtilities: "no",
  }
  sa.familyAtHome.hasFamily = "yes"
  sa.familyAtHome.members = [1, 2, 3, 4].map((n) => ({
    name: `Member ${n}`,
    ssn: `11${n}-22-333${n}`,
    relationship: `Relation ${n}`,
    dateOfBirth: `198${n}-01-0${n}`,
    monthlyIncome: n * 100,
  }))
  sa.transferAnswers = {
    trust: "yes",
    income: "yes",
    assets: "yes",
    deed: "yes",
    lifeEstateLivedOneYear: "yes",
    addedToDeed: "yes",
    loanOrNote: "yes",
    annuity: "yes",
  }
  a.transfers = [1, 2, 3, 4, 5].map((n) => ({
    description: `Transfer ${n}`,
    dateOfTransfer: `2024-0${n}-1${n}`,
    transferredTo: `Person ${n}`,
    relationship: `Kin ${n}`,
    amount: n * 1000,
  }))
  sa.facilityDeposit = {
    gaveDeposit: "yes",
    facilityName: "Elm Care Community",
    facilityAddress: "7 Oak Ave, Testville MA",
    amount: 25000.5,
    stillHeld: "no",
    returned: "yes",
    returnedToName: "Test Child",
    returnedToAddress: "3 Pine Rd, Testville MA",
  }
  sa.home.properties = [
    { ownerNames: "Walter Testcase", propertyAddress: "1 Example St, Testville MA", ownershipType: "individual", fairMarketValue: 450000 },
    { ownerNames: "Dorothy Testcase", propertyAddress: "2 Example St, Testville MA", ownershipType: "jointTenancy", fairMarketValue: 300000 },
  ]
  sa.home.spouse = { has: "yes", name: "Dorothy Testcase", livesInHome: "no" }
  sa.home.disabledChild = { has: "yes", name: "Disabled Child", livesInHome: "yes" }
  sa.home.childUnder21 = { has: "yes", name: "Young Child", livesInHome: "no", dateOfBirth: "2012-05-06" }
  sa.home.sibling = { has: "yes", name: "Sibling Testcase", livesInHome: "yes" }
  sa.home.caregiverChild = { has: "yes", name: "Caring Child", livesInHome: "no" }
  // 18 words: 5 fit the first line (263 pt wide), 11 the second (505 pt), 2 go to the continuation sheet
  sa.home.dependentRelative = { has: "yes", name: "Dependent Kin", livesInHome: "yes", relationshipDescription: words(18) }
  sa.intendsToReturnHome = "yes"
  sa.longTermCareInsurance.hasPolicy = "yes"
  sa.longTermCareInsurance.policies = [
    { companyAndPolicyNumber: "Acme Life P-100", policyholder: "Walter Testcase", effectiveDate: "2020-01-15", premium: 150 },
    { companyAndPolicyNumber: "Beta Care P-200", policyholder: "Dorothy Testcase", effectiveDate: "2021-02-20", premium: 99.99 },
  ]
  sa.taxReturnsFiled = "bothYears"
  sa.hasCopiesOfTaxReturns = "no"
  return a
}

/** Stale Supplement A data (every group) that no visible gate allows. */
function leftovers(a: Saca2Answers) {
  const sa = a.supplements.a
  sa.facility = { name: SENTINEL, address: SENTINEL, admissionDate: "2020-02-02", placedByOtherState: "yes", placedFromState: SENTINEL, paysGuardianshipExpenses: "yes" }
  sa.spouseMonthlyExpenses = {
    rent: 777,
    mortgage: 777,
    homeownersInsurance: 777,
    realEstateTaxes: 777,
    condoOrCoopFee: 777,
    assistedLivingRoomAndBoard: 777,
    paysHeat: "yes",
    paysUtilities: "yes",
  }
  sa.familyAtHome = { hasFamily: "yes", members: [{ name: SENTINEL, ssn: "111-22-3333", relationship: SENTINEL, dateOfBirth: "1990-01-01", monthlyIncome: 777 }] }
}

describe("Supplement A: facility couple", () => {
  it("writes the header, facility, spouse, transfer, home and tax answers exactly", async () => {
    expect(await fillRegion(facilityCouple())).toEqual({
      text: {
        [NAME_1]: "Testcase, Walter",
        [SSN_1]: "123-45-6789",
        [FACILITY]: "Example Nursing Home, 5 Elm St, Testville MA",
        "Date of admission mmddyyyy_SuppA": "09/01/2026",
        [SPOUSE_NAME]: "Testcase, Dorothy",
        Rent_SuppA: "1200",
        "Description of assetincome_SuppA": "Cash gift",
        "Date of transfer mmddyyyy_SuppA": "03/15/2024",
        "Transferred to whom_SuppA": "Test Child",
        "Relationship to you or your spouse_SuppA": "child",
        "Amount  of transfer_SuppA": "30000",
        "Name and address of persons on ownership papers_SuppA": "Walter Testcase",
        "Description and address of property location_SuppA": "1 Example St, Testville MA",
        "Individual Fair-market value $": "450000",
        [OTHER_RE_LINE(1)]: "Cottage at 9 Cape Rd, Testville MA",
      },
      checks: {
        [NURSING]: "Yes",
        [HCBS]: "No",
        [PACE]: "No",
        [PLACED]: "No",
        [GUARDIAN]: "No",
        [HEAT]: "Yes",
        [UTILITIES]: "Yes",
        [FAMILY_GATE]: "No",
        [Q6("a")]: "No",
        [Q6("b")]: "No",
        [Q6("c")]: "Yes",
        [Q6("d")]: "No",
        [Q6("f")]: "No",
        [Q6("g")]: "No",
        [Q6("h")]: "No",
        [DEPOSIT]: "No",
        [OWNS_HOME]: "Yes",
        "Type of ownership (Check one.)": "1",
        "9. Do you have a spouse?": "No",
        "10. Do you have a permanently and totally disabled or blind child?": "No",
        "11. Do you have a child under 21 years of age?": "No",
        "12. Do you have a brother or sister with a legal interest in the home?": "No",
        "13. Has  son or daughter provided care to you that allowed you to live in the home?": "No",
        "14. Do you have a dependent relative?": "No",
        [INTENDS]: "No",
        [OTHER_RE]: "Yes",
        [LTC]: "No",
        [TAX]: "1",
      },
    })
  })

  it("leaves the spouse's name and SSN blank when Person 2 is not a legally married spouse (the expenses still follow the wizard)", async () => {
    const a = facilityCouple()
    a.persons[0].isLegallyMarried = "no"
    const out = await fillRegion(a)
    expect(out.text[SPOUSE_NAME]).toBeUndefined()
    expect(out.text[SPOUSE_SSN]).toBeUndefined()
    expect(out.text.Rent_SuppA).toBe("1200")
    expect(out.text[NAME_1]).toBe("Testcase, Walter")
  })

  it("writes the spouse's SSN when the spouse is applying (the wizard asks for it only then)", async () => {
    const a = facilityCouple()
    a.persons[1].applyingForCoverage = "yes"
    const out = await fillRegion(a)
    expect(out.text[SPOUSE_NAME]).toBe("Testcase, Dorothy")
    expect(out.text[SPOUSE_SSN]).toBe("987-65-4321")
  })

  it("writes a middle initial after the first name and nothing partial for an invalid SSN", async () => {
    const a = facilityCouple()
    a.persons[0].middleName = "Quincy"
    a.persons[0].ssn = "12-3"
    const out = await fillRegion(a)
    expect(out.text[NAME_1]).toBe("Testcase, Walter Q")
    expect(out.text[SSN_1]).toBeUndefined()
  })
})

describe("Supplement A: HCBS applicant (no nursing facility)", () => {
  it("leaves the facility and spouse-expense blocks and the intends-to-return answer empty", async () => {
    expect(await fillRegion(completeHomeWithAllSupplements())).toEqual({
      text: { [NAME_1]: "Testcase, Edna", [SSN_1]: "123-45-6789" },
      checks: {
        [NURSING]: "No",
        [HCBS]: "Yes",
        [PACE]: "No",
        [Q6("a")]: "No",
        [Q6("b")]: "No",
        [Q6("c")]: "No",
        [Q6("d")]: "No",
        [Q6("f")]: "No",
        [Q6("g")]: "No",
        [Q6("h")]: "No",
        [DEPOSIT]: "No",
        [OWNS_HOME]: "No",
        [OTHER_RE]: "No",
        [LTC]: "No",
        [TAX]: "2",
      },
    })
  })

  it("keeps the facility and spouse blocks empty whatever stale data is left behind", async () => {
    const a = completeHomeWithAllSupplements()
    leftovers(a)
    a.supplements.a.intendsToReturnHome = "yes" // stale: hidden for an HCBS applicant
    const out = await fillRegion(a)
    expect(JSON.stringify(out)).not.toContain(SENTINEL)
    expect(out.text).toEqual({ [NAME_1]: "Testcase, Edna", [SSN_1]: "123-45-6789" })
    expect(out.checks[INTENDS]).toBeUndefined()
    for (const field of [PLACED, GUARDIAN, HEAT, UTILITIES, FAMILY_GATE]) expect(out.checks[field], field).toBeUndefined()
  })
})

describe("Supplement A: every group, with rows beyond the form's capacity", () => {
  it("writes each mapped group exactly", async () => {
    expect(await fillRegion(richSuppA())).toEqual({
      text: {
        [NAME_1]: "Testcase, Walter",
        [SSN_1]: "123-45-6789",
        [FACILITY]: "Example Nursing Home, 5 Elm St, Testville MA",
        "If Yes what state_SuppA": "New Hampshire",
        "Date of admission mmddyyyy_SuppA": "09/01/2026",
        [SPOUSE_NAME]: "Testcase, Dorothy",
        Rent_SuppA: "1200",
        Mortgage_SuppA: "900",
        Insurance_SuppA: "100.50",
        Tax_SuppA: "300",
        "Maintance charge_SuppA": "250",
        "Room and board for assisted liveing_SuppA": "2000",
        // family at home: members 1 and 2 on the form
        Name_SuppA_5: "Member 1",
        "Social security number__SuppA_3": "111-22-3331",
        Relationship_SuppA: "Relation 1",
        "Date of birth mmddyyyy_SuppA": "01/01/1981",
        "Monthly income before deductions $_SuppA": "100",
        Name__SuppA_6: "Member 2",
        "Social security number__SuppA_4": "112-22-3332",
        Relationship__SuppA_2: "Relation 2",
        "Date of birth mmddyyyy__SuppA_2": "01/02/1982",
        "Monthly income before deductions $_SuppA_2": "200",
        // transfers: rows 1-3 on the form
        "Description of assetincome_SuppA": "Transfer 1",
        "Date of transfer mmddyyyy_SuppA": "01/11/2024",
        "Transferred to whom_SuppA": "Person 1",
        "Relationship to you or your spouse_SuppA": "Kin 1",
        "Amount  of transfer_SuppA": "1000",
        "Description of assetincome_SuppA_2": "Transfer 2",
        "Date of transfer mmddyyyy_SuppA_2": "02/12/2024",
        "Transferred to whom_SuppA_2": "Person 2",
        "Relationship to you or your spouse_SuppA_2": "Kin 2",
        "Amount  of transfer_SuppA_2": "2000",
        "Description of assetincome_SuppA_3": "Transfer 3",
        "Date of transfer mmddyyyy_SuppA_3": "03/13/2024",
        "Transferred to whom_SuppA_3": "Person 3",
        "Relationship to you or your spouse_SuppA_3": "Kin 3",
        "Amount  of transfer_SuppA_3": "3000",
        // facility deposit
        "Name of facility_SuppA": "Elm Care Community",
        "Address of facility_SuppA": "7 Oak Ave, Testville MA",
        Amount_SuppA_5: "25000.50",
        "Name of person_SuppA": "Test Child",
        Address_SuppA_5: "3 Pine Rd, Testville MA",
        // homes
        "Name and address of persons on ownership papers_SuppA": "Walter Testcase",
        "Description and address of property location_SuppA": "1 Example St, Testville MA",
        "Individual Fair-market value $": "450000",
        "Name and address of persons on ownership papers 1_2": "Dorothy Testcase",
        "Description and address of property location 1_2": "2 Example St, Testville MA",
        "Joint tenancy Fair-market value_2": "300000",
        "9. Name_7": "Dorothy Testcase",
        "10. Name_8": "Disabled Child",
        "11. Name_9": "Young Child",
        "11. Date of birth mmddyyyy_3": "05/06/2012",
        "12. Name_10": "Sibling Testcase",
        "13. Name_11": "Caring Child",
        "14. Name_12": "Dependent Kin",
        "Describe the relationship and the nature of the dependency 1": words(5),
        "Describe the relationship and the nature of the dependency 2": words(11),
        [OTHER_RE_LINE(1)]: "Cottage at 9 Cape Rd, Testville MA",
        // insurance
        "17. Company name/Policy number_SuppA": "Acme Life P-100",
        "17. Policyholder name_suppA": "Walter Testcase",
        "17. Effective date mmddyyyy_SuppA": "01/15/2020",
        "17. Premium amount_SuppA": "150",
        "17. Company name/Policy number_SuppA_2": "Beta Care P-200",
        "17.Policyholder name_SuppA_2": "Dorothy Testcase",
        "17. Effective date mmddyyyy_SuppA_2": "02/20/2021",
        "17. Premium amount_SuppA_2": "99.99",
      },
      checks: {
        [NURSING]: "Yes",
        [HCBS]: "No",
        [PACE]: "No",
        [PLACED]: "Yes",
        [GUARDIAN]: "Yes",
        [HEAT]: "Yes",
        [UTILITIES]: "No",
        [FAMILY_GATE]: "Yes",
        [Q6("a")]: "Yes",
        [Q6("b")]: "Yes",
        [Q6("c")]: "Yes",
        [Q6("d")]: "Yes",
        [Q6("e")]: "Yes",
        [Q6("f")]: "Yes",
        [Q6("g")]: "Yes",
        [Q6("h")]: "Yes",
        [DEPOSIT]: "Yes",
        "Does the facility still have the deposit?": "No",
        "Did the facility return the deposit?": "Yes",
        [OWNS_HOME]: "Yes",
        // block 1: 1 Individual; block 2 numbers Joint tenancy as 2 (the template differs between blocks)
        "Type of ownership (Check one.)": "1",
        "Type of ownership (Check one.)_2": "2",
        "9. Do you have a spouse?": "Yes",
        "Is this person living in your home?_9": "No",
        "10. Do you have a permanently and totally disabled or blind child?": "Yes",
        "Is this person living in your home?_10": "Yes",
        "11. Do you have a child under 21 years of age?": "Yes",
        "Is this person living in your home?_11": "No",
        "12. Do you have a brother or sister with a legal interest in the home?": "Yes",
        "Is this person living in your home?_12": "Yes",
        "13. Has  son or daughter provided care to you that allowed you to live in the home?": "Yes",
        "Is this person living in your home?_13": "No",
        "14. Do you have a dependent relative?": "Yes",
        "Is this person living in your home?_14": "Yes",
        [INTENDS]: "Yes",
        [OTHER_RE]: "Yes",
        [LTC]: "Yes",
        [TAX]: "1",
      },
    })
  })

  it("puts rows beyond the form's capacity ONLY on the continuation sheets, each exactly once", async () => {
    const a = richSuppA()
    const sheets = buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Supplement A"))
    expect(sheets).toEqual([
      {
        title: "Supplement A: additional resource transfers",
        columns: ["Description of asset/income", "Date of transfer", "Transferred to whom", "Relationship to you or your spouse", "Amount of transfer ($)"],
        rows: [
          ["Transfer 4", "04/14/2024", "Person 4", "Kin 4", "4000"],
          ["Transfer 5", "05/15/2024", "Person 5", "Kin 5", "5000"],
        ],
      },
      {
        title: "Supplement A: additional people living with your spouse",
        columns: ["Name", "Social Security number", "Relationship", "Date of birth", "Monthly income before deductions ($)"],
        rows: [
          ["Member 3", "113-22-3333", "Relation 3", "01/03/1983", "300"],
          ["Member 4", "114-22-3334", "Relation 4", "01/04/1984", "400"],
        ],
      },
      { title: "Supplement A: text continued", columns: ["Question", "Continued text"], rows: [["14. Relationship and the nature of the dependency", `${WORD} ${WORD}`]] },
    ])
    const form = JSON.stringify((await fillRegion(a)).text)
    for (const absent of ["Transfer 4", "Transfer 5", "Member 3", "Member 4", "04/14/2024", "05/15/2024", "Person 4", "Person 5"]) expect(form).not.toContain(absent)
    // the first rows are on the form, not on a sheet
    const sheetText = JSON.stringify(sheets)
    for (const present of ["Transfer 1", "Transfer 3", "Member 1", "Member 2"]) expect(sheetText).not.toContain(present)
  })

  it("has no sheet when everything fits the form", () => {
    for (const a of [facilityCouple(), completeHomeWithAllSupplements()]) {
      expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Supplement A"))).toEqual([])
    }
    const a = richSuppA()
    a.transfers = a.transfers.slice(0, 3)
    a.supplements.a.familyAtHome.members = a.supplements.a.familyAtHome.members.slice(0, 2)
    a.supplements.a.home.dependentRelative.relationshipDescription = words(16)
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Supplement A"))).toEqual([])
  })

  it("pins the capacities the field map assumes to the wizard's limits", () => {
    const content = getStepContent("suppA")!
    const repeater = (path: string) => content.sections.flatMap((s) => s.questions).find((q) => q.path === path)?.repeater
    expect(repeater("transfers")?.maxItems).toBe(10) // form: 3 rows, 7 on sheets
    expect(repeater("supplements.a.familyAtHome.members")?.maxItems).toBe(4) // form: 2
    expect(repeater("supplements.a.home.properties")?.maxItems).toBe(2) // form: 2
    expect(repeater("supplements.a.longTermCareInsurance.policies")?.maxItems).toBe(2) // form: 2
  })

  it("writes the fair-market value only on the line of the chosen ownership type", async () => {
    for (const [type, field, state] of [
      ["tenancyInCommon", "Tenancy in common Fair-market value", "2"],
      ["lifeEstate", "Life estate Fair-market value", "4"],
    ] as const) {
      const a = facilityCouple()
      a.supplements.a.home.properties[0].ownershipType = type
      const out = await fillRegion(a)
      const values = Object.keys(out.text).filter((name) => name.includes("Fair-market value"))
      expect(values, type).toEqual([field])
      expect(out.checks["Type of ownership (Check one.)"]).toBe(state)
    }
  })
})

describe("Supplement A: stale answers and gate flips", () => {
  it("needsNursingFacility No with leftover facility, spouse and family data: all empty", async () => {
    const a = facilityCouple()
    a.supplements.a.needsNursingFacility = "no"
    a.supplements.a.applyingHcbsWaiver = "yes"
    leftovers(a)
    const out = await fillRegion(a)
    expect(JSON.stringify(out)).not.toContain(SENTINEL)
    expect(Object.keys(out.text)).not.toEqual(expect.arrayContaining([FACILITY]))
    for (const field of [FACILITY, "Date of admission mmddyyyy_SuppA", "If Yes what state_SuppA", SPOUSE_NAME, SPOUSE_SSN, "Rent_SuppA", "Mortgage_SuppA", "Name_SuppA_5", "Monthly income before deductions $_SuppA"]) {
      expect(out.text[field], field).toBeUndefined()
    }
    for (const field of [PLACED, GUARDIAN, HEAT, UTILITIES, FAMILY_GATE]) expect(out.checks[field], field).toBeUndefined()
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.includes("people living with your spouse"))).toEqual([])
  })

  it("no spouse: spouse expenses stay empty even when the facility is needed", async () => {
    const a = facilityCouple()
    a.persons = [a.persons[0]]
    a.persons[0].isLegallyMarried = "no"
    a.supplements.a.spouseMonthlyExpenses.rent = 777
    const out = await fillRegion(a)
    expect(out.text.Rent_SuppA).toBeUndefined()
    expect(out.text[SPOUSE_NAME]).toBeUndefined()
    expect(out.checks[HEAT]).toBeUndefined()
    expect(out.text[FACILITY]).toBe("Example Nursing Home, 5 Elm St, Testville MA")
  })

  it("family gate No with leftover members: no member fields and no sheet", async () => {
    const a = richSuppA()
    a.supplements.a.familyAtHome.hasFamily = "no"
    const out = await fillRegion(a)
    expect(out.checks[FAMILY_GATE]).toBe("No")
    for (const field of ["Name_SuppA_5", "Name__SuppA_6", "Social security number__SuppA_3", "Relationship_SuppA"]) expect(out.text[field], field).toBeUndefined()
    expect(buildOverflowSheets(a, ON).some((s) => s.title.includes("people living with your spouse"))).toBe(false)
  })

  it("transfer answers all No with leftover rows: table empty and no sheet", async () => {
    const a = richSuppA()
    a.supplements.a.transferAnswers = {
      trust: "no",
      income: "no",
      assets: "no",
      deed: "no",
      lifeEstateLivedOneYear: "yes", // a Yes here is not a transfer
      addedToDeed: "no",
      loanOrNote: "no",
      annuity: "no",
    }
    a.transfers = a.transfers.map((t) => ({ ...t, description: SENTINEL, transferredTo: SENTINEL }))
    const out = await fillRegion(a)
    expect(JSON.stringify(out)).not.toContain(SENTINEL)
    for (const suffix of ["", "_2", "_3"]) {
      for (const base of ["Description of assetincome_SuppA", "Date of transfer mmddyyyy_SuppA", "Transferred to whom_SuppA", "Relationship to you or your spouse_SuppA", "Amount  of transfer_SuppA"]) {
        expect(out.text[`${base}${suffix}`], `${base}${suffix}`).toBeUndefined()
      }
    }
    expect(out.checks[Q6("e")]).toBe("Yes")
    expect(buildOverflowSheets(a, ON).some((s) => s.title.includes("transfers"))).toBe(false)
  })

  it("deposit No with leftover facility details, and the returned-to block follows 'returned'", async () => {
    const a = richSuppA()
    a.supplements.a.facilityDeposit.returned = "no"
    let out = await fillRegion(a)
    expect(out.text["Name of facility_SuppA"]).toBe("Elm Care Community")
    expect(out.text["Name of person_SuppA"]).toBeUndefined()
    expect(out.text.Address_SuppA_5).toBeUndefined()
    a.supplements.a.facilityDeposit = { ...a.supplements.a.facilityDeposit, gaveDeposit: "no", facilityName: SENTINEL, returnedToName: SENTINEL }
    out = await fillRegion(a)
    expect(JSON.stringify(out)).not.toContain(SENTINEL)
    expect(out.checks[DEPOSIT]).toBe("No")
    for (const field of ["Name of facility_SuppA", "Address of facility_SuppA", "Amount_SuppA_5"]) expect(out.text[field], field).toBeUndefined()
    expect(out.checks["Does the facility still have the deposit?"]).toBeUndefined()
  })

  it("ownsHome No with stale properties and relatives: everything under Q8-Q14 empty", async () => {
    const a = richSuppA()
    a.supplements.a.home.ownsHome = "no"
    a.supplements.a.home.properties[0].ownerNames = SENTINEL
    a.supplements.a.home.spouse.name = SENTINEL
    a.supplements.a.home.dependentRelative.relationshipDescription = SENTINEL
    const out = await fillRegion(a)
    expect(JSON.stringify(out)).not.toContain(SENTINEL)
    expect(out.checks[OWNS_HOME]).toBe("No")
    const homeFields = Object.keys({ ...out.text, ...out.checks }).filter((name) => /^(9|10|11|12|13|14)\.|Fair-market|ownership|Is this person|Describe the relationship/.test(name))
    expect(homeFields).toEqual([])
    // Q15 and Q16 are asked either way
    expect(out.checks[INTENDS]).toBe("Yes")
    expect(out.checks[OTHER_RE]).toBe("Yes")
    expect(buildOverflowSheets(a, ON).some((s) => s.title.includes("text continued"))).toBe(false)
  })

  it("a relative's gate No hides its name and 'lives in home'", async () => {
    const a = richSuppA()
    a.supplements.a.home.sibling = { has: "no", name: SENTINEL, livesInHome: "yes" }
    a.supplements.a.home.childUnder21 = { has: "no", name: SENTINEL, livesInHome: "yes", dateOfBirth: "2010-01-01" }
    const out = await fillRegion(a)
    expect(JSON.stringify(out)).not.toContain(SENTINEL)
    expect(out.text["11. Date of birth mmddyyyy_3"]).toBeUndefined()
    expect(out.checks["Is this person living in your home?_12"]).toBeUndefined()
    expect(out.checks["12. Do you have a brother or sister with a legal interest in the home?"]).toBe("No")
  })

  it("other real estate No, placed-by-other-state No and no policy: their details stay empty", async () => {
    const a = richSuppA()
    a.supplements.a.home.ownsOtherRealEstate = "no"
    a.supplements.a.home.otherRealEstateDescription = SENTINEL
    a.supplements.a.facility.placedByOtherState = "no"
    a.supplements.a.facility.placedFromState = SENTINEL
    a.supplements.a.longTermCareInsurance.hasPolicy = "no"
    a.supplements.a.longTermCareInsurance.policies[0].policyholder = SENTINEL
    a.supplements.a.taxReturnsFiled = "neither"
    const out = await fillRegion(a)
    expect(JSON.stringify(out)).not.toContain(SENTINEL)
    expect(out.checks[OTHER_RE]).toBe("No")
    expect(out.checks[LTC]).toBe("No")
    expect(out.checks[TAX]).toBe("3")
    expect(out.text["17. Company name/Policy number_SuppA"]).toBeUndefined()
  })

  it("Supplement A hidden: fills without throwing, the pages are dropped and no header is written", async () => {
    const a = completeSingleSenior()
    leftovers(a)
    a.supplements.a.needsNursingFacility = "no"
    a.supplements.a.home = { ...a.supplements.a.home, ownsHome: "yes", otherRealEstateDescription: SENTINEL }
    a.transfers = [{ description: SENTINEL, dateOfTransfer: "2024-01-01", transferredTo: SENTINEL, relationship: SENTINEL, amount: 1 }]
    const keep = pagesToKeep(a, ON)
    for (const page of [26, 27, 28, 29]) expect(keep, `page ${page}`).not.toContain(page)
    const bytes = await fillSaca2Pdf(a, null, ON)
    const filled = await readFilled(bytes)
    expect(JSON.stringify(filled)).not.toContain(SENTINEL)
    for (const field of [NAME_1, SSN_1, FACILITY]) expect(filled.text[field], field).toBeUndefined()
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Supplement A"))).toEqual([])
  })
})

describe("Supplement A: template checks", () => {
  it("Yes is the left widget of every Yes/No group (states Yes / No)", () => {
    const groups = SUPP_A_ENTRIES.filter((e) => typeof e.encode === "object" && e.encode.kind === "yesNo")
    expect(groups).toHaveLength(35)
    for (const { fields } of groups) {
      const widgets = getFieldInfo(fields[0])!.widgets
      expect(widgets, fields[0]).toHaveLength(2)
      const [left, right] = [...widgets].sort((a, b) => a.rect[0] - b.rect[0])
      expect([left.onState, right.onState], fields[0]).toEqual(["Yes", "No"])
    }
  })

  it("the ownership groups' states follow the widget positions of each block (they differ between the blocks)", () => {
    const entries = SUPP_A_ENTRIES.filter((e) => e.fields[0].startsWith("Type of ownership"))
    expect(entries.map((e) => e.fields[0])).toEqual(["Type of ownership (Check one.)", "Type of ownership (Check one.)_2"])
    for (const entry of entries) {
      expect(typeof entry.encode === "object" && entry.encode.kind === "pick").toBe(true)
      const states = (entry.encode as { states: Record<string, string> }).states
      // top row (larger y) first, left to right: Individual, Tenancy in common / Joint tenancy, Life estate
      const [topLeft, topRight, bottomLeft, bottomRight] = [...getFieldInfo(entry.fields[0])!.widgets].sort(
        (a, b) => b.rect[1] - a.rect[1] || a.rect[0] - b.rect[0],
      )
      expect(states).toEqual({
        individual: topLeft.onState,
        tenancyInCommon: topRight.onState,
        jointTenancy: bottomLeft.onState,
        lifeEstate: bottomRight.onState,
      })
    }
  })

  it("the tax-return boxes are bothYears, oneYear, neither from left to right", () => {
    const entry = SUPP_A_ENTRIES.find((e) => e.fields[0] === TAX)!
    const states = (entry.encode as { states: Record<string, string> }).states
    const [first, second, third] = [...getFieldInfo(TAX)!.widgets].sort((a, b) => a.rect[0] - b.rect[0])
    expect(states).toEqual({ bothYears: first.onState, oneYear: second.onState, neither: third.onState })
  })

  it("maps every checkbox group through a checkbox encoder and no text through one", () => {
    for (const entry of SUPP_A_ENTRIES) {
      expect(isCheckboxEncoder(entry.encode), entry.fields[0]).toBe(getFieldInfo(entry.fields[0])!.type === "checkbox")
    }
  })
})

describe("Supplement A: free text over several lines (wrapped by measured width)", () => {
  const PADDING = 4
  const wide = (text: string) => measureHelvetica(text)

  it("breaks at spaces, splits a word wider than a line by characters, and returns what does not fit", () => {
    const w = (n: number) => wide("a".repeat(n))
    expect(wrapLines("aa bb cc dd", [w(5), w(5)])).toEqual({ lines: ["aa bb", "cc dd"], rest: "" })
    expect(wrapLines("aa bb cc dd ee", [w(5), w(2)])).toEqual({ lines: ["aa bb", "cc"], rest: "dd ee" })
    expect(wrapLines("aaaaaaaaaa bb", [w(4), w(4), w(4)])).toEqual({ lines: ["aaaa", "aaaa", "aa"], rest: "bb" })
    expect(wrapLines("", [100, 100])).toEqual({ lines: ["", ""], rest: "" })
    expect(wrapLines("  spaced\nout\ttext ", [500])).toEqual({ lines: ["spaced out text"], rest: "" })
    expect(wrapLines(null, [100])).toEqual({ lines: [""], rest: "" })
  })

  const samples: Array<[string, string]> = [
    ["all capitals", Array.from({ length: 40 }, (_, i) => `OWNER${i}WWMM STREET`).join(" ")],
    ["digit-heavy", Array.from({ length: 40 }, (_, i) => `${1000000 + i * 7919}-${i}0${i}`).join(" ")],
    ["mixed case", Array.from({ length: 40 }, (_, i) => `ownA${i} Mary-Jane O'Neil`).join(" ")],
    ["one very long unbroken token", `Start ${"WMwm0123".repeat(60)} end`],
  ]
  for (const [label, text] of samples) {
    for (const [name, spec] of Object.entries(WRAPPED_TEXTS)) {
      it(`${name}: ${label} fits every line's widget width and loses no word`, () => {
        // widths recomputed here from the inventory, independent of lineWidths()
        const widths = spec.fields.map((f) => {
          const r = getFieldInfo(f)!.widgets[0].rect
          return r[2] - r[0] - PADDING
        })
        const { lines, rest } = wrapLines(text, lineWidths(spec))
        expect(lines).toHaveLength(widths.length)
        lines.forEach((line, i) => expect(wide(line), `line ${i + 1}`).toBeLessThanOrEqual(widths[i]))
        // lossless: printed lines + sheet text, split at the original spaces (a hard split inside a long word is rejoined)
        const printed = lines.filter((l) => l !== "")
        const rejoined = [...printed, ...(rest === "" ? [] : [rest])].join(" ")
        expect(rejoined.replace(/ /g, "")).toBe(text.replace(/ /g, ""))
        // words stay in order: each original word is a prefix-chain of the printed/sheet words
        const out = [...printed, rest].join(" ").split(" ").filter((p) => p !== "")
        let at = 0
        for (const word of text.split(" ")) {
          let built = ""
          while (built.length < word.length) built += out[at++]
          expect(built).toBe(word)
        }
        expect(at).toBe(out.length)
      })
    }
  }

  it("takes the widths from the template inventory (widget width minus padding), not a character count", () => {
    expect(lineWidths(WRAPPED_TEXTS["property0.owners"])[0]).toBeCloseTo(278.28 - PADDING, 1)
    expect(lineWidths(WRAPPED_TEXTS.dependentRelative)[0]).toBeCloseTo(267.37 - PADDING, 1)
  })

  it("an all-capitals answer in the filled form keeps every word on the form or on the sheet", async () => {
    const a = richSuppA()
    const owners = Array.from({ length: 30 }, (_, i) => `OWNA${i}`).join(" ")
    a.supplements.a.home.properties[0].ownerNames = owners
    const out = await fillRegion(a)
    const sheet = buildOverflowSheets(a, ON).find((s) => s.title === "Supplement A: text continued")!
    const rest = sheet.rows.find((r) => r[0].includes("property 1"))?.[1] ?? ""
    const lines = [
      out.text["Name and address of persons on ownership papers_SuppA"],
      out.text["Name and address of persons on ownership papers_SuppA_2"],
    ]
    expect([...lines, rest].join(" ").trim()).toBe(owners)
  })
})

describe("Supplement A never-fill sweep (signature block)", () => {
  it("lists the signature and its date with a reason and a specific note, and maps neither", () => {
    expect(NEVER_FILL["Print name_SuppA_Signature_2"].reason).toBe("signature")
    expect(NEVER_FILL.Date_SuppA_Signature_2.reason).toBe("signature-date")
    for (const name of SIGNATURE_FIELDS) {
      expect(NEVER_FILL[name].note, name).toMatch(/Supplement A/)
      expect(FIELD_MAP.some((e) => e.fields.includes(name)), name).toBe(false)
    }
  })

  const fixtures: Array<[string, () => Saca2Answers]> = [
    ["the facility couple", facilityCouple],
    ["the HCBS applicant", completeHomeWithAllSupplements],
    ["the every-group variant", richSuppA],
  ]
  for (const [label, build] of fixtures) {
    it(`leaves the signature, its date and the printed name empty for ${label}`, async () => {
      const { text } = await readFilled(await fillSaca2Pdf(build(), null, ON))
      for (const name of SIGNATURE_FIELDS) expect(text[name] ?? "", name).toBe("")
    })
  }
})
