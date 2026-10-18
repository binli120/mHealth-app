/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { completeFacilityCouple, completeRichHousehold } from "../../__tests__/complete-answers"
import type { BankAccountRow, Saca2Answers, SecuritiesRow, TrustRow } from "../../types"
import { ASSETS_ENTRIES } from "../field-map/assets"
import { STEPS_3_4_ENTRIES } from "../field-map/steps-3-5"
import { FIELD_MAP } from "../field-map"
import { getFieldInfo, getInventory } from "../inventory"
import { NEVER_FILL } from "../never-fill"
import { buildOverflowSheets } from "../overflow-plan"
import { fillSaca2Pdf } from "../pdf-fill"
import { pagesToKeep } from "../page-selection"
import { createVisibleReader } from "../visible-reader"
import { readFilled, type FilledValues } from "./helpers/read-filled"

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"
const MAPPED = new Set([...STEPS_3_4_ENTRIES, ...ASSETS_ENTRIES].flatMap((e) => e.fields))

/** Fills with the real map and reads back only the fields this region maps (checkboxes: only those selected). */
async function fillRegion(answers: Saca2Answers): Promise<FilledValues> {
  const { text, checks } = await readFilled(await fillSaca2Pdf(answers, null, ON))
  return {
    text: Object.fromEntries(Object.entries(text).filter(([name]) => MAPPED.has(name))),
    checks: Object.fromEntries(Object.entries(checks).filter(([name, state]) => MAPPED.has(name) && state !== null)),
  }
}

const expectNoSentinel = (values: FilledValues) => expect(JSON.stringify(values)).not.toContain(SENTINEL)

// ---------------------------------------------------------------------------------------------
// Field names (literal, so a wrong map entry cannot hide behind a shared constant)
// ---------------------------------------------------------------------------------------------

const AIAN = "Are you or is anyone in your household an American Indian or Alaska Native?"
const BILLS = "Do you or your spouse have bills for medical services you got in the three months before the month we got your application?"
const WANTS = "Do you or your spouse want to apply for MassHealth for that time period?"
const EARLIEST = "If Yes what is the earliest date for which you need MassHealth_S4"
const REAL_ESTATE_GATES = [
  "Do you own or have a legal interest in your primary residence?",
  "Does your spouse own or have a legal interest in your primary residence?",
  "Do you own or have a legal interest in any real estate other than your primary residence?",
  "Does your spouse own or have a legal interest in any real estate other than your primary residence?",
]
const TRUST_GATES = [
  "10. Are you or your spouse the grantor/donor, trustee, or beneficiary of any trusts?",
  "11. Have you, your spousecontributed income owned by you or your spouse to a trust?",
]
const BURIAL_BOXES = {
  "you.contract": "Burial contract for you?",
  "you.trust": "Burial trust for you?",
  "you.lifeInsurance": "Life insurance for burial for you?",
  "you.burialOnlyAccount": "Burial only account for you?",
  "you.plot": "Burial plot for you?",
  "spouse.contract": "Burial contract for your spouse?",
  "spouse.trust": "Burial trust for your spouse?",
  "spouse.lifeInsurance": "Life insurance for burial for your spouse?",
  "spouse.burialOnlyAccount": "Burial only account for your spouse?",
  "spouse.plot": "Prepaid burial plot for your spouse?",
}
const ALL_BURIAL_NO = Object.fromEntries(Object.values(BURIAL_BOXES).map((name) => [name, "No"]))
const ALL_JOINT = [
  "Joint assetCash?",
  "Joint assetStocks?",
  "Joint assetBonds?",
  "Joint assetSavingsBonds?",
  "Joint assetMutualFunds?",
  "Joint assetOptions?",
  "Joint assetFutureContracts?",
  "Joint assetOther?",
]

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const bank = (row: Partial<BankAccountRow>): BankAccountRow => ({
  ownerName: "",
  accountType: "checking",
  institution: "",
  accountNumber: "",
  currentBalance: null,
  balanceOnAdmissionDate: null,
  open: true,
  closedOn: null,
  balanceWhenClosed: null,
  ...row,
})

const security = (row: Partial<SecuritiesRow>): SecuritiesRow => ({
  kind: "cash",
  owners: "",
  company: "",
  accountNumber: "",
  currentValue: null,
  valueOnAdmissionDate: null,
  joint: false,
  ...row,
})

const trust = (row: Partial<TrustRow>): TrustRow => ({
  name: "",
  revocable: false,
  currentPrincipal: null,
  principalOnAdmissionDate: null,
  trustees: "",
  grantors: "",
  beneficiaries: "",
  ...row,
})

