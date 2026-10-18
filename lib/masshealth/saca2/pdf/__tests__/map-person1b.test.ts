/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it, vi } from "vitest"

import { completeFacilityCouple, completeRichHousehold } from "../../__tests__/complete-answers"
import { DEDUCTION_KEYS } from "../../demographic-options"
import type { Saca2Answers, Saca2IncomeItem, Saca2Person } from "../../types"
import { expandPersonTable } from "../field-map/person-table"
import { PERSON1_B_ROWS } from "../field-map/person1-b"
import { fillSaca2Pdf } from "../pdf-fill"
import { readFilled, type FilledValues } from "./helpers/read-filled"

// each test fills the 1.7 MB template (once or twice); the full suite runs many files in parallel
vi.setConfig({ testTimeout: 60_000 })

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"

/** Person 1's fields on form pages 4-6 (PDF indexes 5-7) and the end of Person 1's income page (index 8). */
const REGION = new Set(PERSON1_B_ROWS.flatMap((row) => row.p1?.fields ?? []))

// Citizenship and immigration (Q12-13)
const CITIZEN = "12. Are you a U.S. citizen or U.S. national?"
const NATURALIZED = "are you a naturalized, derived, or acquired citizen (not born in the US)?"
const ELIGIBLE = "13. do you have an eligible immigration status?"
const LPR = "Are you a Lawful Permanent Resident?"
const HAS_DOC = "Do you have an immigration document?"
const SAME_NAME = "Did you use the same name on this application that you did to get your immigration status?"
const ARRIVED = "Did you arrive in the U.S. after August 22, 1996?"
const VETERAN = "Are you an honorably discharged veteran?"
const IMMIGRATION_TEXT = [
  "Status award date mmddyyyy",
  "Immigration status",
  "Immigration document type",
  "Document ID number",
  "Passport or document expiration date mmddyyyy",
  "Country",
  "If No what name did you use First middle last and suffix",
]
const IMMIGRATION_CHECKS = [ELIGIBLE, LPR, HAS_DOC, SAME_NAME, ARRIVED, VETERAN]

// Q14-17
const RESIDENT = "14. Are you living in Massachusetts?"
const CAREGIVER = "15. Do you live with at least one child younger than age 19?"
const CHILDREN = "Namess and dates of birth of children"
const PREGNANT = "16. Are you pregnant?"
const BABIES = "If Yes how many babies are you expecting"
const DUE = "What is the expected due date"
const FOSTER = "17. Were you ever in foster care?"
const FOSTER_STATE = "If Yes in what state were you in foster care"
const FOSTER_MEDICAID = "Were you getting health care through a state Medicaid program?"

// Q18-21
const RENT = "18. Do you rent or own your property?"
const DISABILITY = "19. Do you have a disability?"
const ACCOMMODATION = "20. Do you need reasonable accommodation(s) because of a disability or injury?"
const CONDITION_BOXES = {
  lowVision: "Low vision",
  blind: "Blind",
  deaf: "Deaf",
  hardOfHearing: "Hard of hearing",
  developmentallyDisabled: "Developmentally disabled",
  intellectuallyDisabled: "Intellectually disabled",
  physicallyDisabled: "Physically disabled",
  other: "Other Please explain",
}
const ACCOMMODATION_BOXES = {
  tty: "Text telephone TTY",
  largePrint: "Largeprint publications",
  asl: "American Sign Language interpreter",
  videoRelay: "Video Relay Service",
  cart: "Communication Access Realtime Translations CART",
  braille: "Publications in braille",
  assistiveListening: "Assistive listening device",
  electronicFormat: "Publications in electronic format",
  other: "Other Please explain_2",
}
const CONDITION_OTHER = "20a. Explain Other"
const ACCOMMODATION_OTHER = "20b. Explain Other"
const SSI = "21. Did you ever get Supplemental Security Income (SSI)?"
const SSI_MONTH = "When did you last get SSI mmyyyy"
const LIVING = "21b. Do you live alone, with a spouse, at rest home or someone else's home?"

// Q22-27 current job and self-employment
const HAS_INCOME = "22. Do you have any income?"
const EMPLOYER = "23. Employer name and address"
const TAX_ID = "Federal Tax ID"
const WAGES = "24a.  Wagestips before taxes"
const WAGES_BOXES = {
  weekly: "Weekly",
  every2weeks: "Every 2 weeks",
  twiceMonthly: "Twice a month",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly Subtract any pretax deductions such as nontaxable health insurance premiums",
}
const EFFECTIVE = "24b.  Income effective date"
const HOURS = "25. Average number of hours worked each WEEK"
const SEASONAL = "26. Are you seasonally employed?"
const MONTH_BOXES = {
  jan: "Jan",
  feb: "Feb",
  mar: "March",
  apr: "April",
  may: "May",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "Sept",
  oct: "Oct",
  nov: "Nov",
  dec: "Dec",
}
const SELF_EMPLOYED = "27. Are you self-employed?"
const SE_WORK = "If Yes what type of work do you do"
const SE_PROFIT = "or how much will you lose from this selfemployment each month"
const SE_LOSS = "month profit or"
const SE_HOURS = "How many hours do you work per week"

