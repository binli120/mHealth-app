/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it, vi } from "vitest"

import { completeFacilityCouple, completeRichHousehold } from "../../__tests__/complete-answers"
import { emptySaca2Person, type Saca2Answers, type Saca2IncomeItem, type Saca2Person } from "../../types"
import { isCheckboxEncoder } from "../encoders"
import { PERSON_TABLE, expandPersonTable } from "../field-map/person-table"
import { FIELD_MAP } from "../field-map"
import { getFieldInfo, getInventory } from "../inventory"
import { NEVER_FILL } from "../never-fill"
import { fillSaca2Pdf } from "../pdf-fill"
import { computeUnmappedFields } from "../unmapped"
import { readFilled, type FilledValues } from "./helpers/read-filled"

// each fill loads the 1.7 MB template; the sweeps fill several times
vi.setConfig({ testTimeout: 60_000 })

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"

const columnFields = (column: "p1" | "p2") => new Set(PERSON_TABLE.flatMap((row) => row[column]?.fields ?? []))
/** Every field a Person 2 column writes (form pages 7-11 and the yearly income on page 12). */
const P2_FIELDS = columnFields("p2")
const P1_FIELDS = columnFields("p1")

// Questions 1-14 (form pages 7; PDF index 8)
const NAME = "1 First name middle name last name and suffix_P2"
const DOB = "2 Date of birth mmddyy_P2"
const SEX = "3. What was this person’s sex assigned at birth?_P2"
const RELATIONSHIP = "4 Relationship to Person 1_P2"
const LIVES_WITH = "5 Does this person live with Person 1?_P2"
const STREET_LINE = "5 Provide street address_P2"
const NO_STREET = "No street address Note if you check this box you must provide a mailing address_P2"
const INSTITUTION = "6. Is this a hospital, nursing facility, or other institution?_P2"
const FACILITY = "6. If Yes, facility name_P2"
const MAILING_SAME = "7 Check if same as street address_P2"
const MAILING = "P2.7 Mailing address Check if same as street address"
const MAILING_APT = "8 Apartment or unit number_P2"
const MAILING_CITY = "9 City_P2"
const MAILING_STATE = "10 State_P2"
const MAILING_ZIP = "11 ZIP code_P2"
const SPOKEN = "13 What is this persons preferred Spoken language if not English_P2"
const WRITTEN = "13 What is this persons preferred Written language if not English_P2"
const APPLYING = "14. Is this person applying for health or dental coverage?_P2"

// Q15-19 demographics
const GENDER = {
  male: "Male_P2",
  female: "Female _P2",
  transMan: "Transgender mantrans man_P2",
  transWoman: "Transgender womantrans woman_P2",
  nonbinary: "Genderqueergender nonconformingnonbinary neither exclusively male nor female_P2",
  notListed: "Gender identity is not listed here_P2",
  dontKnow: "Dont know _P2",
  declined: "Choose not to answer_P2",
}
const GENDER_OTHER = "Please specify here if gender identity is not listed_P2"
const ORIENTATION = {
  straight: "Straight or Heterosexual_P2",
  gayOrLesbian: "Lesbian or Gay_P2",
  bisexual: "Bisexual_P2",
  queerPansexual: "Queer pansexual or questioning_P2",
  notListed: "Sexual Orientation is not listed_P2",
  dontKnow: "Dont know _P2_16",
  declined: "Choose not to answer_P2_16",
}
const ORIENTATION_OTHER = "Please specify if Sexual Orientation is not listed_P2"
const HISPANIC = "17. Is this person of Hispanic or Latino origin or descent?"
const RACE = "18 Race_P2"
const ETHNICITY = "19 Ethnicity_P2"

// Q20-21 SSN and tax
const HAS_SSN = "20. Does this person have a social security number (SSN)?_P2"
const SSN_BOXES = Array.from({ length: 9 }, (_, i) => `P2 SSN${i + 1}`)
const NO_SSN_REASON = "If No, check one of the following reasons_P2"
const SSN_CARD_MATCH = "Is the name on this application the same as the name on their social security card?_P2"
const SSN_CARD_NAME = "Is the name on this application the same as the name on their social security card "
const AGREES = "21. If this person gets an Advance Premium Tax Credit (APTC)_P2"
const MARRIED = "21a. Is this person legally married?_P2"
const SPOUSE = "21a. If Yes, list name of spouse and date of birth_P2"
const JOINT = "21b. Does this person plan to file a joint federal tax return with a spouse for the tax year for which this person is applying?_P2"
const CLAIMS =
  "21c. Will this person claim any dependents on this person’s federal income tax return for the year for which this person is applying?_P2"
const DEPENDENTS = "21c. List names and dates of birth of dependents_P2"
const CLAIMED =
  "21d. Will this person be claimed as a dependent on someone else's federal income tax return for the year for which this person is applying?_P2"
const FILER_NAME = "21d. If Yes, please list the name of the tax filer._P2"
const FILER_DOB = "21d. Tax filer date of birth"
const FILER_RELATION = "21d. How is this person related to the tax filer_P2"
const FILER_JOINT = "21d. Is the tax filer married, filing a joint return?_P2"
const FILER_SPOUSE = "21d. If Yes, list name of spouse and date of birth._P2"
const FILER_OTHER = "21d. Who else does the tax filer claim as dependents?_P2"
const ABUSE = "21e. Is this person filing taxes separately because they are a victim of domestic abuse or abandonment?_P2"

// Q22-23 citizenship and immigration
const CITIZEN = "22. Is this person a U.S. citizen or U.S. national?_P2"
const NATURALIZED = "22. If Yes, are they a naturalized, derived, or acquired citizen (not born in the U.S.)?"
const ALIEN_CITIZEN = "22 Alien number_P2"
const CERTIFICATE = "22 Naturalization or citizenship certificate number_P2"
const ELIGIBLE = "23.  If this person is a noncitizen, do they have an eligible immigration status?"
const LPR = "23a. Is this person a Lawful Permanent Resident?"
const HAS_DOC = "23b. Does this person have an immigration document?"
const SAME_NAME = "23c. Did this person use the same name on this application to get their immigration status?"
const ARRIVED = "23d. Did this person arrive in the U.S. after August 22, 1996?"
const VETERAN = "23e. Is this person an honorably discharged veteran?"
const IMMIGRATION_TEXT = {
  date: "Status award date mmddyyyy_P2",
  status: "Immigration status_P2",
  docType: "Immigration document type_P2",
  docId: "Document ID number_P2",
  expiry: "Passport or document expiration date mmddyyyy_P2",
  country: "Country_P2",
  otherName: "If No what name did this person use First middle last and suffix",
}
const IMMIGRATION_CHECKS = [ELIGIBLE, LPR, HAS_DOC, SAME_NAME, ARRIVED, VETERAN]

// Q24-30
const RESIDENT = "24. Is this person living in Massachusetts?"
const CAREGIVER = "25. Does this person live with at least one child?"
const CHILDREN = "Namess and dates of birth of children_P2"
const PREGNANT = "26. Is this person pregnant?"
const BABIES = "If Yes how many babies are they expecting"
const DUE = "What is the expected due date_2"
const FOSTER = "27. Was this person ever in foster care?"
const FOSTER_STATE = "If Yes in what state was this person in foster care?_P2"
const FOSTER_MEDICAID = "Was this person getting health care through a state Medicaid program?"
const RENT = "28. Does this person rent or own their property?"
const DISABILITY = "29. Does this person have a disability?"
const ACCOMMODATION = "30. Does this person need reasonable accommodation(s) because of a disability or injury?"
const CONDITION_BOXES = {
  lowVision: "Low vision_P2",
  blind: "Blind_P2",
  deaf: "Deaf_P2",
  hardOfHearing: "Hard of hearing_P2",
  developmentallyDisabled: "Developmentally disabled_P2",
  intellectuallyDisabled: "Intellectually disabled_P2",
  physicallyDisabled: "Physically disabled_P2",
  other: "30. Other_P2",
}
const ACCOMMODATION_BOXES = {
  tty: "Text telephone TTY_P2",
  largePrint: "Largeprint publications_P2",
  asl: "American Sign Language interpreter_P2",
  videoRelay: "Video Relay Service_P2",
  cart: "Communication Access Realtime Translations CART_P2",
  braille: "Publications in braille_P2",
  assistiveListening: "Assistive listening device_P2",
  electronicFormat: "Publications in electronic format_P2",
  other: "30b. Other_P2",
}
const CONDITION_OTHER = "30a Other Please explain_P2"
const ACCOMMODATION_OTHER = "30b Other Please explain_P2"