/** The rich household with every gate Yes and more rows than the form holds in every category. */
function richAssets(): Saca2Answers {
  const a = completeRichHousehold()
  for (const gate of Object.keys(a.assets.gates) as Array<keyof typeof a.assets.gates>) a.assets.gates[gate] = "yes"
  a.aian.anyMember = "yes"
  a.previousMedicalBills = {
    hasBills: "yes",
    wantsCoverageForPeriod: "yes",
    earliestDate: "2026-07-01",
    requests: [
      { name: "Maria Testcase", earliestDateRequested: "2026-07-01", circumstancesChanged: "yes" },
      { name: "Pedro Testcase", earliestDateRequested: "2026-08-15", circumstancesChanged: "no" },
      { name: "Lucas Testcase", earliestDateRequested: "2026-09-01", circumstancesChanged: "no" },
      { name: "Ana Testcase", earliestDateRequested: "2026-09-02", circumstancesChanged: "yes" },
    ],
  }
  a.assets.bankAccounts = [
    // the wizard hides the admission balance for a household that is not applying for long-term care
    bank({ ownerName: "Maria Testcase", accountType: "checking", institution: "First Bank", accountNumber: "1111", currentBalance: 1200.5, balanceOnAdmissionDate: 1300 }),
    // closed: the stale current balance must stay off the form
    bank({ ownerName: "Pedro Testcase", accountType: "savings", institution: "Credit Union One", accountNumber: "2222", currentBalance: 999, open: false, closedOn: "2026-03-31", balanceWhenClosed: 45 }),
    bank({ ownerName: "Maria Testcase", accountType: "certificateOfDeposit", institution: "Bay CD", accountNumber: "3333", currentBalance: 5000 }),
    bank({ ownerName: "Maria Testcase", accountType: "ira", institution: "Retire Co", accountNumber: "4444", currentBalance: 20000 }),
    bank({ ownerName: "Pedro Testcase", accountType: "moneyMarket", institution: "MM Bank", accountNumber: "5555", currentBalance: 77, open: false, closedOn: "2026-01-15", balanceWhenClosed: 10 }),
  ]
  a.assets.primaryResidence = [{ address: "1 Example St, Testville MA", propertyType: "oneFamily", currentValue: 450000 }]
  a.assets.otherRealEstate = [
    { address: "9 Cape Rd, Testville MA", propertyType: "other", currentValue: 120000 },
    { address: "3 Lake Rd, Testville MA", propertyType: "twoFamily", currentValue: 80000.5 },
  ]
  a.assets.lifeInsurance = [
    { owners: "Maria Testcase", company: "Example Life", policyNumber: "L-1", faceValue: 10000, insuranceType: "whole life", cashSurrenderValue: 2000 },
    { owners: "Pedro Testcase", company: "Term Co", policyNumber: "L-2", faceValue: 50000, insuranceType: "term", cashSurrenderValue: null },
    { owners: "Lucas Testcase", company: "Kid Life", policyNumber: "L-3", faceValue: 5000.25, insuranceType: "whole life", cashSurrenderValue: 100 },
  ]
  a.assets.securities = [
    security({ kind: "stocks", owners: "Maria Testcase", company: "Broker A", accountNumber: "S-1", currentValue: 8000, valueOnAdmissionDate: 8200, joint: true }),
    security({ kind: "cash", owners: "Pedro Testcase", company: "Safe Box", accountNumber: "S-2", currentValue: 300 }),
    security({ kind: "stocks", owners: "Maria Testcase", company: "Broker B", accountNumber: "S-3", currentValue: 1500.75 }),
    security({ kind: "futures", owners: "Pedro Testcase", company: "Broker C", accountNumber: "S-4", currentValue: 40, joint: true }),
    security({ kind: "other", owners: "Maria Testcase", company: "Broker D", accountNumber: "S-5", currentValue: 12 }),
  ]
  a.assets.annuities = [
    { owners: "Maria Testcase", institution: "Annuity One", contractNumber: "A-1", purchasedOn: "2023-05-01" },
    { owners: "Pedro Testcase", institution: "Annuity Two", contractNumber: "A-2", purchasedOn: "2024-06-02" },
    { owners: "Maria Testcase", institution: "Annuity Three", contractNumber: "A-3", purchasedOn: "2025-07-03" },
  ]
  a.assets.assistedLivingDeposits = [
    { facilityName: "Example Residence", facilityAddress: "5 Elm St", amount: 3000, depositedOn: "2025-01-15" },
    { facilityName: "Second Residence", facilityAddress: "6 Oak St", amount: 1250.5, depositedOn: "2025-02-16" },
  ]
  a.assets.vehicles = [
    { owner: "you", vehicleType: "Car", yearMakeModel: "2018 Honda Civic", fairMarketValue: 9000, amountOwed: 1500 },
    { owner: "spouse", vehicleType: "Boat", yearMakeModel: "2010 Bayliner", fairMarketValue: 4000, amountOwed: null },
    { owner: "you", vehicleType: "Mobile home", yearMakeModel: "12 Park Way", fairMarketValue: 30000, amountOwed: 0 },
  ]
  a.assets.burial = [
    { owner: "you", kind: "contract", amount: 5000 },
    { owner: "spouse", kind: "trust", amount: 3000.5 },
    { owner: "you", kind: "plot", amount: null },
    { owner: "you", kind: "contract", amount: 100 },
  ]
  a.assets.trusts = [
    trust({ name: "Family Trust", revocable: false, currentPrincipal: 90000, principalOnAdmissionDate: 95000, trustees: "T One", grantors: "G One", beneficiaries: "B One" }),
    trust({ name: "Second Trust", revocable: true, currentPrincipal: 1000, trustees: "T Two", grantors: "G Two", beneficiaries: "B Two" }),
    trust({ name: "Third Trust", revocable: true, currentPrincipal: 2000.5, trustees: "T Three", grantors: "G Three", beneficiaries: "B Three" }),
  ]
  return a
}