// Q28 other income lines: [box, amount, how often]
const LINES = {
  socialSecurity: ["28. Social Security benefits", "Social Security benefits  $", "How often Social Security benefits"],
  pension: ["28. Retirement or Pension", "Retirement or Pension   $", "How often Retirement or Pension"],
  annuity: ["28. Annuities", "Annuities   $", "How often Annuities"],
  trust: ["28. Trusts", "Trusts   $", "How often Trusts"],
  unemployment: ["28. Unemployment", "Unemployment   $", "How often Unemployment"],
  investment: [
    "29 Interest dividends and other investment income",
    "Interest, dividends, and other investment income   $",
    "How often Interest, dividends, and other investment income",
  ],
  royalty: ["Royalty income", "Royalty income   $", "How often Royalty income"],
  alimony: ["Alimony received", "Alimony received   $", "How often Alimony received"],
  veterans: ["Federal veterans benefits", "Federal veteran’s benefits   $", "How often Federal veteran’s benefits"],
  militaryRetirement: ["Military retirement pay", "Military retirement pay   $", "How often Military retirement pay"],
  otherTaxable: ["Other taxable income include type", "Other taxable income   $", "How often Other taxable income"],
} as const
const PENSION_SOURCE = "Retirement or Pension Source"
const ALIMONY_PRE_2019 = "$"
const OTHER_TYPE = "Other taxable income Type"
const CG_BOX = "Capital gains On average how much net income or loss will you get from this capital gain each month"
const CG_PROFIT = "Capital gains profit $"
const CG_LOSS = "Capital gains loss $"
const FARM_BOX = "Net farming or fishing income"
const FARM_PROFIT = "Net farming or fishing income profit $"
const FARM_LOSS = "Net farming or fishing income loss $"
const FARM_HOURS = "How many hours  Net farming or fishing income each week"
const LOTTERY_BOX = "Lottery and Gambling Winnings"
const LOTTERY_AMOUNT = "Lottery and Gambling Winnings   $"
const LOTTERY_DATE = "Lottery and Gambling Winnings Effective Date"
const LOTTERY_BOXES = {
  oneTime: "One time only",
  weekly: "Weekly_2",
  every2weeks: "Every two weeks",
  twiceMonthly: "Twice a month_2",
  monthly: "Monthly_2",
  yearly: "Yearly",
}

// Q29-31
const RENTAL = "29. Do you get rental income?"
const TYPE_BOXES = { oneFamily: "onefamily", twoFamily: "twofamily", threeFamily: "threefamily", other: "other describe" }
const TYPE_OTHER = "How much monthly rental income or loss do you get from each rental unit from the real estate indicated above"
const UNIT_1 = {
  address: "29b. Address",
  unit: "29b. Unit",
  income: "29b. Amount of Income",
  loss: "29b. Amount of Loss",
  owner: "29b. Owner-occupied?",
}
const UNIT_2 = {
  address: "29b. Address_2",
  unit: "29b. Unit_2",
  income: "29b. Amount of Income_2",
  loss: "29b. Amount of Loss_2",
  owner: "29b. Owner-occupied?_2",
}
const HEAT = "29c. Do you pay for heat or utilities for your tenant?"
const ONE_TIME_THIS = "30. Have you or will you receive income during this calendar year as a one-time only payment?"
const THIS_YEAR = { type: "If Yes  Type", amount: "Amount", month: "Month Received", year: "Year received" }
const NEXT_YES = "31. Will you receive income during the next calendar year as a one-time only payment?"
const NEXT_NO = "32. Will you receive income during the next calendar year as a one-time only payment?"
const NEXT_YEAR = { type: "If Yes  Type_2", amount: "Amount_2", month: "Month Received_2", year: "Year received_2" }

// Q32 deductions: [box, amount]
const DEDUCTIONS = {
  educator: ["Educator expense Yearly amount", "ducator expense: Yearly amount $"],
  reservistExpenses: [
    "Certain business expenses of reservists performing artists or feebased government officials Yearly amount",
    "Certain business expenses of reservists, performing artists, or fee-based government officials: Yearly amount $",
  ],
  hsa: ["Health Savings Account deduction Yearly amount", "Health Savings Account deduction: Yearly amount $"],
  movingExpenses: [
    "Moving expenses for members of the Armed Forces Yearly amount",
    "Moving expenses for members of the Armed Forces: Yearly amount $",
  ],
  selfEmploymentTax: ["Deductible part of selfemployment tax Yearly amount", "Deductible part of self-employment tax: Yearly amount $"],
  selfEmployedRetirement: [
    "Contribution to selfemployed SEP SIMPLE and qualified plans Yearly amount",
    "Contribution to self-employed SEP, SIMPLE, and qualified plans: Yearly amount $",
  ],
  selfEmployedHealthInsurance: [
    "Selfemployed health insurance deduction Yearly amount",
    "Self-employed health insurance deduction: Yearly amount $",
  ],
  earlyWithdrawalPenalty: [
    "Penalty on early withdrawal of savings Yearly amount",
    "Penalty on early withdrawal of savings: Yearly amount $",
  ],
  alimonyPaid: [
    "Alimony paid alimony payments for a divorce separation agreement or court order that was finalized before January 1 2019",
    "Alimony paid $",
  ],
  ira: ["Individual Retirement Account IRA deduction Yearly amount", "Individual Retirement Account (IRA) deduction: Yearly amount $"],
  studentLoanInterest: [
    "Student loan deduction interest only not total payment Yearly amount",
    "Student loan deduction (interest only, not total payment): Yearly amount $",
  ],
} as const
const DEDUCTION_NONE = "None"
const INCOME_THIS = "33. What is your total expected income for the current calendar year?"
const INCOME_NEXT = "34. What is your total expected income for next calendar year, if different?"

// Tax filer details and the APTC statement (top of form page 4)
const FILER_DOB = "tax filer DOB"
const FILER_RELATION = "How are you related to the tax filer?"
const FILER_JOINT = "Is the tax filer married, filing a joint return?"
const FILER_SPOUSE = "If Yes list name of spouse and date of birth"
const FILER_OTHER = "Who else does the tax filer claim as dependents?"
const ABUSE = "Are you filing taxes separately because you are a victim of domestic abuse or abandonment?"
const APTC = "Premium Tax Credit (APTC)"