// Q31-37
const SSI = "31. Did this person ever get Supplemental Security Income (SSI)?"
const SSI_MONTH = "31a. When did this person last get SSI mmyyyy"
const LIVING = "31b. Does the person live alone, with a spouse, at rest home or someone else's home?"
const HAS_INCOME = "32. Does this person have any income?"
const EMPLOYER = "33. Employer name and address_P2"
const TAX_ID = "Federal Tax ID_P2"
const WAGES = "34a.  Wagestips before taxes"
const WAGES_BOXES = {
  weekly: "34a. Weekly_3",
  every2weeks: "34a. Every 2 weeks_2",
  twiceMonthly: "34a. Twice a month_3",
  monthly: "34a. Monthly_3",
  quarterly: "34a. Quarterly_2",
  yearly: "34a. Yearly Subtract any pretax deductions such as nontaxable health insurance premiums_2",
}
const EFFECTIVE = "34b.  Income effective date_2"
const HOURS = "35. Average number of hours worked each WEEK"
const SEASONAL = "36. Is this person seasonally employed?"
const MONTH_BOXES = {
  jan: "Jan_2",
  feb: "Feb_2",
  mar: "March_2",
  apr: "April_2",
  may: "May_2",
  jun: "June_2",
  jul: "July_2",
  aug: "August_2",
  sep: "Sept_2",
  oct: "Oct_2",
  nov: "Nov_2",
  dec: "Dec_2",
}
const SELF_EMPLOYED = "37. Is this person self-employed?"
const SE_WORK = "37a. If Yes what type of work does this person do"
const SE_PROFIT = "37b. each month profit"
const SE_LOSS = "37b. each month loss"
const SE_HOURS = "37c. How many hours does this person work per week"

// Q38 other income lines: [box, amount, how often]
const LINES = {
  socialSecurity: ["38. Social Security benefits_P2", "38.  Social Security benefits_2_P2", "38. Social Security benefits How often_P2"],
  pension: ["38. Retirement or Pension_P2", "38. Retirement or Pension_2_P2", "38. Retirement or Pension How often__P2"],
  annuity: ["38. Annuities_P2", "38. Annuities_2_P2", "38. AnnuitiesHow often_P2"],
  trust: ["38. Trusts_P2", "38. Trusts_2_P2", "38. Trusts How often_P2"],
  unemployment: ["38. Unemployment_P2", "38. Unemployment_2_P2", "38. Unemployment How often_P2"],
  investment: [
    "38.  Interest dividends and other investment income_P2",
    "38. Interest dividends and other investment income_2_P2",
    "38. Interest dividends and other investment income How often_P2",
  ],
  royalty: ["38. Royalty income_P2", "38. Royalty income_2_P2", "38. Royalty income_How often_P2"],
  alimony: ["38. Alimony received_2_P2", "38. Alimony received   $_P2", "38. Alimony received   How often_P2"],
  veterans: ["38. Federal veterans benefits_2_P2", "38. Federal veteran’s benefits   $_P2", "38. Federal veteran’s benefits How often_P2"],
  militaryRetirement: ["38. Military retirement pay_2_P2", "38. Military retirement pay   $_P2", "38. Military retirement pay How often_P2"],
  otherTaxable: ["38. Other taxable income include type_2_P2", "38. Other taxable income $_P2", "38. Other taxable income How often_2_P2"],
} as const
const PENSION_SOURCE = "38. Retirement or Source__P2"
const ALIMONY_PRE_2019 = "38. January 1 2019 enter the amount of those payments here_P2"
const OTHER_TYPE = "38. Other taxable income Type_2_P2"
const CG_BOX = "38. Capital gains On average how much net income or loss will this person get from this capital gain each month_P2"
const CG_PROFIT = "38. Capital gains profit $_P2"
const CG_LOSS = "38. Capital gains loss $_P2"
const FARM_BOX = "38. Net farming or fishing income_2_P2"
const FARM_PROFIT = "38. Net farming or fishing income profit_P2"
const FARM_LOSS = "38. Net farming or fishing income loss_P2"
const FARM_HOURS = "38. Net farming or fishing How many hours each week_P2"
const LOTTERY_BOX = "38. Lottery and Gambling Winnings_2_P2"
const LOTTERY_AMOUNT = "38. Lottery and Gambling Winnings $_P2"
const LOTTERY_DATE = "38. Lottery and Gambling Winnings Date_P2"
const LOTTERY_BOXES = {
  oneTime: "One time only_2",
  weekly: "Weekly_4",
  every2weeks: "Every two weeks_2",
  twiceMonthly: "Twice a month_4",
  monthly: "Monthly_4",
  yearly: "Yearly_2",
}

// Q39-41
const RENTAL = "39. Does this person get rental income?"
const TYPE_BOXES = { oneFamily: "39a. onefamily_2", twoFamily: "39a. twofamily_2", threeFamily: "39a. threefamily_2", other: "39a. other describe_2" }
const TYPE_OTHER = "39a. Describe other"
const UNIT_1 = {
  address: "39b. Address_P2",
  unit: "39b. Unit_P2",
  income: "39b. Amount of Income_3",
  loss: "39b. Amount of Loss_3",
  owner: "39b. Owner-occupied?",
}
const UNIT_2 = {
  address: "39b. Address_4",
  unit: "39b. Unit_4",
  income: "39b. Amount of Income_4",
  loss: "39b. Amount of Loss_4",
  owner: "39b. Owner-occupied?_2",
}
const HEAT = "39c. Does this person pay for heat or utilities for their tenant?"
const ONE_TIME_THIS = "40. Has or will this person receive income during this calendar year as a one-time only payment?"
const THIS_YEAR = { type: "40. If Yes  Type_3", amount: "40. Amount_3", month: "40. Month Received_3", year: "40. Year received_3" }
const ONE_TIME_NEXT = "41. Will this person receive income during the next calendar year as a one-time only payment?"
const NEXT_YEAR = { type: "41. If Yes  Type_4", amount: "41. Amount_4", month: "41. Month Received_4", year: "41. Year received_4" }

// Q42 deductions: [box, amount]; the amounts that were shared with Person 1's page are the `__p2` fields
const DEDUCTIONS = {
  educator: ["Educator expense Yearly amount_2", "Educator expense: Yearly amount $"],
  reservistExpenses: [
    "Certain business expenses of reservists performing artists or feebased government officials Yearly amount_2",
    "Certain business expenses yearly amont",
  ],
  hsa: ["Health Savings Account deduction Yearly amount_2", "Health Savings Account deduction: Yearly amount $__p2"],
  movingExpenses: [
    "Moving expenses for members of the Armed Forces Yearly amount_2",
    "Moving expenses for members of the Armed Forces: Yearly amount $__p2",
  ],
  selfEmploymentTax: ["Deductible part of selfemployment tax Yearly amount_2", "Deductible part of self-employment tax: Yearly amount $__p2"],
  selfEmployedRetirement: [
    "Contribution to selfemployed SEP SIMPLE and qualified plans Yearly amount_2",
    "Contribution to self-employed SEP, SIMPLE, and qualified plans: Yearly amount $__p2",
  ],
  selfEmployedHealthInsurance: [
    "Selfemployed health insurance deduction Yearly amount_2",
    "Self-employed health insurance deduction: Yearly amount $__p2",
  ],
  earlyWithdrawalPenalty: [
    "Penalty on early withdrawal of savings Yearly amount_2",
    "Penalty on early withdrawal of savings: Yearly amount $__p2",
  ],
  alimonyPaid: [
    "Alimony paid If this person paid alimony payments for a divorce separation agreement or court order that was finalized",
    "Alimony paid Yearly amount",
  ],
  ira: ["Individual Retirement Account IRA deduction Yearly amount_2", "Individual Retirement Account (IRA) deduction: Yearly amount $__p2"],
  studentLoanInterest: [
    "Student loan deduction interest only not total payment Yearly amount_2",
    "Student loan deduction (interest only, not total payment): Yearly amount $__p2",
  ],
} as const
const DEDUCTION_NONE = "None_2"
const INCOME_THIS = "43. What is your total expected income for the current calendar year?_P2"
const INCOME_NEXT = "44. What is your total expected income for next calendar year, if different?_P2"