/** `richAssets()` for a household applying for long-term care: admission balances are asked. */
function richAssetsFacility(): Saca2Answers {
  const a = richAssets()
  a.intake.programs.longTermCare = true
  a.assets.trusts[0].principalOnAdmissionDate = 95000
  return a
}

// ---------------------------------------------------------------------------------------------
// Read-back: complete fixtures
// ---------------------------------------------------------------------------------------------

describe("Steps 3-5: rich household (every gate No)", () => {
  it("writes No on every gate and nothing in any table", async () => {
    const { text, checks } = await fillRegion(completeRichHousehold())
    expect(text).toEqual({})
    expect(checks).toEqual({
      [AIAN]: "2",
      [BILLS]: "2",
      "S5.1": "2",
      "S5.1a": "2",
      "S5.1b": "2",
      ...Object.fromEntries(REAL_ESTATE_GATES.map((name) => [name, "No"])),
      "Do you or your spouse own any life insurance?": "No",
      "Securities brokerage accounts?": "No",
      Annuities: "No",
      "Assisted living": "No",
      Vehicles: "No",
      "Prepaid Burial Plans": "No",
      ...Object.fromEntries(TRUST_GATES.map((name) => [name, "No"])),
    })
  })
})

describe("Steps 3-5: facility couple (every gate Yes, one row per category, facility applicant)", () => {
  it("writes exactly the expected table cells and Yes/No groups", async () => {
    const { text, checks } = await fillRegion(completeFacilityCouple())
    expect(text).toEqual({
      "Name on account": "Walter Testcase",
      "Account type": "Savings",
      "Name of bankinstitution": "Example Bank",
      "Account number": "0001",
      "Current balance": "54000",
      "Balance on admission date": "55000",
      "Address_real estate": "1 Example St, Testville MA",
      "Type of property": "One-family",
      "Current value": "450000",
      "Address_real estate_2": "9 Cape Rd, Testville MA",
      "Type of property_2": "Other",
      "Current value_2": "120000",
      "Name(s) of owner(s)_life insurance": "Walter Testcase",
      "Insurance company_life insurance": "Example Life",
      "Policy number_life insurance": "L-1",
      "Face value_life insurance": "10000",
      "Insurance type_life insurance": "whole life",
      "Owners namesStocks": "Walter Testcase",
      "Company nameStocks": "Example Brokerage",
      "Account numberStocks": "S-1",
      fill_36: "8000",
      fill_37: "8200",
      "Name(s) of owner(s)_Annuities": "Walter Testcase",
      "Name of institution issuing annuity_Annuities": "Example Annuity Co",
      "Contract number_Annuities": "A-1",
      "Date purchased mmddyyyy_Annuities": "05/01/2023",
      "Name of facility_Assisted living": "Example Residence",
      "Address_Assisted living": "5 Elm St",
      "Amount of deposit_Assisted living": "3000",
      "Date deposit given to facility_Assisted living": "01/15/2025",
      "Your spouse Type of vehicle_2": "Car",
      Yearmakemodel_2: "2018 Honda Civic",
      "Fair-market value_2": "9000",
      "Amount owed_2": "0",
      Amount_PBP_1: "5000",
      "Trust name": "Testcase Family Trust",
      "Current trust principal": "90000",
      "Trust principal on admission date* $": "95000",
      Trustees: "Test Trustee",
      GrantorsDonors: "Walter Testcase",
      Beneficiaries: "Test Child",
    })
    expect(checks).toEqual({
      [AIAN]: "2",
      [BILLS]: "2",
      "S5.1": "1",
      "S5.1a": "1",
      "S5.1b": "1",
      "Account open or closed": "1",
      "Do you or your spouse own any life insurance?": "Yes",
      "Securities brokerage accounts?": "Yes",
      "Joint assetStocks?": "No",
      Annuities: "Yes",
      "Assisted living": "Yes",
      Vehicles: "Yes",
      "Prepaid Burial Plans": "Yes",
      ...ALL_BURIAL_NO,
      [BURIAL_BOXES["you.contract"]]: "Yes",
      "Revocable trust?": "No",
    })
  })
})