/** Fills with the real map and reads back only Person 1's fields on these pages (checkboxes: only those selected). */
async function fillRegion(answers: Saca2Answers): Promise<FilledValues> {
  const { text, checks } = await readFilled(await fillSaca2Pdf(answers, null, ON))
  return {
    text: Object.fromEntries(Object.entries(text).filter(([name]) => REGION.has(name))),
    checks: Object.fromEntries(Object.entries(checks).filter(([name, state]) => REGION.has(name) && state !== null)),
  }
}

function expectNoSentinel(values: FilledValues) {
  expect(JSON.stringify(values)).not.toContain(SENTINEL)
}

function expectEmpty(values: FilledValues, fields: string[]) {
  for (const field of fields) {
    expect(values.text, field).not.toHaveProperty([field])
    expect(values.checks, field).not.toHaveProperty([field])
  }
}

const person = (a: Saca2Answers): Saca2Person => a.persons[0]

/** Income rows come from untyped wizard rows; build them with defaults like the wizard's empty row. */
const row = (item: Partial<Saca2IncomeItem> & Pick<Saca2IncomeItem, "kind">): Saca2IncomeItem => ({
  amount: null,
  frequency: null,
  ...item,
})

describe("PERSON1_B_ROWS", () => {
  it("expands a repeater-item row into a row source for each person", () => {
    const entries = expandPersonTable(PERSON1_B_ROWS)
    const address = entries.find((e) => e.fields[0] === UNIT_2.address)
    expect(address?.source).toEqual({
      kind: "row",
      stepId: "person1",
      path: "rental.units",
      index: 1,
      key: "address",
      person: 0,
    })
    expect(entries.find((e) => e.fields[0] === "39b. Address_4")?.source).toEqual({
      kind: "row",
      stepId: "person1",
      path: "rental.units",
      index: 1,
      key: "address",
      person: 1,
    })
    expect(entries.find((e) => e.fields[0] === "10 City_P2")).toBeUndefined()
  })

  it("maps each Q31 box to its own state and every frequency box to a single value", () => {
    const entries = expandPersonTable(PERSON1_B_ROWS)
    const states = (field: string) => (entries.find((e) => e.fields[0] === field)!.encode as { states: object }).states
    expect(states(WAGES_BOXES.monthly)).toEqual({ monthly: "On" })
    expect(states(LOTTERY_BOXES.oneTime)).toEqual({ oneTime: "On" })
    expect(states(NEXT_YES)).toEqual({ yes: "1" })
    expect(states(NEXT_NO)).toEqual({ no: "2" })
  })
})

describe("Person 1 pages 4-6: rich household", () => {
  it("writes exactly the expected text and checkbox states", async () => {
    const { text, checks } = await fillRegion(completeRichHousehold())
    expect(text).toEqual({
      // Q13 immigration: a noncitizen LPR with a green card
      "Status award date mmddyyyy": "03/01/2015",
      "Immigration status": "Lawful permanent resident",
      "Immigration document type": "Permanent Resident Card (green card, I-551)",
      "Document ID number": "A000000001",
      "Passport or document expiration date mmddyyyy": "01/31/2030",
      Country: "Brazil",
      // Q15-17
      [CHILDREN]: "Lucas Testcase 09/09/2015",
      [BABIES]: "1",
      [DUE]: "01/20/2027",
      [FOSTER_STATE]: "MA",
      // Q23-26: the wages row (seasonal Jun-Aug)
      [EMPLOYER]: "Acme, 9 Work Rd, Testville MA",
      [WAGES]: "2000",
      [EFFECTIVE]: "01/05/2026",
      [HOURS]: "30",
      // Q27 self-employment: a profit
      [SE_WORK]: "House cleaning",
      [SE_PROFIT]: "800",
      [SE_HOURS]: "10",
      // Q28 pension line, capital gains profit
      [LINES.pension[1]]: "300",
      [LINES.pension[2]]: "Monthly",
      [PENSION_SOURCE]: "Brazilian pension fund",
      [CG_PROFIT]: "100",
      // Q29 two rental units, both as income
      [UNIT_1.address]: "12 Rental Ave, Testville MA",
      [UNIT_1.unit]: "1",
      [UNIT_1.income]: "1100",
      [UNIT_2.address]: "12 Rental Ave, Testville MA",
      [UNIT_2.unit]: "2",
      [UNIT_2.income]: "900",
      // Q30-31
      [THIS_YEAR.type]: "Insurance settlement",
      [THIS_YEAR.amount]: "2500",
      [THIS_YEAR.month]: "3",
      [THIS_YEAR.year]: "2026",
      [NEXT_YEAR.type]: "Lump-sum pension payment",
      [NEXT_YEAR.amount]: "4000",
      [NEXT_YEAR.month]: "2",
      [NEXT_YEAR.year]: "2027",
      // Q32 two deductions, Q33
      [DEDUCTIONS.hsa[1]]: "1500",
      [DEDUCTIONS.studentLoanInterest[1]]: "600",
      [INCOME_THIS]: "60000",
    })
    expect(checks).toEqual({
      [CITIZEN]: "2",
      [ELIGIBLE]: "1",
      [LPR]: "1",
      [HAS_DOC]: "1",
      [SAME_NAME]: "1",
      [ARRIVED]: "1",
      [VETERAN]: "2",
      [ABUSE]: "2",
      [RESIDENT]: "1",
      [CAREGIVER]: "1",
      [PREGNANT]: "1",
      [FOSTER]: "1",
      [FOSTER_MEDICAID]: "1",
      [RENT]: "1",
      [DISABILITY]: "2",
      [ACCOMMODATION]: "1",
      [CONDITION_BOXES.lowVision]: "On",
      [ACCOMMODATION_BOXES.largePrint]: "On",
      [SSI]: "2",
      [HAS_INCOME]: "1",
      [WAGES_BOXES.monthly]: "On",
      [SEASONAL]: "1",
      [MONTH_BOXES.jun]: "On",
      [MONTH_BOXES.jul]: "On",
      [MONTH_BOXES.aug]: "On",
      [SELF_EMPLOYED]: "1",
      [LINES.pension[0]]: "On",
      [CG_BOX]: "On",
      [RENTAL]: "1",
      [TYPE_BOXES.twoFamily]: "On",
      [UNIT_1.owner]: "2",
      [UNIT_2.owner]: "1",
      [HEAT]: "2",
      [ONE_TIME_THIS]: "1",
      [NEXT_YES]: "1",
      [DEDUCTIONS.hsa[0]]: "On",
      [DEDUCTIONS.studentLoanInterest[0]]: "On",
    })
  })

  it("leaves the pension, other-income and deduction blocks that Person 1 does not use blank", async () => {
    const { text, checks } = await fillRegion(completeRichHousehold())
    for (const [kind, [box, amount, often]] of Object.entries(LINES)) {
      if (kind === "pension") continue
      expectEmpty({ text, checks }, [box, amount, often])
    }
    expectEmpty({ text, checks }, [
      ...Object.values(LOTTERY_BOXES),
      ...Object.values(WAGES_BOXES).filter((f) => f !== WAGES_BOXES.monthly),
      CG_LOSS,
      FARM_BOX,
      SE_LOSS,
      DEDUCTION_NONE,
      INCOME_NEXT,
      NEXT_NO,
      FILER_DOB,
    ])
  })
})