// Person 1's counterparts of the amounts Person 2's deductions share the raw template with
const P1_HSA_AMOUNT = "Health Savings Account deduction: Yearly amount $"
const P1_STUDENT_AMOUNT = "Student loan deduction (interest only, not total payment): Yearly amount $"
const P1_IRA_AMOUNT = "Individual Retirement Account (IRA) deduction: Yearly amount $"

// The two form fields that mean nothing to the wizard (or that it cannot decide)
const UNRESOLVED_P2 = [
  "victim of severe trafficking_2",
  "a spouse child sibling or parent of a trafficking victim_2",
  "a battered spouse_2",
  "a child or the parent of battered spouse_2",
  "29. Name_P2",
]

function selectFields(values: FilledValues, fields: Set<string>): FilledValues {
  return {
    text: Object.fromEntries(Object.entries(values.text).filter(([name]) => fields.has(name))),
    checks: Object.fromEntries(Object.entries(values.checks).filter(([name, state]) => fields.has(name) && state !== null)),
  }
}

async function fillAll(answers: Saca2Answers): Promise<FilledValues> {
  return readFilled(await fillSaca2Pdf(answers, null, ON))
}

/** Fills with the real map and reads back only Person 2's mapped fields (checkboxes: only those selected). */
async function fillRegion(answers: Saca2Answers): Promise<FilledValues> {
  return selectFields(await fillAll(answers), P2_FIELDS)
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

const person2 = (a: Saca2Answers): Saca2Person => a.persons[1]
const person1 = (a: Saca2Answers): Saca2Person => a.persons[0]

const row = (item: Partial<Saca2IncomeItem> & Pick<Saca2IncomeItem, "kind">): Saca2IncomeItem => ({
  amount: null,
  frequency: null,
  ...item,
})

/** The rich household with Person 2 given an income, rental, one-time and deduction picture unlike Person 1's. */
function richWithPerson2Income(): Saca2Answers {
  const a = completeRichHousehold()
  const p = person2(a)
  p.hasIncome = "yes"
  p.income = [
    row({
      kind: "wages",
      amount: 700,
      frequency: "weekly",
      employerNameAndAddress: "Globex, 4 Dock St, Testville MA",
      employerFederalTaxId: "12-3456789",
      hoursPerWeek: 20,
      effectiveDate: "2026-02-01",
      seasonal: "no",
    }),
    row({ kind: "pension", amount: 450, frequency: "quarterly", description: "Union fund" }),
    row({ kind: "selfEmployment", amount: 120, isLoss: true, hoursPerWeek: 5, description: "Dog walking" }),
  ]
  p.rental = {
    ...p.rental,
    hasRentalIncome: "yes",
    realEstateType: "oneFamily",
    units: [{ address: "7 Tenant Way, Testville MA", unit: "A", amount: 700, isLoss: true, ownerOccupied: "yes" }],
    paysHeatOrUtilities: "yes",
  }
  p.oneTimeIncome = {
    thisYear: "yes",
    thisYearItems: [{ type: "Tax refund", amount: 800, month: 4, year: 2026 }],
    nextYear: "yes",
    nextYearItems: [{ type: "Bonus", amount: 1200, month: 12, year: 2027 }],
  }
  p.deductions = {
    none: false,
    amounts: { ...p.deductions.amounts, educator: 250, hsa: 900, ira: 400, alimonyPaid: 100, selfEmploymentTax: 50 },
  }
  p.expectedIncomeThisYear = 36400
  p.expectedIncomeNextYear = 40000
  return a
}

describe("Person 2 rows of the shared person table", () => {
  it("expands a Person 2 column into entries that read person 1 (the second person)", () => {
    const entries = expandPersonTable(PERSON_TABLE)
    const name = entries.find((e) => e.fields[0] === NAME)
    expect(name?.source).toEqual({ kind: "derived", id: "person.fullName", person: 1 })
    const dob = entries.find((e) => e.fields[0] === DOB)
    expect(dob?.source).toEqual({ kind: "answer", stepId: "person1", path: "dateOfBirth", person: 1 })
    const unit = entries.find((e) => e.fields[0] === UNIT_2.address)
    expect(unit?.source).toEqual({ kind: "row", stepId: "person1", path: "rental.units", index: 1, key: "address", person: 1 })
    // the Person 2-only rows read the person-2 content step
    const lives = entries.find((e) => e.fields[0] === LIVES_WITH)
    expect(lives?.source).toEqual({ kind: "answer", stepId: "person2", path: "livesWithPerson1", person: 1 })
  })

  it("maps Person 2's amounts to the split __p2 fields and gives every deduction its own box", () => {
    const entries = expandPersonTable(PERSON_TABLE).filter((e) => e.source.person === 1)
    const amounts = entries.filter((e) => e.source.kind === "answer" && e.source.path.startsWith("deductions.amounts."))
    expect(amounts).toHaveLength(11)
    expect(amounts.filter((e) => e.fields[0].endsWith("__p2"))).toHaveLength(8)
    for (const [box, amount] of Object.values(DEDUCTIONS)) {
      expect(P2_FIELDS.has(box)).toBe(true)
      expect(P2_FIELDS.has(amount)).toBe(true)
    }
  })

  it("uses Person 2's own on-states: Male is /On, SSI No is /On, next-year one-time is one Yes/No group", () => {
    const entries = expandPersonTable(PERSON_TABLE)
    const encode = (field: string) => entries.find((e) => e.fields[0] === field)!.encode
    expect(encode(SEX)).toEqual({ kind: "pick", states: { male: "On", female: "2" } })
    expect(encode(SSI)).toEqual({ kind: "yesNo", yes: "1", no: "On" })
    expect(encode(ONE_TIME_NEXT)).toEqual({ kind: "yesNo", yes: "1", no: "2" })
    expect(encode(WAGES_BOXES.monthly)).toEqual({ kind: "pick", states: { monthly: "On" } })
  })
})

describe("Person 2 pages: rich household (Pedro, citizen spouse, applying, no income)", () => {
  it("writes exactly the expected text and checkbox states", async () => {
    const { text, checks } = await fillRegion(completeRichHousehold())
    expect(text).toEqual({
      [NAME]: "Pedro Testcase",
      [DOB]: "02/02/1983",
      [RELATIONSHIP]: "spouse",
      // hasSsn yes, "123-45-6780"
      ...Object.fromEntries("123456780".split("").map((digit, i) => [SSN_BOXES[i], digit])),
    })
    expect(checks).toEqual({
      [SEX]: "On",
      [LIVES_WITH]: "1",
      [APPLYING]: "1",
      [INSTITUTION]: "2",
      [MAILING_SAME]: "On",
      [HAS_SSN]: "1",
      [SSN_CARD_MATCH]: "1",
      [AGREES]: "2",
      [CLAIMED]: "2",
      [ABUSE]: "2",
      [CITIZEN]: "1",
      [NATURALIZED]: "2",
      [RESIDENT]: "1",
      [CAREGIVER]: "2",
      [PREGNANT]: "2",
      [FOSTER]: "2",
      [RENT]: "1",
      [DISABILITY]: "2",
      [ACCOMMODATION]: "2",
      [SSI]: "On",
      [HAS_INCOME]: "2",
      [ONE_TIME_NEXT]: "2",
      [DEDUCTION_NONE]: "On",
    })
  })

  it("leaves the street line, immigration, income, rental and deduction blocks blank", async () => {
    const values = await fillRegion(completeRichHousehold())
    expectEmpty(values, [
      STREET_LINE,
      NO_STREET,
      FACILITY,
      MAILING,
      MARRIED,
      SPOUSE,
      JOINT,
      CLAIMS,
      DEPENDENTS,
      FILER_NAME,
      ...IMMIGRATION_CHECKS,
      ...Object.values(IMMIGRATION_TEXT),
      CHILDREN,
      BABIES,
      DUE,
      EMPLOYER,
      WAGES,
      ...Object.values(WAGES_BOXES),
      SELF_EMPLOYED,
      ...Object.values(LINES).flat(),
      ...Object.values(LOTTERY_BOXES),
      RENTAL,
      ...Object.values(TYPE_BOXES),
      ONE_TIME_THIS,
      ...Object.values(DEDUCTIONS).flat(),
      INCOME_THIS,
      INCOME_NEXT,
    ])
  })

  it("does not write Person 1's answers into Person 2's fields (or the other way around)", async () => {
    const all = await fillAll(completeRichHousehold())
    expect(all.text[NAME]).toBe("Pedro Testcase")
    expect(all.text["1 First name middle name last name and suffix"]).toBe("Maria Q Testcase")
    expect(all.checks[SEX]).toBe("On")
    expect(all.checks["3. What was your sex assigned at birth?"]).toBe("2")
    expect(all.checks["Female "]).toBe("On")
    expect(all.checks[GENDER.female]).toBeNull()
  })
})

describe("Person 2 pages: every answerable field", () => {
  it("writes home line, mailing address, languages and the demographic checks", async () => {
    const a = completeRichHousehold()
    const p = person2(a)
    p.livesWithPerson1 = "no"
    p.apartment = "2B"
    p.inInstitution = "yes"
    p.facilityName = "Example Hospital"
    p.mailingSameAsStreet = false
    p.mailingAddress = "PO Box 9"
    p.mailingApartment = "5"
    p.mailingCity = "Boxville"
    p.mailingState = "ma"
    p.mailingZip = "02102"
    p.preferredLanguageSpoken = "Portuguese"
    p.preferredLanguageWritten = "Portuguese"
    p.demographics.genderIdentity.male = true
    p.demographics.genderIdentity.notListed = true
    p.demographics.genderIdentityOther = "Fluid"
    p.demographics.sexualOrientation.bisexual = true
    p.demographics.sexualOrientation.notListed = true
    p.demographics.sexualOrientationOther = "Otherwise"
    p.demographics.hispanicOrLatino = "no"
    p.demographics.race.white = true
    p.demographics.ethnicity.brazilian = true
    const { text, checks } = await fillRegion(a)
    expect(text).toMatchObject({
      [STREET_LINE]: "1 Example St, 2B, Testville, MA 02101",
      [FACILITY]: "Example Hospital",
      [MAILING]: "PO Box 9",
      [MAILING_APT]: "5",
      [MAILING_CITY]: "Boxville",
      [MAILING_STATE]: "MA",
      [MAILING_ZIP]: "02102",
      [SPOKEN]: "Portuguese",
      [WRITTEN]: "Portuguese",
      [GENDER_OTHER]: "Fluid",
      [ORIENTATION_OTHER]: "Otherwise",
    })
    expect(text[RACE]).toContain("White")
    expect(text[ETHNICITY]).toContain("Brazilian")
    expect(checks).toMatchObject({
      [LIVES_WITH]: "2",
      [INSTITUTION]: "1",
      [GENDER.male]: "On",
      [GENDER.notListed]: "On",
      [ORIENTATION.bisexual]: "On",
      [ORIENTATION.notListed]: "On",
      [HISPANIC]: "2",
    })
    expectEmpty({ text, checks }, [MAILING_SAME, NO_STREET, GENDER.female, GENDER.transMan, GENDER.transWoman, GENDER.nonbinary, ORIENTATION.straight])
  })

  it("ticks each remaining gender and orientation box and every Hispanic origin state", async () => {
    const a = completeRichHousehold()
    const p = person2(a)
    p.demographics.genderIdentity = {
      ...p.demographics.genderIdentity,
      female: true,
      transMan: true,
      transWoman: true,
      nonbinary: true,
      dontKnow: true,
    }
    p.demographics.sexualOrientation = {
      ...p.demographics.sexualOrientation,
      straight: true,
      gayOrLesbian: true,
      queerPansexual: true,
      dontKnow: true,
    }
    const { checks } = await fillRegion(a)
    for (const key of ["female", "transMan", "transWoman", "nonbinary", "dontKnow"] as const) expect(checks[GENDER[key]], key).toBe("On")
    for (const key of ["straight", "gayOrLesbian", "queerPansexual", "dontKnow"] as const) expect(checks[ORIENTATION[key]], key).toBe("On")
    expectEmpty({ text: {}, checks }, [GENDER.male, GENDER.declined, ORIENTATION.declined, ORIENTATION.bisexual])
    for (const [state, expected] of [["yes", "1"], ["no", "2"], ["dontKnow", "3"], ["declined", "4"]] as const) {
      const b = completeRichHousehold()
      person2(b).demographics.hispanicOrLatino = state
      expect((await fillRegion(b)).checks[HISPANIC], state).toBe(expected)
    }
  })

  it("covers SSN reasons, the card name, the whole tax chain and the tax filer block", async () => {
    const a = completeRichHousehold()
    const p = person2(a)
    p.nameMatchesSsnCard = "no"
    p.ssnCardName = "Pedro Q Testcase"
    p.tax = {
      ...p.tax,
      agreesToFileIfAptc: "yes",
      spouseName: "Maria Testcase",
      spouseDateOfBirth: "1985-06-15",
      plansJointReturn: "yes",
      claimsDependents: "yes",
      dependents: [{ name: "Lucas Testcase", dateOfBirth: "2015-09-09" }],
      claimedAsDependent: "yes",
      taxFiler: {
        name: "Ana Filer",
        dateOfBirth: "1960-01-02",
        relationship: "aunt",
        marriedFilingJointly: "yes",
        spouseName: "Ben Filer",
        spouseDateOfBirth: "1958-03-04",
        otherDependents: "Cousin Carl",
      },
      filingSeparatelyAbuse: "yes",
    }
    const { text, checks } = await fillRegion(a)
    expect(text).toMatchObject({
      [SSN_CARD_NAME]: "Pedro Q Testcase",
      [SPOUSE]: "Maria Testcase, 06/15/1985",
      [DEPENDENTS]: "Lucas Testcase 09/09/2015",
      [FILER_NAME]: "Ana Filer",
      [FILER_DOB]: "01/02/1960",
      [FILER_RELATION]: "aunt",
      [FILER_SPOUSE]: "Ben Filer, 03/04/1958",
      [FILER_OTHER]: "Cousin Carl",
    })
    expect(checks).toMatchObject({
      [SSN_CARD_MATCH]: "2",
      [AGREES]: "1",
      [MARRIED]: "1",
      [JOINT]: "1",
      [CLAIMS]: "1",
      [CLAIMED]: "1",
      [FILER_JOINT]: "1",
      [ABUSE]: "1",
    })
    for (const [reason, state] of [["illness", "1"], ["justApplied", "2"], ["noncitizenException", "3"], ["religiousException", "4"]] as const) {
      const b = completeRichHousehold()
      person2(b).hasSsn = "no"
      person2(b).noSsnReason = reason
      const filled = await fillRegion(b)
      expect(filled.checks[NO_SSN_REASON], reason).toBe(state)
      expect(filled.checks[HAS_SSN], reason).toBe("2")
      for (const box of SSN_BOXES) expect(filled.text, box).not.toHaveProperty([box])
    }
  })

  it("writes citizenship identifiers and every immigration answer with the form's own checks", async () => {
    const naturalized = completeRichHousehold()
    person2(naturalized).naturalizedCitizen = "yes"
    person2(naturalized).alienNumber = "A123456789"
    person2(naturalized).citizenshipCertificateNumber = "C-777"
    const n = await fillRegion(naturalized)
    expect(n.checks[NATURALIZED]).toBe("1")
    expect(n.text[ALIEN_CITIZEN]).toBe("A123456789")
    expect(n.text[CERTIFICATE]).toBe("C-777")

    const a = completeRichHousehold()
    const p = person2(a)
    Object.assign(p, {
      usCitizenOrNational: "no",
      naturalizedCitizen: null,
      hasEligibleImmigrationStatus: "yes",
      immigrationStatus: "lawful-permanent-resident",
      immigrationDocumentType: "permanent-resident-card-green-card-i-551",
      immigrationDocumentId: "A000000002",
      immigrationDocumentExpiry: "2031-02-28",
      isLprCheCofa: "no",
      immigrationStatusDate: "2016-04-01",
      immigrationCountry: "Peru",
      immigrationSameName: "no",
      immigrationOtherName: "Pedro Q Otheruser",
      arrivedAfterAug1996: "no",
      isVeteranOrMilitaryFamily: "yes",
    })
    const { text, checks } = await fillRegion(a)
    expect(text).toMatchObject({
      [IMMIGRATION_TEXT.date]: "04/01/2016",
      [IMMIGRATION_TEXT.status]: "Lawful permanent resident",
      [IMMIGRATION_TEXT.docType]: "Permanent Resident Card (green card, I-551)",
      [IMMIGRATION_TEXT.docId]: "A000000002",
      [IMMIGRATION_TEXT.expiry]: "02/28/2031",
      [IMMIGRATION_TEXT.country]: "Peru",
      [IMMIGRATION_TEXT.otherName]: "Pedro Q Otheruser",
    })
    expect(checks).toMatchObject({
      [CITIZEN]: "2",
      [ELIGIBLE]: "1",
      [LPR]: "2",
      [HAS_DOC]: "1",
      [SAME_NAME]: "2",
      [ARRIVED]: "2",
      [VETERAN]: "1",
    })
    expectEmpty({ text, checks }, [NATURALIZED, ALIEN_CITIZEN, CERTIFICATE, ...UNRESOLVED_P2, "Alien number_P2"])
  })

  it("writes caregiver, pregnancy, foster care, disability, accommodation, SSI and living answers", async () => {
    const a = completeRichHousehold()
    const p = person2(a)
    Object.assign(p, {
      caregiverOfChildUnder19: "yes",
      caregiverChildren: [{ name: "Ines Testcase", dateOfBirth: "2018-08-08" }],
      pregnant: "yes",
      babiesExpected: 2,
      dueDate: "2027-03-04",
      everInFosterCare: "yes",
      fosterCareState: "ri",
      fosterCareMedicaid: "no",
      rentOrOwn: "own",
      hasDisability: "yes",
      needsAccommodation: "yes",
      accommodationOther: "Quiet room",
      accommodationConditionOther: "Migraine",
      everGotSsi: "yes",
      lastSsiMonth: "05/2024",
      livingArrangement: "withSpouse",
    })
    for (const key of Object.keys(CONDITION_BOXES)) p.accommodationConditions[key as keyof typeof p.accommodationConditions] = true
    for (const key of Object.keys(ACCOMMODATION_BOXES)) p.accommodations[key as keyof typeof p.accommodations] = true
    const { text, checks } = await fillRegion(a)
    expect(text).toMatchObject({
      [CHILDREN]: "Ines Testcase 08/08/2018",
      [BABIES]: "2",
      [DUE]: "03/04/2027",
      [FOSTER_STATE]: "RI",
      [CONDITION_OTHER]: "Migraine",
      [ACCOMMODATION_OTHER]: "Quiet room",
      [SSI_MONTH]: "05/2024",
    })
    expect(checks).toMatchObject({
      [CAREGIVER]: "1",
      [PREGNANT]: "1",
      [FOSTER]: "1",
      [FOSTER_MEDICAID]: "2",
      [RENT]: "2",
      [DISABILITY]: "1",
      [ACCOMMODATION]: "1",
      [SSI]: "1",
      [LIVING]: "2",
    })
    for (const box of [...Object.values(CONDITION_BOXES), ...Object.values(ACCOMMODATION_BOXES)]) expect(checks[box], box).toBe("On")
    for (const [value, state] of [["alone", "1"], ["withSpouse", "2"], ["restHome", "3"], ["someoneElsesHome", "4"]] as const) {
      const b = completeRichHousehold()
      Object.assign(person2(b), { everGotSsi: "yes", lastSsiMonth: "01/2020", livingArrangement: value })
      expect((await fillRegion(b)).checks[LIVING], value).toBe(state)
    }
  })

  it("never writes the unresolved boxes, the mailing county or the document alien number", async () => {
    const a = richWithPerson2Income()
    person2(a).county = "Suffolk"
    const values = await fillRegion(a)
    expectEmpty(values, [...UNRESOLVED_P2, "12 County_P2", "Alien number_P2"])
  })
})

describe("Person 2 income pages with Person 1's income in the same application", () => {
  it("writes Person 2's wages, pension, self-employment loss, rental, one-time payments and deductions exactly", async () => {
    const { text, checks } = await fillRegion(richWithPerson2Income())
    expect(text).toEqual({
      [NAME]: "Pedro Testcase",
      [DOB]: "02/02/1983",
      [RELATIONSHIP]: "spouse",
      ...Object.fromEntries("123456780".split("").map((digit, i) => [SSN_BOXES[i], digit])),
      [EMPLOYER]: "Globex, 4 Dock St, Testville MA",
      [TAX_ID]: "12-3456789",
      [WAGES]: "700",
      [EFFECTIVE]: "02/01/2026",
      [HOURS]: "20",
      [SE_WORK]: "Dog walking",
      [SE_LOSS]: "120",
      [SE_HOURS]: "5",
      [LINES.pension[1]]: "450",
      [LINES.pension[2]]: "Quarterly",
      [PENSION_SOURCE]: "Union fund",
      [UNIT_1.address]: "7 Tenant Way, Testville MA",
      [UNIT_1.unit]: "A",
      [UNIT_1.loss]: "700",
      [THIS_YEAR.type]: "Tax refund",
      [THIS_YEAR.amount]: "800",
      [THIS_YEAR.month]: "4",
      [THIS_YEAR.year]: "2026",
      [NEXT_YEAR.type]: "Bonus",
      [NEXT_YEAR.amount]: "1200",
      [NEXT_YEAR.month]: "12",
      [NEXT_YEAR.year]: "2027",
      [DEDUCTIONS.educator[1]]: "250",
      [DEDUCTIONS.hsa[1]]: "900",
      [DEDUCTIONS.selfEmploymentTax[1]]: "50",
      [DEDUCTIONS.alimonyPaid[1]]: "100",
      [DEDUCTIONS.ira[1]]: "400",
      [INCOME_THIS]: "36400",
      [INCOME_NEXT]: "40000",
    })
    expect(checks).toEqual({
      [SEX]: "On",
      [LIVES_WITH]: "1",
      [APPLYING]: "1",
      [INSTITUTION]: "2",
      [MAILING_SAME]: "On",
      [HAS_SSN]: "1",
      [SSN_CARD_MATCH]: "1",
      [AGREES]: "2",
      [CLAIMED]: "2",
      [ABUSE]: "2",
      [CITIZEN]: "1",
      [NATURALIZED]: "2",
      [RESIDENT]: "1",
      [CAREGIVER]: "2",
      [PREGNANT]: "2",
      [FOSTER]: "2",
      [RENT]: "1",
      [DISABILITY]: "2",
      [ACCOMMODATION]: "2",
      [SSI]: "On",
      [HAS_INCOME]: "1",
      [WAGES_BOXES.weekly]: "On",
      [SEASONAL]: "2",
      [SELF_EMPLOYED]: "1",
      [LINES.pension[0]]: "On",
      [RENTAL]: "1",
      [TYPE_BOXES.oneFamily]: "On",
      [UNIT_1.owner]: "1",
      [HEAT]: "1",
      [ONE_TIME_THIS]: "1",
      [ONE_TIME_NEXT]: "1",
      [DEDUCTIONS.educator[0]]: "On",
      [DEDUCTIONS.hsa[0]]: "On",
      [DEDUCTIONS.selfEmploymentTax[0]]: "On",
      [DEDUCTIONS.alimonyPaid[0]]: "On",
      [DEDUCTIONS.ira[0]]: "On",
    })
  })

  it("lands Person 1's and Person 2's values in different fields; neither overwrites the other", async () => {
    const all = await fillAll(richWithPerson2Income())
    const baseline = await fillAll(completeRichHousehold())
    // Person 1's side is exactly what it is without Person 2's income
    expect(selectFields(all, P1_FIELDS)).toEqual(selectFields(baseline, P1_FIELDS))
    // the two people's field sets share nothing, so each value sits in its own person's field
    expect([...P1_FIELDS].filter((name) => P2_FIELDS.has(name))).toEqual([])
    // the eight deduction amounts that used to be one shared field now hold each person's own value
    expect(all.text[P1_HSA_AMOUNT]).toBe("1500")
    expect(all.text[DEDUCTIONS.hsa[1]]).toBe("900")
    expect(all.text[P1_STUDENT_AMOUNT]).toBe("600")
    expect(all.text).not.toHaveProperty([DEDUCTIONS.studentLoanInterest[1]])
    expect(all.text).not.toHaveProperty([P1_IRA_AMOUNT])
    expect(all.text[DEDUCTIONS.ira[1]]).toBe("400")
    // wages: Person 1 Monthly 2000, Person 2 Weekly 700, in each person's own boxes and amounts
    expect(all.checks["Monthly"]).toBe("On")
    expect(all.checks[WAGES_BOXES.weekly]).toBe("On")
    expect(all.checks[WAGES_BOXES.monthly] ?? null).toBeNull()
    expect(all.text["24a.  Wagestips before taxes"]).toBe("2000")
    expect(all.text[WAGES]).toBe("700")
    // Person 1's self-employment is a profit, Person 2's a loss
    expect(all.text["or how much will you lose from this selfemployment each month"]).toBe("800")
    expect(all.text[SE_LOSS]).toBe("120")
    expect(all.text).not.toHaveProperty([SE_PROFIT])
  })

  it("writes a lottery winning, capital gains and farming profit on Person 2's own lines", async () => {
    const a = completeRichHousehold()
    const p = person2(a)
    p.hasIncome = "yes"
    p.income = [
      row({ kind: "lottery", amount: 5000, frequency: "weekly", effectiveDate: "2026-05-05" }),
      row({ kind: "capitalGains", amount: 90, isLoss: true }),
      row({ kind: "farmingFishing", amount: 60, hoursPerWeek: 8 }),
      row({ kind: "socialSecurity", amount: 1100, frequency: "monthly" }),
      row({ kind: "alimony", amount: 200, frequency: "yearly", preTcjaAmount: 75 }),
      row({ kind: "otherTaxable", amount: 30, frequency: "twiceMonthly", description: "Jury duty" }),
    ] as Saca2Person["income"]
    const { text, checks } = await fillRegion(a)
    expect(text).toMatchObject({
      [LOTTERY_AMOUNT]: "5000",
      [LOTTERY_DATE]: "05/05/2026",
      [CG_LOSS]: "90",
      [FARM_PROFIT]: "60",
      [FARM_HOURS]: "8",
      [LINES.socialSecurity[1]]: "1100",
      [LINES.socialSecurity[2]]: "Monthly",
      [LINES.alimony[1]]: "200",
      [LINES.alimony[2]]: "Yearly",
      [ALIMONY_PRE_2019]: "75",
      [LINES.otherTaxable[1]]: "30",
      [OTHER_TYPE]: "Jury duty",
    })
    expect(checks).toMatchObject({
      [LOTTERY_BOX]: "On",
      [LOTTERY_BOXES.weekly]: "On",
      [CG_BOX]: "On",
      [FARM_BOX]: "On",
      [LINES.socialSecurity[0]]: "On",
      [LINES.alimony[0]]: "On",
      [LINES.otherTaxable[0]]: "On",
    })
    expectEmpty({ text, checks }, [CG_PROFIT, FARM_LOSS, ...Object.values(LOTTERY_BOXES).filter((f) => f !== LOTTERY_BOXES.weekly)])
  })

  it("writes each wages frequency to its own box, the seasonal months and Person 2's second rental unit", async () => {
    for (const [frequency, box] of Object.entries(WAGES_BOXES)) {
      const a = completeRichHousehold()
      person2(a).hasIncome = "yes"
      person2(a).income = [row({ kind: "wages", amount: 100, frequency: frequency as Saca2IncomeItem["frequency"] })]
      const { checks } = await fillRegion(a)
      for (const [other, otherBox] of Object.entries(WAGES_BOXES)) {
        expect(checks[otherBox] ?? null, `${frequency} -> ${other}`).toBe(other === frequency ? "On" : null)
      }
      expect(box).toBeTruthy()
    }
    const a = completeRichHousehold()
    const p = person2(a)
    p.hasIncome = "yes"
    p.income = [
      row({
        kind: "wages",
        amount: 100,
        frequency: "monthly",
        seasonal: "yes",
        seasonJan: true,
        seasonFeb: true,
        seasonMar: true,
        seasonApr: true,
        seasonMay: true,
        seasonJun: true,
        seasonJul: true,
        seasonAug: true,
        seasonSep: true,
        seasonOct: true,
        seasonNov: true,
        seasonDec: true,
      }),
    ]
    p.rental = {
      ...p.rental,
      hasRentalIncome: "yes",
      realEstateType: "other",
      realEstateTypeOther: "Garage",
      units: [
        { address: "1 A St", unit: "1", amount: 300, isLoss: false, ownerOccupied: "no" },
        { address: "2 B St", unit: "2", amount: 50, isLoss: true, ownerOccupied: "yes" },
      ],
      paysHeatOrUtilities: "no",
    }
    const { text, checks } = await fillRegion(a)
    expect(checks[SEASONAL]).toBe("1")
    for (const box of Object.values(MONTH_BOXES)) expect(checks[box], box).toBe("On")
    expect(checks[TYPE_BOXES.other]).toBe("On")
    expect(text[TYPE_OTHER]).toBe("Garage")
    expect(text).toMatchObject({
      [UNIT_1.address]: "1 A St",
      [UNIT_1.income]: "300",
      [UNIT_2.address]: "2 B St",
      [UNIT_2.unit]: "2",
      [UNIT_2.loss]: "50",
    })
    expect(checks).toMatchObject({ [UNIT_1.owner]: "2", [UNIT_2.owner]: "1", [HEAT]: "2" })
    expectEmpty({ text, checks }, [UNIT_1.loss, UNIT_2.income])
  })
})

describe("Person 2 not applying (facility couple: Dorothy)", () => {
  it("fills only the questions the form asks of a person who is not applying", async () => {
    const { text, checks } = await fillRegion(completeFacilityCouple())
    expect(text).toEqual({
      [NAME]: "Dorothy Testcase",
      [DOB]: "02/11/1946",
      [RELATIONSHIP]: "spouse",
      [STREET_LINE]: "1 Example St, Testville, MA 02101",
    })
    expect(checks).toEqual({
      [SEX]: "2",
      [LIVES_WITH]: "2",
      [APPLYING]: "2",
      [INSTITUTION]: "2",
      [MAILING_SAME]: "On",
      [ACCOMMODATION]: "2",
      [HAS_INCOME]: "2",
      [ONE_TIME_NEXT]: "2",
      [DEDUCTION_NONE]: "On",
    })
  })

  it("keeps income, accommodation details, next-year one-time income and deductions for a person who is not applying", async () => {
    const a = completeFacilityCouple()
    const p = person2(a)
    p.needsAccommodation = "yes"
    p.accommodationConditions.deaf = true
    p.accommodations.asl = true
    p.hasIncome = "yes"
    p.income = [row({ kind: "pension", amount: 900, frequency: "monthly", description: "Union pension" })]
    p.expectedIncomeThisYear = 10800
    p.oneTimeIncome = { ...p.oneTimeIncome, nextYear: "yes", nextYearItems: [{ type: "Annuity payout", amount: 3000, month: 6, year: 2027 }] }
    p.deductions = { none: false, amounts: { ...p.deductions.amounts, hsa: 300 } }
    const { text, checks } = await fillRegion(a)
    expect(checks).toMatchObject({
      [ACCOMMODATION]: "1",
      [CONDITION_BOXES.deaf]: "On",
      [ACCOMMODATION_BOXES.asl]: "On",
      [HAS_INCOME]: "1",
      [LINES.pension[0]]: "On",
      [ONE_TIME_NEXT]: "1",
      [DEDUCTIONS.hsa[0]]: "On",
    })
    expect(text).toMatchObject({
      [LINES.pension[1]]: "900",
      [LINES.pension[2]]: "Monthly",
      [PENSION_SOURCE]: "Union pension",
      [INCOME_THIS]: "10800",
      [NEXT_YEAR.type]: "Annuity payout",
      [DEDUCTIONS.hsa[1]]: "300",
    })
    // only the applying-only questions stay off the form
    expectEmpty({ text, checks }, [
      HAS_SSN,
      ...SSN_BOXES,
      AGREES,
      CLAIMED,
      ABUSE,
      CITIZEN,
      RESIDENT,
      CAREGIVER,
      PREGNANT,
      FOSTER,
      RENT,
      DISABILITY,
      SSI,
      ...Object.values(GENDER),
      ...Object.values(ORIENTATION),
      HISPANIC,
      RACE,
      ETHNICITY,
      DEDUCTION_NONE,
    ])
  })
})

describe("PARITY of the Person 1 and Person 2 columns", () => {
  const both = PERSON_TABLE.filter((row) => row.p1 && row.p2)

  it("has a Person 2 column on most Person 1 rows, and Person 2-only rows for the extra questions", () => {
    expect(both.length).toBeGreaterThan(200)
    const onlyP2 = PERSON_TABLE.filter((row) => !row.p1 && row.p2)
    expect(onlyP2.map((row) => row.path ?? row.derived)).toEqual(["relationshipToPerson1", "livesWithPerson1", "person.homeAddressLine"])
    // Person 1 rows the form's Person 2 block has no counterpart for
    const noP2 = PERSON_TABLE.filter((row) => row.p1 && !row.p2).map((row) => row.path ?? row.derived)
    expect(noP2).toEqual([
      "streetAddress",
      "apartment",
      "city",
      "state",
      "zip",
      "county",
      "mobilePhone",
      "otherPhone",
      "email",
      "tax.filedForAptcYears",
      "oneTimeIncome.nextYear",
    ])
  })

  it("never maps one field for both people, and the Person 2 fields exist on pages 7-12 of the form (PDF indexes 8-13)", () => {
    for (const row of both) {
      const shared = row.p1!.fields.filter((field) => row.p2!.fields.includes(field))
      expect(shared, row.path ?? row.derived).toEqual([])
    }
    expect([...P1_FIELDS].filter((field) => P2_FIELDS.has(field))).toEqual([])
    for (const field of P2_FIELDS) {
      const info = getFieldInfo(field)
      expect(info, field).toBeDefined()
      expect(info!.pages.every((page) => page >= 8 && page <= 13), field).toBe(true)
    }
  })

  it("keeps the same kind of control per question: text stays text, checkbox stays checkbox, same box count", () => {
    for (const row of both) {
      expect(isCheckboxEncoder(row.p2!.encode), row.path ?? row.derived).toBe(isCheckboxEncoder(row.p1!.encode))
      if (row.derived !== "person.fullName") expect(row.p2!.fields.length, row.path ?? row.derived).toBe(row.p1!.fields.length)
    }
  })

  it("Person 2's Yes/No columns name each state on the right widget: the printed Yes sits left of No", () => {
    for (const row of PERSON_TABLE) {
      const encode = row.p2?.encode
      if (typeof encode !== "object" || encode.kind !== "yesNo") continue
      const widgets = getFieldInfo(row.p2!.fields[0])!.widgets
      const yes = widgets.find((w) => w.onState === encode.yes)
      const no = widgets.find((w) => w.onState === encode.no)
      expect(yes && no, row.p2!.fields[0]).toBeTruthy()
      expect(yes!.rect[0], row.p2!.fields[0]).toBeLessThan(no!.rect[0])
    }
  })

  it("leaves only the listed unresolved boxes unmapped on Person 2's pages, and maps the yearly income on page 13", () => {
    const unmapped = new Set(computeUnmappedFields(FIELD_MAP))
    const left = getInventory()
      .filter((field) => unmapped.has(field.name) && field.pages.some((page) => page >= 9 && page <= 12))
      .map((field) => field.name)
      .sort()
    expect(left).toEqual([...UNRESOLVED_P2].sort())
    // the Person 2 half of page 8 (index 8) holds Person 1's tail and Person 2's start; none is left unmapped
    expect(unmapped.has(NAME)).toBe(false)
    expect(unmapped.has(INCOME_THIS)).toBe(false)
    expect(unmapped.has(INCOME_NEXT)).toBe(false)
    expect(Object.keys(NEVER_FILL)).toEqual(expect.arrayContaining(["12 County_P2", "Alien number_P2"]))
    const mapped = new Set(expandPersonTable(PERSON_TABLE).flatMap((e) => e.fields))
    for (const field of UNRESOLVED_P2) {
      expect(mapped.has(field), field).toBe(false)
      expect(NEVER_FILL[field], field).toBeUndefined()
    }
  })
})

describe("stale answers never reach Person 2's pages", () => {
  async function same(stale: Saca2Answers, clean: Saca2Answers) {
    const staleValues = await fillRegion(stale)
    expectNoSentinel(staleValues)
    expect(staleValues).toEqual(await fillRegion(clean))
    return staleValues
  }

  it("applying 'no' with leftover answers to every applying-only question writes only the not-applying questions", async () => {
    const clean = completeFacilityCouple()
    const stale = completeFacilityCouple()
    Object.assign(person2(stale), {
      hasSsn: "yes",
      ssn: "999-99-9999",
      noSsnReason: "illness",
      nameMatchesSsnCard: "no",
      ssnCardName: SENTINEL,
      usCitizenOrNational: "no",
      naturalizedCitizen: "yes",
      alienNumber: SENTINEL,
      citizenshipCertificateNumber: SENTINEL,
      hasEligibleImmigrationStatus: "yes",
      immigrationDocumentId: SENTINEL,
      immigrationCountry: SENTINEL,
      isLegallyMarried: "yes",
      residentOfMassachusetts: "yes",
      caregiverOfChildUnder19: "yes",
      caregiverChildren: [{ name: SENTINEL, dateOfBirth: "2015-01-01" }],
      pregnant: "yes",
      babiesExpected: 3,
      dueDate: "2027-01-01",
      everInFosterCare: "yes",
      fosterCareState: "NH",
      hasDisability: "yes",
      everGotSsi: "yes",
      lastSsiMonth: SENTINEL,
      rentOrOwn: "own",
    })
    person2(stale).tax = {
      ...person2(stale).tax,
      agreesToFileIfAptc: "yes",
      spouseName: SENTINEL,
      claimedAsDependent: "yes",
      taxFiler: { ...person2(stale).tax.taxFiler, name: SENTINEL, relationship: SENTINEL },
      filingSeparatelyAbuse: "yes",
    }
    person2(stale).demographics.race.white = true
    person2(stale).demographics.genderIdentity.female = true
    person2(stale).demographics.hispanicOrLatino = "yes"
    const values = await same(stale, clean)
    expectEmpty(values, [HAS_SSN, ...SSN_BOXES, AGREES, CLAIMED, ABUSE, CITIZEN, RESIDENT, CAREGIVER, PREGNANT, FOSTER, RENT, DISABILITY, SSI])
    expectEmpty(values, [RACE, GENDER.female, HISPANIC, SSN_CARD_NAME, SPOUSE, FILER_NAME, CHILDREN])
  })

  it("a citizen with leftover immigration answers leaves the immigration section empty", async () => {
    const stale = completeRichHousehold()
    Object.assign(person2(stale), {
      hasEligibleImmigrationStatus: "yes",
      immigrationStatus: "lawful-permanent-resident",
      immigrationDocumentType: "permanent-resident-card-green-card-i-551",
      immigrationDocumentId: SENTINEL,
      immigrationDocumentExpiry: "2031-01-01",
      immigrationCountry: SENTINEL,
      immigrationStatusDate: "2016-01-01",
      isLprCheCofa: "yes",
      immigrationSameName: "no",
      immigrationOtherName: SENTINEL,
      arrivedAfterAug1996: "yes",
      isVeteranOrMilitaryFamily: "yes",
      naturalizedCitizen: "no",
      alienNumber: SENTINEL,
    })
    const values = await same(stale, completeRichHousehold())
    expectEmpty(values, [...IMMIGRATION_CHECKS, ...Object.values(IMMIGRATION_TEXT), ALIEN_CITIZEN])
  })

  it("a noncitizen without an eligible status leaves the status and document lines empty", async () => {
    const clean = completeRichHousehold()
    Object.assign(person2(clean), { usCitizenOrNational: "no", naturalizedCitizen: null, hasEligibleImmigrationStatus: "no" })
    const stale = completeRichHousehold()
    Object.assign(person2(stale), {
      usCitizenOrNational: "no",
      naturalizedCitizen: "yes",
      alienNumber: SENTINEL,
      hasEligibleImmigrationStatus: "no",
      immigrationStatus: "lawful-permanent-resident",
      immigrationDocumentId: SENTINEL,
      immigrationCountry: SENTINEL,
    })
    const values = await same(stale, clean)
    expect(values.checks[ELIGIBLE]).toBe("2")
    expectEmpty(values, [ALIEN_CITIZEN, CERTIFICATE, ...Object.values(IMMIGRATION_TEXT), HAS_DOC, LPR])
  })

  it("a citizen flipped to noncitizen leaves the stale naturalized alien and certificate numbers off the form (both people)", async () => {
    const a = completeRichHousehold()
    for (const p of a.persons) {
      Object.assign(p, {
        usCitizenOrNational: "no",
        naturalizedCitizen: "yes",
        alienNumber: SENTINEL,
        citizenshipCertificateNumber: SENTINEL,
        hasEligibleImmigrationStatus: "no",
      })
    }
    const all = await fillAll(a)
    expect(JSON.stringify(all)).not.toContain(SENTINEL)
  })

  it("hasIncome 'no' with leftover rows leaves every income block empty and ticks No", async () => {
    const stale = richWithPerson2Income()
    const p = stale.persons[1]
    p.hasIncome = "no"
    p.income[0].employerNameAndAddress = SENTINEL
    p.income[1].description = SENTINEL
    p.income[2].description = SENTINEL
    p.rental.realEstateTypeOther = SENTINEL
    p.rental.units[0].address = SENTINEL
    p.oneTimeIncome.thisYearItems[0].type = SENTINEL
    const values = await fillRegion(stale)
    expectNoSentinel(values)
    expect(values.checks[HAS_INCOME]).toBe("2")
    expectEmpty(values, [
      EMPLOYER,
      WAGES,
      ...Object.values(WAGES_BOXES),
      EFFECTIVE,
      HOURS,
      SEASONAL,
      SELF_EMPLOYED,
      SE_WORK,
      SE_LOSS,
      SE_HOURS,
      ...Object.values(LINES).flat(),
      PENSION_SOURCE,
      RENTAL,
      ...Object.values(TYPE_BOXES),
      UNIT_1.address,
      UNIT_1.loss,
      HEAT,
      ONE_TIME_THIS,
      ...Object.values(THIS_YEAR),
      INCOME_THIS,
      INCOME_NEXT,
    ])
    // next year's one-time income and the deductions are asked whether or not there is income
    expect(values.checks[ONE_TIME_NEXT]).toBe("1")
    expect(values.checks[DEDUCTIONS.hsa[0]]).toBe("On")
  })

  it("a row whose kind changed from wages to pension leaves the stale employer fields empty", async () => {
    const a = richWithPerson2Income()
    const p = person2(a)
    p.income = [row({ kind: "pension", amount: 450, frequency: "quarterly", description: "Union fund" })]
    // an ex-wages row: stale wages-only fields survive a kind switch in the wizard's data
    p.income[0].employerNameAndAddress = SENTINEL
    p.income[0].employerFederalTaxId = SENTINEL
    p.income[0].hoursPerWeek = 99
    p.income[0].seasonal = "yes"
    p.income[0].seasonJun = true
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expect(values.text[LINES.pension[1]]).toBe("450")
    expectEmpty(values, [EMPLOYER, TAX_ID, HOURS, SEASONAL, MONTH_BOXES.jun, WAGES, ...Object.values(WAGES_BOXES), SE_HOURS])
  })

  it("deductions.none true leaves stale amounts and boxes off the form", async () => {
    const a = richWithPerson2Income()
    person2(a).deductions = { none: true, amounts: { ...person2(a).deductions.amounts, hsa: 900, ira: 400 } }
    const values = await fillRegion(a)
    expect(values.checks[DEDUCTION_NONE]).toBe("On")
    expectEmpty(values, Object.values(DEDUCTIONS).flat())
  })

  it("pregnant 'no', foster 'no', caregiver 'no' and SSI 'no' leave their follow-ups empty", async () => {
    const a = completeRichHousehold()
    Object.assign(person2(a), {
      pregnant: "no",
      babiesExpected: 4,
      dueDate: "2027-02-02",
      everInFosterCare: "no",
      fosterCareState: "NH",
      fosterCareMedicaid: "yes",
      caregiverOfChildUnder19: "no",
      caregiverChildren: [{ name: SENTINEL, dateOfBirth: "2015-01-01" }],
      everGotSsi: "no",
      lastSsiMonth: SENTINEL,
      livingArrangement: "alone",
      needsAccommodation: "no",
      accommodationOther: SENTINEL,
    })
    person2(a).accommodationConditions.blind = true
    person2(a).accommodations.tty = true
    const values = await same(a, completeRichHousehold())
    expectEmpty(values, [BABIES, DUE, FOSTER_STATE, FOSTER_MEDICAID, CHILDREN, SSI_MONTH, LIVING, CONDITION_BOXES.blind, ACCOMMODATION_BOXES.tty, ACCOMMODATION_OTHER])
  })

  it("livesWithPerson1 'yes' leaves a stale street address off the form; a closed home address leaves it off too", async () => {
    const a = completeRichHousehold()
    person2(a).streetAddress = SENTINEL
    person2(a).city = SENTINEL
    const values = await same(a, completeRichHousehold())
    expectEmpty(values, [STREET_LINE])
    const homeless = completeFacilityCouple()
    person2(homeless).noHomeAddress = true
    person2(homeless).streetAddress = SENTINEL
    person2(homeless).mailingSameAsStreet = false
    person2(homeless).mailingAddress = "PO Box 1"
    person2(homeless).mailingCity = "Boxville"
    person2(homeless).mailingZip = "02103"
    const homelessValues = await fillRegion(homeless)
    expectNoSentinel(homelessValues)
    expect(homelessValues.checks[NO_STREET]).toBe("On")
    expect(homelessValues.text[MAILING]).toBe("PO Box 1")
    expectEmpty(homelessValues, [STREET_LINE, MAILING_SAME])
  })

  it("the tax chain is gated by Q21, married, dependents and 'claimed' answers", async () => {
    const a = completeRichHousehold()
    person2(a).tax = {
      ...person2(a).tax,
      agreesToFileIfAptc: "no",
      spouseName: SENTINEL,
      plansJointReturn: "yes",
      claimsDependents: "yes",
      dependents: [{ name: SENTINEL, dateOfBirth: "2015-01-01" }],
      claimedAsDependent: "no",
      taxFiler: {
        name: SENTINEL,
        dateOfBirth: "1960-01-02",
        relationship: SENTINEL,
        marriedFilingJointly: "yes",
        spouseName: SENTINEL,
        spouseDateOfBirth: "1958-03-04",
        otherDependents: SENTINEL,
      },
      filingSeparatelyAbuse: "no",
    }
    const values = await same(a, completeRichHousehold())
    expectEmpty(values, [MARRIED, SPOUSE, JOINT, CLAIMS, DEPENDENTS, FILER_NAME, FILER_DOB, FILER_RELATION, FILER_JOINT, FILER_SPOUSE, FILER_OTHER])
  })
})

describe("Person 2 absent", () => {
  const blankPerson2Fields = async (a: Saca2Answers) => {
    const values = await fillRegion(a)
    expect(values).toEqual({ text: {}, checks: {} })
  }

  it("a one-person application with Person 1 married leaves every Person 2 field empty", async () => {
    const a = completeRichHousehold()
    a.persons.pop()
    await blankPerson2Fields(a)
  })

  it("a blank Person 2 block with Person 1 not married hides the Person 2 step: every field empty", async () => {
    const a = completeRichHousehold()
    person1(a).isLegallyMarried = "no"
    a.persons[1] = emptySaca2Person()
    await blankPerson2Fields(a)
  })

  it("a filled Person 2 block shows the step even when Person 1 is not married, so it is written", async () => {
    const a = completeRichHousehold()
    person1(a).isLegallyMarried = "no"
    expect((await fillRegion(a)).text[NAME]).toBe("Pedro Testcase")
  })

  it("never writes a Person 1 answer into any Person 2 field, even with only Person 1 filled", async () => {
    const a = completeFacilityCouple()
    a.persons.pop()
    person1(a).isLegallyMarried = "no"
    const values = await fillRegion(a)
    expect(values).toEqual({ text: {}, checks: {} })
    expect(JSON.stringify(values)).not.toContain("Walter")
  })
})