// ---------------------------------------------------------------------------------------------
// Read-back and overflow: more rows than the form holds
// ---------------------------------------------------------------------------------------------

describe("Steps 3-5: a household with more rows than the form holds", () => {
  it("fills the form's lines with the first rows (and the Step 3-4 answers) and no more", async () => {
    const { text, checks } = await fillRegion(richAssets())
    expect(text).toEqual({
      [EARLIEST]: "07/01/2026",
      "S4. Name": "Maria Testcase",
      "S4. Earliest date requested": "07/01/2026",
      "S4. Name_2": "Pedro Testcase",
      "S4. Earliest date requested_2": "08/15/2026",
      // bank accounts 1-2 (the closed one writes its closing date and amount, not its current balance)
      "Name on account": "Maria Testcase",
      "Account type": "Checking",
      "Name of bankinstitution": "First Bank",
      "Account number": "1111",
      "Current balance": "1200.50",
      "Name on account_2": "Pedro Testcase",
      "Account type_2": "Savings",
      "Name of bankinstitution_2": "Credit Union One",
      "Account number_2": "2222",
      "Date account closed mmddyyyy_2": "03/31/2026",
      "Amount on the date account closed_2": "45",
      // real estate: the primary residence, then the first other property
      "Address_real estate": "1 Example St, Testville MA",
      "Type of property": "One-family",
      "Current value": "450000",
      "Address_real estate_2": "9 Cape Rd, Testville MA",
      "Type of property_2": "Other",
      "Current value_2": "120000",
      "Name(s) of owner(s)_life insurance": "Maria Testcase",
      "Insurance company_life insurance": "Example Life",
      "Policy number_life insurance": "L-1",
      "Face value_life insurance": "10000",
      "Insurance type_life insurance": "whole life",
      "Name(s) of owner(s)_life insurance_2": "Pedro Testcase",
      "Insurance company_life insurance_2": "Term Co",
      "Policy number_life insurance_2": "L-2",
      "Face value_life insurance_2": "50000",
      "Insurance type_life insurance_2": "term",
      // securities: one row per type; the second stocks row is extra
      "Owners namesCash": "Pedro Testcase",
      "Company nameCash": "Safe Box",
      "Account numberCash": "S-2",
      fill_34: "300",
      "Owners namesStocks": "Maria Testcase",
      "Company nameStocks": "Broker A",
      "Account numberStocks": "S-1",
      fill_36: "8000",
      "Owners namesFuture contracts": "Pedro Testcase",
      "Company nameFuture contracts": "Broker C",
      "Account numberFuture contracts": "S-4",
      fill_46: "40",
      "Owners namesOther": "Maria Testcase",
      "Company nameOther": "Broker D",
      "Account numberOther": "S-5",
      fill_48: "12",
      "Name(s) of owner(s)_Annuities": "Maria Testcase",
      "Name of institution issuing annuity_Annuities": "Annuity One",
      "Contract number_Annuities": "A-1",
      "Date purchased mmddyyyy_Annuities": "05/01/2023",
      "Name(s) of owner(s)_Annuities_2": "Pedro Testcase",
      "Name of institution issuing annuity_Annuities_2": "Annuity Two",
      "Contract number__Annuities_2": "A-2",
      "Date purchased mmddyyyy__Annuities_2": "06/02/2024",
      "Name of facility_Assisted living": "Example Residence",
      "Address_Assisted living": "5 Elm St",
      "Amount of deposit_Assisted living": "3000",
      "Date deposit given to facility_Assisted living": "01/15/2025",
      "You Type of vehicle": "Car",
      Yearmakemodel: "2018 Honda Civic",
      "Fair-market value": "9000",
      "Amount owed": "1500",
      "Your spouse Type of vehicle_2": "Boat",
      Yearmakemodel_2: "2010 Bayliner",
      "Fair-market value_2": "4000",
      Amount_PBP_1: "5000",
      Amount_PBP_6: "3000.50",
      "Trust name": "Family Trust",
      "Current trust principal": "90000",
      Trustees: "T One",
      GrantorsDonors: "G One",
      Beneficiaries: "B One",
      "Trust name_2": "Second Trust",
      "Current trust principal_2": "1000",
      Trustees_2: "T Two",
      GrantorsDonors_2: "G Two",
      Beneficiaries_2: "B Two",
    })
    expect(checks).toEqual({
      [AIAN]: "1",
      [BILLS]: "1",
      [WANTS]: "1",
      "S4.   Any change in circumstances during this time?": "1",
      "S4.   Any change in circumstances during this time?_2": "2",
      "S5.1": "1",
      "S5.1a": "1",
      "S5.1b": "1",
      "Account open or closed": "1",
      "Account open or closed_2": "2",
      // a "Yes" does not say whose property it is, so the You / Your spouse boxes stay blank
      "Do you or your spouse own any life insurance?": "Yes",
      "Securities brokerage accounts?": "Yes",
      "Joint assetCash?": "No",
      "Joint assetStocks?": "Yes",
      "Joint assetFutureContracts?": "Yes",
      "Joint assetOther?": "No",
      Annuities: "Yes",
      "Assisted living": "Yes",
      Vehicles: "Yes",
      "Prepaid Burial Plans": "Yes",
      ...ALL_BURIAL_NO,
      [BURIAL_BOXES["you.contract"]]: "Yes",
      [BURIAL_BOXES["you.plot"]]: "Yes",
      [BURIAL_BOXES["spouse.trust"]]: "Yes",
      "Revocable trust?": "No",
      "Revocable trust?_2": "Yes",
    })
    // every securities Joint asset group of a row that exists is answered, the others stay blank
    expect(ALL_JOINT.filter((name) => checks[name] === undefined)).toEqual([
      "Joint assetBonds?",
      "Joint assetSavingsBonds?",
      "Joint assetMutualFunds?",
      "Joint assetOptions?",
    ])
  })

  it("lists exactly the rows beyond the form's capacity on continuation sheets, in the form's order", () => {
    expect(buildOverflowSheets(richAssets(), ON)).toEqual([
      {
        title: "Additional previous medical bill requests",
        columns: ["Name", "Earliest date requested", "Any change in circumstances during this time?"],
        rows: [
          ["Lucas Testcase", "09/01/2026", "No"],
          ["Ana Testcase", "09/02/2026", "Yes"],
        ],
      },
      {
        title: "Additional bank accounts",
        columns: [
          "Name on account",
          "Account type",
          "Name of bank/institution",
          "Account number",
          "Current balance ($)",
          "Balance on admission date ($)",
          "Account open or closed",
          "Date account closed",
          "Amount on the date account closed ($)",
        ],
        rows: [
          ["Maria Testcase", "Certificate of deposit", "Bay CD", "3333", "5000", "", "Open", "", ""],
          ["Maria Testcase", "Individual retirement account (IRA)", "Retire Co", "4444", "20000", "", "Open", "", ""],
          // closed: closing date and amount, not the stale current balance
          ["Pedro Testcase", "Money market", "MM Bank", "5555", "", "", "Closed", "01/15/2026", "10"],
        ],
      },
      {
        title: "Additional real estate",
        columns: ["Address", "Type of property", "Current value ($)"],
        rows: [["3 Lake Rd, Testville MA", "Two-family", "80000.50"]],
      },
      {
        title: "Additional life insurance policies",
        columns: ["Name(s) of owner(s)", "Insurance company", "Policy number", "Face value ($)", "Insurance type"],
        rows: [["Lucas Testcase", "Kid Life", "L-3", "5000.25", "whole life"]],
      },
      {
        title: "Additional securities and brokerage accounts",
        columns: ["Type", "Owner(s) name(s)", "Company name", "Account number", "Current value ($)", "Value on admission date ($)", "Joint asset?"],
        rows: [["Stocks", "Maria Testcase", "Broker B", "S-3", "1500.75", "", "No"]],
      },
      {
        title: "Additional annuities",
        columns: ["Name(s) of owner(s)", "Name of institution issuing the annuity", "Contract number", "Date purchased"],
        rows: [["Maria Testcase", "Annuity Three", "A-3", "07/03/2025"]],
      },
      {
        title: "Additional assisted living and similar deposits",
        columns: ["Name of facility", "Address of facility", "Amount of deposit ($)", "Date deposit given to facility"],
        rows: [["Second Residence", "6 Oak St", "1250.50", "02/16/2025"]],
      },
      {
        title: "Additional vehicles and mobile homes",
        columns: ["Owner", "Type of vehicle", "Year/make/model (or mobile home address)", "Fair-market value ($)", "Amount owed ($)"],
        rows: [["You", "Mobile home", "12 Park Way", "30000", "0"]],
      },
      {
        title: "Additional prepaid burial plans",
        columns: ["Owner", "Type", "Amount ($)"],
        rows: [["You", "Burial contract", "100"]],
      },
      {
        title: "Additional trusts",
        columns: [
          "Trust name",
          "Revocable?",
          "Current trust principal ($)",
          "Trust principal on admission date ($)",
          "Trustee(s)",
          "Grantor(s)/Donor(s)",
          "Beneficiaries",
        ],
        rows: [["Third Trust", "Yes", "2000.50", "", "T Three", "G Three", "B Three"]],
      },
    ])
  })

  it("never puts a row that is on a continuation sheet into a form field", async () => {
    const { text } = await fillRegion(richAssets())
    const values = Object.values(text).join("\n")
    for (const overflowOnly of ["Bay CD", "Retire Co", "MM Bank", "3 Lake Rd", "Kid Life", "Broker B", "Annuity Three", "Second Residence", "12 Park Way", "Third Trust", "Lucas Testcase", "Ana Testcase"]) {
      expect(values).not.toContain(overflowOnly)
    }
  })

  it("writes balances on the admission date, and a column per category, for a long-term-care household", async () => {
    const { text } = await fillRegion(richAssetsFacility())
    expect(text["Balance on admission date"]).toBe("1300")
    expect(text["Balance on admission date_2"]).toBeUndefined()
    expect(text.fill_37).toBe("8200")
    expect(text["Trust principal on admission date* $"]).toBe("95000")
    const rows = buildOverflowSheets(richAssetsFacility(), ON).find((s) => s.title === "Additional securities and brokerage accounts")?.rows
    expect(rows).toEqual([["Stocks", "Maria Testcase", "Broker B", "S-3", "1500.75", "", "No"]])
  })

  it("appends one continuation sheet per overflowing category to the assembled PDF", async () => {
    const answers = richAssets()
    const bytes = await fillSaca2Pdf(answers, null, ON)
    const doc = await PDFDocument.load(bytes)
    const sheets = buildOverflowSheets(answers, ON)
    expect(sheets).toHaveLength(10)
    expect(doc.getPageCount()).toBe(pagesToKeep(answers, ON).length + sheets.length)

    if (spawnSync("pdftotext", ["-v"]).error) return
    const dir = mkdtempSync(path.join(tmpdir(), "saca2-assets-"))
    try {
      const file = path.join(dir, "out.pdf")
      writeFileSync(file, bytes)
      const out = spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }).stdout.replace(/[ \t]+/g, " ")
      for (const sheet of sheets) expect(out).toContain(`Continuation — ${sheet.title}`)
      expect(out).toContain("Retire Co")
      expect(out).toContain("12 Park Way")
      expect(out).toContain("Applicant: Maria Q Testcase SSN: 123-45-6789")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("leaves the securities table clean: no value printed on another row (stray widgets removed)", async () => {
    const doc = await PDFDocument.load(await fillSaca2Pdf(richAssets(), null, ON))
    const page = doc.getPage(15)
    const names = new Map(doc.getForm().getFields().map((f) => [f.getName(), f]))
    for (const field of names.values()) {
      const onPage = field.acroField.getWidgets().filter((w) => w.P() === page.ref)
      if (/^(Owners names|Company name|Account number)(Cash|Stocks|Bonds|Savings bonds|Mutual funds|Options|Future contracts|Other)$|^fill_(3[4-9]|4\d)$/.test(field.getName())) {
        expect(onPage).toHaveLength(1)
      }
    }
  })
})

// ---------------------------------------------------------------------------------------------
// Stale answers
// ---------------------------------------------------------------------------------------------

describe("Steps 3-5: stale answers never reach the form", () => {
  it("bank gates No with leftover rows: the table is empty, the gates say No, and no sheet is built", async () => {
    const a = richAssets()
    a.assets.gates.bankAccounts = "no"
    a.assets.gates.retirementAccounts = "no"
    a.assets.gates.closedAccounts = "no"
    a.assets.bankAccounts[0].ownerName = SENTINEL
    a.assets.bankAccounts[4].institution = SENTINEL
    const { text, checks } = await fillRegion(a)
    expectNoSentinel({ text, checks })
    for (const name of ["Name on account", "Name on account_2", "Account type", "Current balance", "Date account closed mmddyyyy_2"]) {
      expect(text[name]).toBeUndefined()
    }
    expect(checks["S5.1"]).toBe("2")
    expect(checks["Account open or closed"]).toBeUndefined()
    expect(buildOverflowSheets(a, ON).some((s) => s.title === "Additional bank accounts")).toBe(false)
    expect(JSON.stringify(buildOverflowSheets(a, ON))).not.toContain(SENTINEL)
  })

  it("bank gate Yes only for retirement accounts still shows the table; all three No hides it", async () => {
    const a = richAssets()
    a.assets.gates.bankAccounts = "no"
    a.assets.gates.closedAccounts = "no"
    expect((await fillRegion(a)).text["Name on account"]).toBe("Maria Testcase")
  })

  it("real estate gates No: no property rows, owner boxes say No, no overflow sheet", async () => {
    const a = richAssets()
    a.assets.gates.primaryResidence = "no"
    a.assets.gates.otherRealEstate = "no"
    a.assets.primaryResidence[0].address = SENTINEL
    a.assets.otherRealEstate[1].address = SENTINEL
    const { text, checks } = await fillRegion(a)
    expectNoSentinel({ text, checks })
    expect(text["Address_real estate"]).toBeUndefined()
    expect(text["Address_real estate_2"]).toBeUndefined()
    for (const name of REAL_ESTATE_GATES) expect(checks[name]).toBe("No")
    expect(buildOverflowSheets(a, ON).some((s) => s.title === "Additional real estate")).toBe(false)
  })

  it("only the other-real-estate gate Yes: primary rows are hidden, other rows fill the table from the first line", async () => {
    const a = richAssets()
    a.assets.gates.primaryResidence = "no"
    a.assets.primaryResidence[0].address = SENTINEL
    const { text, checks } = await fillRegion(a)
    expectNoSentinel({ text, checks })
    expect(text["Address_real estate"]).toBe("9 Cape Rd, Testville MA")
    expect(text["Address_real estate_2"]).toBe("3 Lake Rd, Testville MA")
    expect(buildOverflowSheets(a, ON).some((s) => s.title === "Additional real estate")).toBe(false)
  })

  it("a closed account writes the closing date and amount, never the current balance; an open account never writes a stale closing date", async () => {
    const a = richAssets()
    a.assets.bankAccounts = [
      bank({ ownerName: "Closed One", institution: "Bank A", currentBalance: 111, open: false, closedOn: "2026-02-02", balanceWhenClosed: 22 }),
      bank({ ownerName: "Open One", institution: "Bank B", currentBalance: 333, open: true, closedOn: "2026-04-04", balanceWhenClosed: SENTINEL.length }),
    ]
    const { text, checks } = await fillRegion(a)
    expect(text["Current balance"]).toBeUndefined()
    expect(text["Date account closed mmddyyyy"]).toBe("02/02/2026")
    expect(text["Amount on the date account closed"]).toBe("22")
    expect(checks["Account open or closed"]).toBe("2")
    expect(text["Current balance_2"]).toBe("333")
    expect(text["Date account closed mmddyyyy_2"]).toBeUndefined()
    expect(text["Amount on the date account closed_2"]).toBeUndefined()
    expect(checks["Account open or closed_2"]).toBe("1")
  })

  it("a household that is not applying for long-term care never writes the admission-date columns, even when stale values exist", async () => {
    const a = richAssets()
    a.assets.bankAccounts[0].balanceOnAdmissionDate = 424242
    a.assets.securities[0].valueOnAdmissionDate = 424242
    a.assets.trusts[0].principalOnAdmissionDate = 424242
    const { text } = await fillRegion(a)
    expect(JSON.stringify(text)).not.toContain("424242")
    expect(JSON.stringify(buildOverflowSheets(a, ON))).not.toContain("424242")
    // turning the facility on makes the same values visible (the first bank row and stocks row)
    const facility = richAssets()
    facility.intake.programs.longTermCare = true
    facility.assets.bankAccounts[0].balanceOnAdmissionDate = 424242
    expect((await fillRegion(facility)).text["Balance on admission date"]).toBe("424242")
  })

  it("every other gate No hides its rows (securities, annuities, deposits, vehicles, burial, trusts, life insurance)", async () => {
    const a = richAssets()
    for (const gate of ["lifeInsurance", "securities", "annuities", "assistedLivingDeposit", "vehicles", "burial", "trusts"] as const) {
      a.assets.gates[gate] = "no"
    }
    a.assets.lifeInsurance[2].company = SENTINEL
    a.assets.securities[2].company = SENTINEL
    a.assets.annuities[2].institution = SENTINEL
    a.assets.assistedLivingDeposits[1].facilityName = SENTINEL
    a.assets.vehicles[2].vehicleType = SENTINEL
    a.assets.burial[3].amount = SENTINEL.length
    a.assets.trusts[2].name = SENTINEL
    const { text, checks } = await fillRegion(a)
    expectNoSentinel({ text, checks })
    expect(Object.keys(text).filter((name) => !/^(S4\.|Name on account|Account|Name of bank|Current balance|Address_real|Type of property|Current value|Date account|Amount on the date)/.test(name) && name !== EARLIEST)).toEqual([])
    // "No" burial says No for every line (the section is skipped); no row writes an amount
    expect(checks["Prepaid Burial Plans"]).toBe("No")
    expect(checks[BURIAL_BOXES["you.contract"]]).toBeUndefined()
    const titles = buildOverflowSheets(a, ON).map((s) => s.title)
    expect(titles).toEqual([
      "Additional previous medical bill requests",
      "Additional bank accounts",
      "Additional real estate",
    ])
  })

  it("previous bills: 'no' hides the follow-ups and the request lines", async () => {
    const a = richAssets()
    a.previousMedicalBills.hasBills = "no"
    a.previousMedicalBills.requests[0].name = SENTINEL
    a.previousMedicalBills.earliestDate = "2026-01-01"
    const { text, checks } = await fillRegion(a)
    expectNoSentinel({ text, checks })
    expect(text[EARLIEST]).toBeUndefined()
    expect(text["S4. Name"]).toBeUndefined()
    expect(checks[BILLS]).toBe("2")
    expect(checks[WANTS]).toBeUndefined()
    expect(JSON.stringify(buildOverflowSheets(a, ON))).not.toContain("Ana Testcase")
  })

  it("previous bills: wanting no coverage for the period hides the date and the request lines", async () => {
    const a = richAssets()
    a.previousMedicalBills.wantsCoverageForPeriod = "no"
    a.previousMedicalBills.requests[1].name = SENTINEL
    const { text, checks } = await fillRegion(a)
    expectNoSentinel({ text, checks })
    expect(text[EARLIEST]).toBeUndefined()
    expect(text["S4. Name"]).toBeUndefined()
    expect(checks[WANTS]).toBe("2")
    expect(buildOverflowSheets(a, ON).some((s) => s.title === "Additional previous medical bill requests")).toBe(false)
  })

  it("prepaid burial: every line is answered only when the gate says Yes", async () => {
    const a = richAssets()
    a.assets.burial = []
    const { checks } = await fillRegion(a)
    expect(checks["Prepaid Burial Plans"]).toBe("Yes")
    for (const name of Object.values(BURIAL_BOXES)) expect(checks[name]).toBe("No")
  })

  it("an unanswered gate writes nothing for that group", async () => {
    const a = richAssets()
    a.assets.gates.vehicles = null
    a.assets.gates.trusts = null
    const { checks } = await fillRegion(a)
    expect(checks.Vehicles).toBeUndefined()
    for (const name of TRUST_GATES) expect(checks[name]).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------------------------
// Coverage and structure
// ---------------------------------------------------------------------------------------------

describe("Steps 3-5: coverage of PDF indexes 13-16", () => {
  const onPages = getInventory().filter((f) => f.pages.some((page) => page >= 13 && page <= 16))
  const personTwoIncome = new Set(["43. What is your total expected income for the current calendar year?_P2", "44. What is your total expected income for next calendar year, if different?_P2"])

  it("accounts for every field: mapped here, mapped in Task 6 (Person 2 income), or never filled with a note", () => {
    const mappedElsewhere = new Set(FIELD_MAP.flatMap((e) => e.fields))
    const unaccounted = onPages.filter((f) => !MAPPED.has(f.name) && !personTwoIncome.has(f.name) && !(f.name in NEVER_FILL) && !mappedElsewhere.has(f.name))
    expect(unaccounted.map((f) => f.name)).toEqual([])
  })

  it("counts: 159 mapped here, 10 never-fill, no unresolved", () => {
    const here = onPages.filter((f) => MAPPED.has(f.name))
    const never = onPages.filter((f) => f.name in NEVER_FILL)
    expect(here).toHaveLength(159)
    expect(never.map((f) => f.name).sort()).toEqual(
      [
        "Account number_PBP",
        "Account number_PBP_2",
        "Bank name_PBP",
        "Bank name_PBP_2",
        "Insurance company_PBP",
        "Insurance company_PBP_2",
        "Mobile home address",
        "Mobile home address_2",
        "Policy number_PBP",
        "Policy number_PBP_2",
      ].sort(),
    )
    for (const field of never) expect(NEVER_FILL[field.name].note).toMatch(/^WIZARD GAP/)
  })

  it("keeps the Person 2 yearly income fields (Task 6) mapped exactly once", () => {
    for (const name of personTwoIncome) {
      expect(FIELD_MAP.filter((e) => e.fields.includes(name))).toHaveLength(1)
      expect(MAPPED.has(name)).toBe(false)
    }
  })

  it("every Yes/No group listed names the Yes widget left of the No widget, or names its states", () => {
    for (const entry of [...STEPS_3_4_ENTRIES, ...ASSETS_ENTRIES]) {
      if (typeof entry.encode !== "object" || entry.encode.kind !== "yesNo") continue
      const info = getFieldInfo(entry.fields[0])!
      const encode = entry.encode as { kind: "yesNo"; yes: string; no: string }
      const yesWidget = info.widgets.find((w) => w.onState === encode.yes)!
      const noWidget = info.widgets.find((w) => w.onState === encode.no)!
      expect(yesWidget).toBeDefined()
      expect(noWidget).toBeDefined()
      expect(yesWidget.rect[0]).toBeLessThan(noWidget.rect[0])
    }
  })

  it("has no field on these pages with more than one widget in the securities table after the template is prepared", () => {
    for (const field of onPages) {
      if (field.type === "text") expect(field.widgets.length).toBe(1)
    }
  })

  it("the reader sees the form's rows only through visibility (the closed account's current balance is hidden)", () => {
    const reader = createVisibleReader(richAssets(), ON)
    expect(reader.get({ kind: "row", stepId: "assets", path: "assets.bankAccounts", index: 1, key: "currentBalance" })).toBeUndefined()
    expect(reader.get({ kind: "row", stepId: "assets", path: "assets.bankAccounts", index: 1, key: "balanceWhenClosed" })).toBe(45)
  })
})