describe("Person 1 pages 4-6: every answerable field", () => {
  it("writes the tax filer block, the APTC statement and the citizen identifiers", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    p.usCitizenOrNational = "yes"
    p.naturalizedCitizen = "yes"
    p.alienNumber = "A123456789"
    p.citizenshipCertificateNumber = "CERT-77"
    p.tax = {
      ...p.tax,
      claimedAsDependent: "yes",
      filingSeparatelyAbuse: "yes",
      filedForAptcYears: "yes",
      taxFiler: {
        name: "Rosa Filer",
        dateOfBirth: "1960-04-05",
        relationship: "mother",
        marriedFilingJointly: "yes",
        spouseName: "Hugo Filer",
        spouseDateOfBirth: "1958-03-02",
        otherDependents: "Her grandson Leo",
      },
    }
    const { text, checks } = await fillRegion(a)
    expect(text["Alien number"]).toBe("A123456789")
    expect(text["Naturalization or citizenship certificate number"]).toBe("CERT-77")
    expect(text[FILER_DOB]).toBe("04/05/1960")
    expect(text[FILER_RELATION]).toBe("mother")
    expect(text[FILER_SPOUSE]).toBe("Hugo Filer, 03/02/1958")
    expect(text[FILER_OTHER]).toBe("Her grandson Leo")
    expect(checks[CITIZEN]).toBe("1")
    expect(checks[NATURALIZED]).toBe("1")
    expect(checks[FILER_JOINT]).toBe("1")
    expect(checks[ABUSE]).toBe("1")
    expect(checks[APTC]).toBe("On") // Yes is /On on this box
    p.tax.filedForAptcYears = "no"
    expect((await fillRegion(a)).checks[APTC]).toBe("2")
  })

  it("writes immigration 'different name', residency, foster care and living-arrangement answers", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    Object.assign(p, {
      immigrationSameName: "no",
      immigrationOtherName: "Maria Quinn Souza",
      isVeteranOrMilitaryFamily: "yes",
      arrivedAfterAug1996: "no",
      isLprCheCofa: "no",
      residentOfMassachusetts: "no",
      fosterCareMedicaid: "no",
      rentOrOwn: "own",
      hasDisability: "yes",
      everGotSsi: "yes",
      lastSsiMonth: "03/2019",
      livingArrangement: "restHome",
      immigrationStatus: "refugee",
      immigrationDocumentType: "foreign-passport",
    })
    const { text, checks } = await fillRegion(a)
    expect(text["If No what name did you use First middle last and suffix"]).toBe("Maria Quinn Souza")
    expect(text["Immigration status"]).toBe("Refugee")
    expect(text["Immigration document type"]).toBe("Foreign passport")
    expect(text[SSI_MONTH]).toBe("03/2019")
    expect(checks).toMatchObject({
      [SAME_NAME]: "2",
      [VETERAN]: "1",
      [ARRIVED]: "2",
      [LPR]: "2",
      [RESIDENT]: "2",
      [FOSTER_MEDICAID]: "2",
      [RENT]: "2",
      [DISABILITY]: "1",
      [SSI]: "1",
      [LIVING]: "3",
    })
    for (const [value, state] of [["alone", "1"], ["withSpouse", "2"], ["restHome", "3"], ["someoneElsesHome", "4"]] as const) {
      p.livingArrangement = value
      expect((await fillRegion(a)).checks[LIVING]).toBe(state)
    }
  }, 30_000)

  it("ticks every condition and accommodation box with its own explanation text", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    for (const key of Object.keys(CONDITION_BOXES)) (p.accommodationConditions as Record<string, boolean>)[key] = true
    for (const key of Object.keys(ACCOMMODATION_BOXES)) (p.accommodations as Record<string, boolean>)[key] = true
    p.accommodationConditionOther = "Chronic pain"
    p.accommodationOther = "Quiet room"
    const { text, checks } = await fillRegion(a)
    for (const box of [...Object.values(CONDITION_BOXES), ...Object.values(ACCOMMODATION_BOXES)]) {
      expect(checks[box], box).toBe("On")
    }
    expect(text[CONDITION_OTHER]).toBe("Chronic pain")
    expect(text[ACCOMMODATION_OTHER]).toBe("Quiet room")
    expect(checks[ACCOMMODATION]).toBe("1")
  })

  it("writes each wages frequency to its own box and none for a one-time frequency", async () => {
    const a = completeRichHousehold()
    const wages = person(a).income[0]
    for (const [frequency, box] of Object.entries(WAGES_BOXES)) {
      wages.frequency = frequency as Saca2IncomeItem["frequency"]
      const { checks } = await fillRegion(a)
      const boxes = Object.values(WAGES_BOXES).filter((f) => checks[f] === "On")
      expect(boxes, frequency).toEqual([box])
    }
    wages.frequency = "oneTime"
    const { checks } = await fillRegion(a)
    expect(Object.values(WAGES_BOXES).filter((f) => checks[f] !== undefined)).toEqual([])
  }, 30_000)

  it("writes the wages row's tax id, every month box, and 'No' for not seasonal", async () => {
    const a = completeRichHousehold()
    const wages = person(a).income[0]
    wages.employerFederalTaxId = "12-3456789"
    for (const key of Object.keys(MONTH_BOXES)) (wages as unknown as Record<string, boolean>)[`season${key[0].toUpperCase()}${key.slice(1)}`] = true
    let values = await fillRegion(a)
    expect(values.text[TAX_ID]).toBe("12-3456789")
    for (const box of Object.values(MONTH_BOXES)) expect(values.checks[box], box).toBe("On")

    wages.seasonal = "no"
    values = await fillRegion(a)
    expect(values.checks[SEASONAL]).toBe("2")
    expectEmpty(values, Object.values(MONTH_BOXES))
  })

  it("writes each other-income type on its own line with amount and 'How often?'", async () => {
    const a = completeRichHousehold()
    const frequencies: Saca2IncomeItem["frequency"][] = ["weekly", "every2weeks", "twiceMonthly", "monthly", "quarterly", "yearly", "oneTime"]
    const kinds = Object.keys(LINES) as Array<keyof typeof LINES>
    person(a).income = kinds.map((kind, i) => row({ kind, amount: 100 + i, frequency: frequencies[i % frequencies.length] }))
    const income = person(a).income
    income.find((r) => r.kind === "pension")!.description = "Union pension"
    income.find((r) => r.kind === "otherTaxable")!.description = "Jury duty pay"
    income.find((r) => r.kind === "alimony")!.preTcjaAmount = 450.5
    const labels = ["Weekly", "Every 2 weeks", "Twice a month", "Monthly", "Quarterly", "Yearly", "One time only"]
    const { text, checks } = await fillRegion(a)
    kinds.forEach((kind, i) => {
      const [box, amount, often] = LINES[kind]
      expect(checks[box], kind).toBe("On")
      expect(text[amount], kind).toBe(String(100 + i))
      expect(text[often], kind).toBe(labels[i % labels.length])
    })
    expect(text[PENSION_SOURCE]).toBe("Union pension")
    expect(text[OTHER_TYPE]).toBe("Jury duty pay")
    expect(text[ALIMONY_PRE_2019]).toBe("450.50")
    // no wages, self-employment, capital gains or lottery rows: those blocks stay blank
    expectEmpty({ text, checks }, [EMPLOYER, WAGES, ...Object.values(WAGES_BOXES), SE_WORK, CG_BOX, LOTTERY_BOX, ...Object.values(LOTTERY_BOXES)])
    expect(checks[SELF_EMPLOYED]).toBe("2") // income, but no self-employment row
  })

  it("puts monthly-net kinds into profit or loss and never writes a frequency for them", async () => {
    const a = completeRichHousehold()
    person(a).income = [
      row({ kind: "selfEmployment", amount: 650, isLoss: true, hoursPerWeek: 12, description: "Landscaping", frequency: "monthly" }),
      row({ kind: "capitalGains", amount: 75, isLoss: true, frequency: "yearly" }),
      row({ kind: "farmingFishing", amount: 220, isLoss: false, hoursPerWeek: 20, frequency: "weekly" }),
    ]
    let { text, checks } = await fillRegion(a)
    expect(text[SE_LOSS]).toBe("650")
    expect(text).not.toHaveProperty([SE_PROFIT])
    expect(text[SE_WORK]).toBe("Landscaping")
    expect(text[SE_HOURS]).toBe("12")
    expect(text[CG_LOSS]).toBe("75")
    expect(text).not.toHaveProperty([CG_PROFIT])
    expect(text[FARM_PROFIT]).toBe("220")
    expect(text).not.toHaveProperty([FARM_LOSS])
    expect(text[FARM_HOURS]).toBe("20")
    expect(checks[CG_BOX]).toBe("On")
    expect(checks[FARM_BOX]).toBe("On")
    expectEmpty({ text, checks }, [
      ...Object.values(WAGES_BOXES),
      ...Object.values(LOTTERY_BOXES),
      ...Object.values(LINES).map((line) => line[2]),
    ])

    person(a).income[0].isLoss = false
    person(a).income[1].isLoss = false
    person(a).income[2].isLoss = true
    ;({ text, checks } = await fillRegion(a))
    expect(text[SE_PROFIT]).toBe("650")
    expect(text).not.toHaveProperty([SE_LOSS])
    expect(text[CG_PROFIT]).toBe("75")
    expect(text[FARM_LOSS]).toBe("220")
  })

  it("writes lottery winnings with its own How-often boxes (no quarterly box)", async () => {
    const a = completeRichHousehold()
    person(a).income = [row({ kind: "lottery", amount: 5000, effectiveDate: "2026-09-01", frequency: "oneTime" })]
    let { text, checks } = await fillRegion(a)
    expect(text[LOTTERY_AMOUNT]).toBe("5000")
    expect(text[LOTTERY_DATE]).toBe("09/01/2026")
    expect(checks[LOTTERY_BOX]).toBe("On")
    for (const [frequency, box] of Object.entries(LOTTERY_BOXES)) {
      person(a).income[0].frequency = frequency as Saca2IncomeItem["frequency"]
      ;({ checks } = await fillRegion(a))
      expect(Object.values(LOTTERY_BOXES).filter((f) => checks[f] === "On"), frequency).toEqual([box])
    }
    person(a).income[0].frequency = "quarterly"
    ;({ checks } = await fillRegion(a))
    expectEmpty({ text, checks }, Object.values(LOTTERY_BOXES))
  }, 30_000)

  it("places a rental loss in the loss blank, covers every real-estate type, and 'Other' text", async () => {
    const a = completeRichHousehold()
    person(a).rental.units = [
      { address: "5 A St", unit: "", amount: 300, isLoss: true, ownerOccupied: "yes" },
      { address: "7 B St", unit: "2B", amount: 800, isLoss: false, ownerOccupied: "no" },
    ]
    person(a).rental.paysHeatOrUtilities = "yes"
    let { text, checks } = await fillRegion(a)
    expect(text[UNIT_1.loss]).toBe("300")
    expect(text).not.toHaveProperty([UNIT_1.income])
    expect(text[UNIT_2.income]).toBe("800")
    expect(text).not.toHaveProperty([UNIT_2.loss])
    expect(checks[UNIT_1.owner]).toBe("1")
    expect(checks[UNIT_2.owner]).toBe("2")
    expect(checks[HEAT]).toBe("1")

    for (const [type, box] of Object.entries(TYPE_BOXES)) {
      person(a).rental.realEstateType = type as Saca2Person["rental"]["realEstateType"]
      person(a).rental.realEstateTypeOther = "Duplex over a shop"
      ;({ text, checks } = await fillRegion(a))
      expect(Object.values(TYPE_BOXES).filter((f) => checks[f] === "On"), type).toEqual([box])
      if (type === "other") expect(text[TYPE_OTHER]).toBe("Duplex over a shop")
      else expect(text).not.toHaveProperty([TYPE_OTHER])
    }
  }, 30_000)

  it("writes next year's one-time income 'No' into its own box, and every deduction with its box", async () => {
    const a = completeRichHousehold()
    person(a).oneTimeIncome = { ...person(a).oneTimeIncome, nextYear: "no", nextYearItems: [] }
    person(a).deductions = {
      none: false,
      amounts: Object.fromEntries(DEDUCTION_KEYS.map((key, i) => [key, 100 + i])) as Saca2Person["deductions"]["amounts"],
    }
    person(a).expectedIncomeNextYear = 70000.5
    const { text, checks } = await fillRegion(a)
    expect(checks[NEXT_NO]).toBe("2")
    expect(checks).not.toHaveProperty([NEXT_YES])
    DEDUCTION_KEYS.forEach((key, i) => {
      const [box, amount] = DEDUCTIONS[key]
      expect(checks[box], key).toBe("On")
      expect(text[amount], key).toBe(String(100 + i))
    })
    expect(checks).not.toHaveProperty([DEDUCTION_NONE])
    expect(text[INCOME_NEXT]).toBe("70000.50")
  })

  it("a $0 deduction is no deduction: neither the box nor a '0' is written; a blank amount likewise", async () => {
    const a = completeRichHousehold()
    person(a).deductions = {
      none: false,
      amounts: { ...person(a).deductions.amounts, hsa: 0, ira: 2500, educator: null },
    }
    const { text, checks } = await fillRegion(a)
    const [hsaBox, hsaAmount] = DEDUCTIONS.hsa
    expect(checks).not.toHaveProperty([hsaBox])
    expect(text).not.toHaveProperty([hsaAmount])
    const [educatorBox, educatorAmount] = DEDUCTIONS.educator
    expect(checks).not.toHaveProperty([educatorBox])
    expect(text).not.toHaveProperty([educatorAmount])
    // an amount that was given is written with its box, as before
    expect(checks[DEDUCTIONS.ira[0]]).toBe("On")
    expect(text[DEDUCTIONS.ira[1]]).toBe("2500")
  })

  it("ticks 'None' and writes no deduction when none is claimed", async () => {
    const a = completeRichHousehold()
    person(a).deductions = { ...person(a).deductions, none: true }
    const { text, checks } = await fillRegion(a)
    expect(checks[DEDUCTION_NONE]).toBe("On")
    expectEmpty({ text, checks }, Object.values(DEDUCTIONS).flat())
  })

  it("a not-applying person is only asked the accommodation, income and next-year one-time questions", async () => {
    const a = completeFacilityCouple()
    const p = person(a)
    p.applyingForCoverage = "no"
    p.needsAccommodation = "yes"
    p.accommodationConditions.blind = true
    p.accommodations.braille = true
    p.hasIncome = "yes"
    p.income = [row({ kind: "pension", amount: 900, frequency: "monthly", description: "Union pension" })]
    p.expectedIncomeThisYear = 10800
    p.deductions = { ...p.deductions, none: true }
    const { text, checks } = await fillRegion(a)
    expect(checks[ACCOMMODATION]).toBe("1")
    expect(checks[CONDITION_BOXES.blind]).toBe("On")
    expect(checks[ACCOMMODATION_BOXES.braille]).toBe("On")
    expect(checks[HAS_INCOME]).toBe("1")
    expect(text[LINES.pension[1]]).toBe("900")
    expect(text[INCOME_THIS]).toBe("10800")
    expect(checks[DEDUCTION_NONE]).toBe("On")
    expectEmpty({ text, checks }, [CITIZEN, RESIDENT, PREGNANT, FOSTER, RENT, DISABILITY, SSI, ABUSE])
  })
})

describe("stale answers never reach Person 1's pages 4-6", () => {
  it("usCitizenOrNational 'yes' leaves stale immigration answers off the form", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    p.usCitizenOrNational = "yes"
    p.naturalizedCitizen = "no"
    p.alienNumber = SENTINEL
    p.citizenshipCertificateNumber = SENTINEL
    Object.assign(p, {
      hasEligibleImmigrationStatus: "yes",
      immigrationOtherName: SENTINEL,
      immigrationSameName: "no",
      immigrationDocumentId: SENTINEL,
      immigrationCountry: SENTINEL,
    })
    const values = await fillRegion(a)
    expectEmpty(values, [...IMMIGRATION_TEXT, ...IMMIGRATION_CHECKS, "Alien number", "Naturalization or citizenship certificate number"])
    expectNoSentinel(values)
    expect(values.checks[CITIZEN]).toBe("1")
    expect(values.checks[NATURALIZED]).toBe("2")

    // naturalized: the citizen identifiers appear, the immigration block still does not
    p.naturalizedCitizen = "yes"
    p.alienNumber = "A55"
    const naturalized = await fillRegion(a)
    expect(naturalized.text["Alien number"]).toBe("A55")
    expectEmpty(naturalized, [...IMMIGRATION_TEXT, ...IMMIGRATION_CHECKS])
  })

  it("noncitizen with no eligible status leaves the status and document lines off the form", async () => {
    const a = completeRichHousehold()
    person(a).hasEligibleImmigrationStatus = "no"
    const values = await fillRegion(a)
    expect(values.checks[ELIGIBLE]).toBe("2")
    expectEmpty(values, [
      "Status award date mmddyyyy",
      "Immigration status",
      "Immigration document type",
      "Document ID number",
      "Passport or document expiration date mmddyyyy",
      "Country",
      LPR,
      HAS_DOC,
    ])
    // the remaining noncitizen questions are still asked
    expect(values.checks[SAME_NAME]).toBe("1")
    expect(values.checks[ARRIVED]).toBe("1")
  })

  it("hasIncome 'no' leaves every income block empty and ticks No", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    p.hasIncome = "no"
    p.income[0].employerNameAndAddress = SENTINEL
    p.income[1].description = SENTINEL
    p.income[2].description = SENTINEL
    p.rental.realEstateTypeOther = SENTINEL
    p.rental.units[0].address = SENTINEL
    p.oneTimeIncome.thisYearItems[0].type = SENTINEL
    p.deductions.amounts.hsa = 1500
    p.expectedIncomeNextYear = 99999
    const values = await fillRegion(a)
    expect(values.checks[HAS_INCOME]).toBe("2")
    expectNoSentinel(values)
    expectEmpty(values, [
      EMPLOYER,
      TAX_ID,
      WAGES,
      ...Object.values(WAGES_BOXES),
      EFFECTIVE,
      HOURS,
      SEASONAL,
      ...Object.values(MONTH_BOXES),
      SELF_EMPLOYED,
      SE_WORK,
      SE_PROFIT,
      SE_HOURS,
      ...Object.values(LINES).flat(),
      PENSION_SOURCE,
      CG_BOX,
      CG_PROFIT,
      LOTTERY_BOX,
      RENTAL,
      ...Object.values(TYPE_BOXES),
      UNIT_1.address,
      UNIT_1.income,
      UNIT_2.address,
      HEAT,
      ONE_TIME_THIS,
      ...Object.values(THIS_YEAR),
      INCOME_THIS,
      INCOME_NEXT,
    ])
    // next year's one-time income is asked whether or not the person has income
    expect(values.checks[NEXT_YES]).toBe("1")
    expect(values.text[NEXT_YEAR.type]).toBe("Lump-sum pension payment")
  })

  it("a row whose kind changed from wages to pension leaves the stale employer fields off the form", async () => {
    const a = completeRichHousehold()
    const first = person(a).income[0]
    first.kind = "pension"
    first.employerNameAndAddress = SENTINEL
    first.employerFederalTaxId = SENTINEL
    first.seasonal = "yes"
    first.seasonJun = true
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expectEmpty(values, [EMPLOYER, TAX_ID, WAGES, ...Object.values(WAGES_BOXES), EFFECTIVE, HOURS, SEASONAL, ...Object.values(MONTH_BOXES)])
    // the row is a pension now, and the first pension row fills the pension line
    expect(values.checks[LINES.pension[0]]).toBe("On")
    expect(values.text[LINES.pension[1]]).toBe("2000")
  })

  it("a row whose kind changed from self-employment to pension ignores the stale loss flag", async () => {
    const a = completeRichHousehold()
    person(a).income[1] = row({ kind: "pension", amount: 410, frequency: "yearly", isLoss: true })
    const values = await fillRegion(a)
    expect(values.text[LINES.pension[1]]).toBe("410") // the first pension row; its stale loss flag is not read
    expect(values.text[LINES.pension[2]]).toBe("Yearly")
    expectEmpty(values, [SE_WORK, SE_PROFIT, SE_LOSS, SE_HOURS])
    expect(values.checks[SELF_EMPLOYED]).toBe("2") // income, but no self-employment row any more
    expect(values.text[CG_PROFIT]).toBe("100")
  })

  it("seasonal 'no' leaves ticked months off the form", async () => {
    const a = completeRichHousehold()
    person(a).income[0].seasonal = "no"
    person(a).income[0].seasonMar = true
    const values = await fillRegion(a)
    expect(values.checks[SEASONAL]).toBe("2")
    expectEmpty(values, Object.values(MONTH_BOXES))
  })

  it("deductions.none true leaves stale amounts and boxes off the form", async () => {
    const a = completeRichHousehold()
    person(a).deductions.none = true
    person(a).deductions.amounts.ira = 4000
    const values = await fillRegion(a)
    expect(values.checks[DEDUCTION_NONE]).toBe("On")
    expectEmpty(values, Object.values(DEDUCTIONS).flat())
  })

  it("pregnant 'no' leaves the baby count and due date off the form", async () => {
    const a = completeRichHousehold()
    person(a).pregnant = "no"
    person(a).babiesExpected = 2
    person(a).dueDate = "2027-02-02"
    const values = await fillRegion(a)
    expect(values.checks[PREGNANT]).toBe("2")
    expectEmpty(values, [BABIES, DUE])
  })

  it("foster care 'no', caregiver 'no' and SSI 'no' leave their follow-ups off the form", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    p.everInFosterCare = "no"
    p.fosterCareState = "RI"
    p.fosterCareMedicaid = "yes"
    p.caregiverOfChildUnder19 = "no"
    p.caregiverChildren = [{ name: SENTINEL, dateOfBirth: "2015-09-09" }]
    p.everGotSsi = "no"
    p.lastSsiMonth = "01/2020"
    p.livingArrangement = "alone"
    const values = await fillRegion(a)
    expect(values.checks[FOSTER]).toBe("2")
    expect(values.checks[CAREGIVER]).toBe("2")
    expect(values.checks[SSI]).toBe("2")
    expectEmpty(values, [FOSTER_STATE, FOSTER_MEDICAID, CHILDREN, SSI_MONTH, LIVING])
    expectNoSentinel(values)
  })

  it("needsAccommodation 'no' leaves ticked boxes and explanations off the form", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    p.needsAccommodation = "no"
    p.accommodationConditions.other = true
    p.accommodationConditionOther = SENTINEL
    p.accommodations.other = true
    p.accommodationOther = SENTINEL
    const values = await fillRegion(a)
    expect(values.checks[ACCOMMODATION]).toBe("2")
    expectEmpty(values, [
      ...Object.values(CONDITION_BOXES),
      ...Object.values(ACCOMMODATION_BOXES),
      CONDITION_OTHER,
      ACCOMMODATION_OTHER,
    ])
    expectNoSentinel(values)
  })

  it("rental and one-time 'no' answers leave stale units and payments off the form", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    p.rental.hasRentalIncome = "no"
    p.rental.units[0].address = SENTINEL
    p.oneTimeIncome.thisYear = "no"
    p.oneTimeIncome.thisYearItems[0].type = SENTINEL
    p.oneTimeIncome.nextYear = "no"
    p.oneTimeIncome.nextYearItems[0].type = SENTINEL
    const values = await fillRegion(a)
    expect(values.checks[RENTAL]).toBe("2")
    expect(values.checks[ONE_TIME_THIS]).toBe("2")
    expect(values.checks[NEXT_NO]).toBe("2")
    expectEmpty(values, [
      ...Object.values(TYPE_BOXES),
      TYPE_OTHER,
      ...Object.values(UNIT_1),
      ...Object.values(UNIT_2),
      HEAT,
      ...Object.values(THIS_YEAR),
      ...Object.values(NEXT_YEAR),
    ])
    expectNoSentinel(values)
  })

  it("applying 'no' leaves the applicant-only answers off the form but keeps the income answers", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    p.applyingForCoverage = "no"
    p.pregnant = "yes"
    p.fosterCareState = SENTINEL
    p.rentOrOwn = "own"
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expectEmpty(values, [CITIZEN, ELIGIBLE, ...IMMIGRATION_TEXT, RESIDENT, CAREGIVER, PREGNANT, BABIES, FOSTER, FOSTER_STATE, RENT, DISABILITY, SSI, ABUSE])
    expect(values.checks[HAS_INCOME]).toBe("1")
    expect(values.text[WAGES]).toBe("2000")
    expect(values.checks[ACCOMMODATION]).toBe("1")
  })

  it("tax filer details stay off the form unless the person is claimed as a dependent", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    p.tax = {
      ...p.tax,
      claimedAsDependent: "no",
      taxFiler: { ...p.tax.taxFiler, dateOfBirth: "1960-04-05", relationship: SENTINEL, marriedFilingJointly: "yes", spouseName: SENTINEL, otherDependents: SENTINEL },
    }
    const values = await fillRegion(a)
    expectEmpty(values, [FILER_DOB, FILER_RELATION, FILER_JOINT, FILER_SPOUSE, FILER_OTHER])
    expectNoSentinel(values)
  })
})

describe("rows beyond what the form's blocks hold (overflow sheets come later)", () => {
  it("fills the job table from the first wages row only", async () => {
    const a = completeRichHousehold()
    person(a).income.push(
      row({
        kind: "wages",
        amount: 999,
        frequency: "weekly",
        employerNameAndAddress: SENTINEL,
        hoursPerWeek: 5,
        effectiveDate: "2026-03-03",
        seasonal: "no",
      }),
    )
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expect(values.text[EMPLOYER]).toBe("Acme, 9 Work Rd, Testville MA")
    expect(values.text[WAGES]).toBe("2000")
    expect(values.checks[WAGES_BOXES.monthly]).toBe("On")
    expect(values.checks).not.toHaveProperty([WAGES_BOXES.weekly])
    expect(values.checks[SEASONAL]).toBe("1")
  })

  it("fills the first row of any other kind, the first two rental units and the first payment of each year", async () => {
    const a = completeRichHousehold()
    const p = person(a)
    p.income.push(row({ kind: "pension", amount: 111, frequency: "weekly", description: SENTINEL }))
    p.rental.units.push({ address: SENTINEL, unit: "3", amount: 50, isLoss: false, ownerOccupied: "no" })
    p.oneTimeIncome.thisYearItems.push({ type: SENTINEL, amount: 1, month: 4, year: 2026 })
    p.oneTimeIncome.nextYearItems.push({ type: SENTINEL, amount: 1, month: 5, year: 2027 })
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expect(values.text[LINES.pension[1]]).toBe("300")
    expect(values.text[LINES.pension[2]]).toBe("Monthly")
    expect(values.text[THIS_YEAR.type]).toBe("Insurance settlement")
    expect(values.text[NEXT_YEAR.type]).toBe("Lump-sum pension payment")
    expect(values.text[UNIT_2.unit]).toBe("2")
  })
})
