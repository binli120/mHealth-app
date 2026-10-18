/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFDocument } from "pdf-lib"
import { describe, expect, it, vi } from "vitest"

import { completeFacilityCouple, completeHomeWithAllSupplements, completeRichHousehold, completeSingleSenior } from "../../__tests__/complete-answers"
import { HEALTH_INSURANCE_STEP_CONTENT, HRA_STEP_CONTENT } from "../../questions/health"
import type { Saca2Answers } from "../../types"
import { STEPS_6_9_ENTRIES } from "../field-map/steps-6-9"
import { FIELD_MAP } from "../field-map"
import { getFieldInfo, getInventory } from "../inventory"
import { NEVER_FILL } from "../never-fill"
import { buildOverflowSheets } from "../overflow-plan"
import { fillSaca2Pdf } from "../pdf-fill"
import { EMPLOYER_NAMES_SUFFIX, splitCoverageNames, splitSharedFields } from "../split-shared-fields"
import { loadSaca2Template } from "../template"
import { readFilled, type FilledValues } from "./helpers/read-filled"

// each test fills the 1.7 MB template (once or twice); the full suite runs many files in parallel
vi.setConfig({ testTimeout: 60_000 })

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"
const MAPPED = new Set(STEPS_6_9_ENTRIES.flatMap((e) => e.fields))

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

const Q1 = "1. Is anyone listed on this application offered health coverage from a job but not enrolled in it?"
const Q2 = "2. Does anyone qualify for or is anyone enrolled in the following types of health coverage?"
const MEDICARE_BOX = "Enrolled in Medicare or qualifies for a Medicare Part A plan with no premium"
const PART_B = "2b. Do any of the persons above want to apply for help paying for the Medicare Part B premiums?"
const PART_B_NAMES = "If Yes names"
const PROGRAM_BOXES = [
  "Qualifies for Peace Corps",
  "Qualifies for TRICARE Do not check if you have direct care or Line of Duty",
  "Enrolled in Veterans Affairs VA health programs",
  "MassHealth",
  "Other coverage including  COBRA and retiree health plans",
]
const OTHER_NAMES = "Name(s) of covered household members"
const OTHER_POLICY = "Policy number or Member ID"
const OTHER_DATES = "Start date and end date mmddyyyy"
const EMPLOYER_BOX = "Enrolled in employer coverage If anyone on this application is enrolled in employer coverage you must complete"
const EMPLOYER_NAME = "Name of employer"
const EMPLOYER_PLAN = "Plan name"
const EMPLOYER_NAMES = "Name(s) of covered household members__employer"
const EMPLOYER_POLICY = "Policy number or Member ID_2"
const EMPLOYER_DATES = "Start date and end date mmddyyyy_2"

const MEDICARE_BLOCK = [
  {
    name: "Name_3",
    claim: "Medicare claim number",
    start: "When did coverage start mmddyyyy",
    partD: "2a. Does this person have a Medicare Part D plan?",
    partDStart: "2a. If Yes when did coverage start mmddyyyy",
    medigap: "2b. Does this person have a Medigap/Medicare supplemental policy?",
    plan: "If Yes name of coverage plan",
    medigapStart: "When did coverage start mmddyyyy_2",
  },
  {
    name: "Name_4",
    claim: "Medicare claim number_2",
    start: "When did coverage start mmddyyyy_3",
    partD: "2a. Does this person have a Medicare Part D plan?_2",
    partDStart: "If Yes when did coverage start mmddyyyy_2",
    medigap: "2b. Does this person have a Medigap/Medicare supplemental policy?_2",
    plan: "If Yes name of coverage plan_2",
    medigapStart: "When did coverage start mmddyyyy_4",
  },
]

const HRA_Q = "Is anyone in the household offered Health Reimbursement Arrangements (HRAs) from their employer?"
const hraField = (n: 1 | 2) => ({
  name: `S7. Name(s)_${n}`,
  dob: `S7. DOB_${n}`,
  employer: `S7. Employer Name_${n}`,
  taxId: `S7. Federal Tax ID_${n}`,
  qsehra: `S7. QSEHRA_${n}`,
  ichra: `S7. ICHRA_${n}`,
  start: `S7. Start date_${n}`,
  end: `S7. End date_${n}`,
  max: `S7. Max amount_${n}`,
  familyIntent: `S&. do you intend to use QSEHRA family coverage benefits from your employer?_${n}`,
  familyMax: `S7. Max QSEHRA amount_${n}`,
  acceptIntent: `S7. Does anyone in the household intend to accept an ICHRA?_${n}`,
})

const PCA = {
  needs: "1. Do you or your spouse need the services of a personal-care attendant?",
  paid: "2. Have you or your spouse had the services of a personal-care attendant paid for by MassHealth within 6 months",
  youDisability: "3. Do you have a permanent or long-lasting disability?",
  spouseDisability: "3. Does your spouse have a permanent or long-lasting disability?",
  youAdls: "3a. Do you need help",
  spouseAdls: "3a. Does your spouse need help",
  youContact: "3b. If Yes, do you plan to contact a MassHealth",
  spouseContact: "3b. If Yes, does your spouse plan to contact a MassHealth",
}
const SPOUSE_PCA = [PCA.spouseDisability, PCA.spouseAdls, PCA.spouseContact]

const BCC = "Do you have breast or cervical cancer?"
const BCC_NAME = "Name_BCC"
const HIV = "Are you HIV positive?"
const HIV_NAME = "Name_HIV"

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

/** A senior couple at home (not in a facility), so Step 8 is shown for both. */
function homeCouple(): Saca2Answers {
  const a = completeFacilityCouple()
  a.intake.programs.longTermCare = false
  a.supplements.a.needsNursingFacility = "no"
  return a
}

/** A couple where Person 2 is under 65 and lives with Person 1, so Step 9 is shown. */
function mixedAgeCouple(): Saca2Answers {
  const a = homeCouple()
  a.persons[1].dateOfBirth = "1980-01-01"
  a.persons[1].livesWithPerson1 = "yes"
  a.persons[1].caregiverOfChildUnder19 = "no"
  a.persons[0].caregiverOfChildUnder19 = "no"
  return a
}

function withCoverage(): Saca2Answers {
  const a = completeSingleSenior()
  const h = a.health
  h.employerOfferedCoverage = "yes"
  h.hasOtherCoverage = "yes"
  h.hasMedicare = true
  h.medicare = [
    { personName: "Walter Testcase", claimNumber: "1EG4-TE5-MK72", coverageStart: "2009-09-01", hasPartD: "yes", partDStart: "2010-01-01", hasMedigap: "yes", medigapPlan: "Plan G", medigapStart: "2011-02-01" },
    // Part D "no" and Medigap "no" hide their dates and plan, so the stale values below must never print
    { personName: "Dorothy Testcase", claimNumber: "2AB4-XY7-ZZ99", coverageStart: "2012-03-01", hasPartD: "no", partDStart: "2001-01-01", hasMedigap: "no", medigapPlan: SENTINEL, medigapStart: "2002-02-02" },
    { personName: "Third Person", claimNumber: "3CC4-AA1-BB22", coverageStart: "2015-05-05", hasPartD: "yes", partDStart: "2016-06-06", hasMedigap: "yes", medigapPlan: "Plan N", medigapStart: "2017-07-07" },
    { personName: "Fourth Person", claimNumber: "4DD5-CC2-DD33", coverageStart: "2018-08-08", hasPartD: "no", partDStart: null, hasMedigap: "no", medigapPlan: "", medigapStart: null },
  ]
  h.wantsPartBHelp = "yes"
  h.partBHelpNames = "Walter Testcase and Dorothy Testcase"
  h.otherPrograms = { peaceCorps: true, tricare: true, vaHealth: true, masshealth: true, otherCoverage: true }
  h.otherCoverageDetails = { coveredNames: "Walter Testcase", policyNumber: "VA-123", startEndDates: "01/01/2020 - 12/31/2026" }
  h.enrolledInEmployerCoverage = true
  h.employerCoverage = [
    { employerName: "Acme Corp", planName: "Acme Gold", coveredNames: "Dorothy Testcase", policyNumber: "AC-9", startEndDates: "02/01/2021 - present" },
    { employerName: "Second Employer", planName: "Silver", coveredNames: "Third Person", policyNumber: "SE-7", startEndDates: "03/01/2022 - present" },
  ]
  return a
}

function withHra(): Saca2Answers {
  const a = completeSingleSenior()
  a.health.hra.anyoneOffered = "yes"
  a.health.hra.entries = [
    {
      individualName: "Walter Testcase",
      dateOfBirth: "1950-04-02",
      employerName: "Acme Corp",
      federalTaxId: "12-3456789",
      hraType: "qsehra",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      maxSelfOnlyAmount: 6350,
      qsehraFamilyIntent: "yes",
      qsehraFamilyMax: 12800.5,
      // an ICHRA question is hidden for a QSEHRA
      ichraAcceptIntent: "yes",
    },
    {
      individualName: "Dorothy Testcase",
      dateOfBirth: "1946-02-11",
      employerName: "Beta LLC",
      federalTaxId: "98-7654321",
      hraType: "ichra",
      startDate: "2026-03-01",
      endDate: null,
      maxSelfOnlyAmount: 5000,
      // QSEHRA questions are hidden for an ICHRA
      qsehraFamilyIntent: "yes",
      qsehraFamilyMax: 777,
      ichraAcceptIntent: "no",
    },
  ]
  return a
}

// ---------------------------------------------------------------------------------------------
// The four complete fixtures
// ---------------------------------------------------------------------------------------------

describe("Steps 6-9: complete fixtures", () => {
  it("single senior: every gate No, Step 8 answers its first question, Step 9 is hidden", async () => {
    const { text, checks } = await fillRegion(completeSingleSenior())
    expect(text).toEqual({})
    expect(checks).toEqual({ [Q1]: "2", [Q2]: "2", [HRA_Q]: "No", [PCA.needs]: "2" })
  })

  it("home applicant with every supplement: Step 6 Q1 Yes, the PCA chain Yes for Person 1 only (spouse column blank)", async () => {
    const { text, checks } = await fillRegion(completeHomeWithAllSupplements())
    expect(text).toEqual({})
    expect(checks).toEqual({
      [Q1]: "1",
      [Q2]: "2",
      [HRA_Q]: "No",
      [PCA.needs]: "1",
      [PCA.paid]: "2",
      [PCA.youDisability]: "1",
      [PCA.youAdls]: "1",
      [PCA.youContact]: "1",
    })
    for (const name of SPOUSE_PCA) expect(checks[name]).toBeUndefined()
  })

  it("facility couple: Medicare with Part D and no Medigap; Step 8 (facility) and Step 9 (both seniors) are hidden", async () => {
    const { text, checks } = await fillRegion(completeFacilityCouple())
    expect(text).toEqual({
      [MEDICARE_BLOCK[0].name]: "Walter Testcase",
      [MEDICARE_BLOCK[0].claim]: "1EG4-TE5-MK72",
      [MEDICARE_BLOCK[0].start]: "09/01/2009",
      [MEDICARE_BLOCK[0].partDStart]: "01/01/2010",
    })
    expect(checks).toEqual({
      [Q1]: "2",
      [Q2]: "1",
      [MEDICARE_BOX]: "On",
      [MEDICARE_BLOCK[0].partD]: "1",
      [MEDICARE_BLOCK[0].medigap]: "2",
      [PART_B]: "2",
      [HRA_Q]: "No",
    })
  })

  it("rich household: every gate No; Step 8 and Step 9 are hidden for two people under 65", async () => {
    const { text, checks } = await fillRegion(completeRichHousehold())
    expect(text).toEqual({})
    expect(checks).toEqual({ [Q1]: "2", [Q2]: "2", [HRA_Q]: "No" })
  })
})

// ---------------------------------------------------------------------------------------------
// Step 6 in full
// ---------------------------------------------------------------------------------------------

describe("Step 6: every coverage type, two Medicare blocks and the employer block", () => {
  it("fills the form's lines with the first rows and ticks every box", async () => {
    const { text, checks } = await fillRegion(withCoverage())
    expect(text).toEqual({
      [MEDICARE_BLOCK[0].name]: "Walter Testcase",
      [MEDICARE_BLOCK[0].claim]: "1EG4-TE5-MK72",
      [MEDICARE_BLOCK[0].start]: "09/01/2009",
      [MEDICARE_BLOCK[0].partDStart]: "01/01/2010",
      [MEDICARE_BLOCK[0].plan]: "Plan G",
      [MEDICARE_BLOCK[0].medigapStart]: "02/01/2011",
      [MEDICARE_BLOCK[1].name]: "Dorothy Testcase",
      [MEDICARE_BLOCK[1].claim]: "2AB4-XY7-ZZ99",
      [MEDICARE_BLOCK[1].start]: "03/01/2012",
      [PART_B_NAMES]: "Walter Testcase and Dorothy Testcase",
      [OTHER_NAMES]: "Walter Testcase",
      [OTHER_POLICY]: "VA-123",
      [OTHER_DATES]: "01/01/2020 - 12/31/2026",
      [EMPLOYER_NAME]: "Acme Corp",
      [EMPLOYER_PLAN]: "Acme Gold",
      [EMPLOYER_NAMES]: "Dorothy Testcase",
      [EMPLOYER_POLICY]: "AC-9",
      [EMPLOYER_DATES]: "02/01/2021 - present",
    })
    expect(checks).toEqual({
      [Q1]: "1",
      [Q2]: "1",
      [MEDICARE_BOX]: "On",
      [MEDICARE_BLOCK[0].partD]: "1",
      [MEDICARE_BLOCK[0].medigap]: "1",
      [MEDICARE_BLOCK[1].partD]: "2",
      [MEDICARE_BLOCK[1].medigap]: "2",
      [PART_B]: "1",
      ...Object.fromEntries(PROGRAM_BOXES.map((name) => [name, "On"])),
      [EMPLOYER_BOX]: "On",
      [HRA_Q]: "No",
      [PCA.needs]: "2",
    })
    expectNoSentinel({ text, checks })
  })

  it("the two covered-names lines are separate fields: each prints only its own value", async () => {
    const a = withCoverage()
    a.health.otherCoverageDetails.coveredNames = "OTHER LINE NAMES"
    a.health.employerCoverage[0].coveredNames = "EMPLOYER LINE NAMES"
    const { text } = await fillRegion(a)
    expect(text[OTHER_NAMES]).toBe("OTHER LINE NAMES")
    expect(text[EMPLOYER_NAMES]).toBe("EMPLOYER LINE NAMES")
    const doc = await PDFDocument.load(await fillSaca2Pdf(a, null, ON))
    for (const name of [OTHER_NAMES, EMPLOYER_NAMES]) {
      expect(doc.getForm().getTextField(name).acroField.getWidgets()).toHaveLength(1)
    }
  })

  it("only the checked coverage types fill their boxes; an unchecked Medicare box writes no Medicare block", async () => {
    const a = withCoverage()
    a.health.otherPrograms = { peaceCorps: false, tricare: true, vaHealth: false, masshealth: false, otherCoverage: false }
    const { checks } = await fillRegion(a)
    expect(PROGRAM_BOXES.filter((name) => checks[name] === "On")).toEqual([PROGRAM_BOXES[1]])
    a.health.hasMedicare = false
    const off = await fillRegion(a)
    expect(off.checks[MEDICARE_BOX]).toBeUndefined()
    expect(off.checks[PART_B]).toBeUndefined()
    expect(off.text[MEDICARE_BLOCK[0].name]).toBeUndefined()
    expect(off.text[PART_B_NAMES]).toBeUndefined()
  })

  it("Medicare rows beyond the form's two blocks, and employer rows beyond its one, go on continuation sheets (none of them on the form)", async () => {
    const a = withCoverage()
    const sheets = buildOverflowSheets(a, ON)
    expect(sheets.map((s) => s.title)).toEqual(["Additional people with Medicare", "Additional employer coverage"])
    expect(sheets[0]).toEqual({
      title: "Additional people with Medicare",
      columns: [
        "Name of person covered",
        "Medicare claim number",
        "Coverage start",
        "Medicare Part D plan?",
        "Part D coverage start",
        "Medigap policy?",
        "Medigap plan name",
        "Medigap coverage start",
      ],
      rows: [
        ["Third Person", "3CC4-AA1-BB22", "05/05/2015", "Yes", "06/06/2016", "Yes", "Plan N", "07/07/2017"],
        ["Fourth Person", "4DD5-CC2-DD33", "08/08/2018", "No", "", "No", "", ""],
      ],
    })
    expect(sheets[1]).toEqual({
      title: "Additional employer coverage",
      columns: ["Name of employer", "Plan name", "Covered household members", "Policy number or member ID", "Start and end dates"],
      rows: [["Second Employer", "Silver", "Third Person", "SE-7", "03/01/2022 - present"]],
    })
    const onForm = JSON.stringify(await fillRegion(a))
    for (const value of ["Third Person", "Fourth Person", "Second Employer", "3CC4-AA1-BB22", "SE-7", "Plan N"]) {
      expect(onForm).not.toContain(value)
    }
  })

  it("households whose rows all fit build no Step 6 sheet", () => {
    expect(buildOverflowSheets(completeFacilityCouple(), ON).map((s) => s.title)).toEqual([])
    const a = withCoverage()
    a.health.medicare = a.health.medicare.slice(0, 2)
    a.health.employerCoverage = a.health.employerCoverage.slice(0, 1)
    expect(buildOverflowSheets(a, ON)).toEqual([])
  })

  it("the wizard's repeater limits match what the form and the sheets hold", () => {
    const repeater = (path: string) =>
      HEALTH_INSURANCE_STEP_CONTENT.sections.flatMap((s) => s.questions).find((q) => q.path === path)?.repeater
    expect(repeater("health.medicare")?.maxItems).toBe(4)
    expect(repeater("health.employerCoverage")?.maxItems).toBe(4)
    const hra = HRA_STEP_CONTENT.sections.flatMap((s) => s.questions).find((q) => q.path === "health.hra.entries")?.repeater
    // the form has exactly two HRA blocks, so there is no HRA continuation sheet
    expect(hra?.maxItems).toBe(2)
  })
})

// ---------------------------------------------------------------------------------------------
// Step 7
// ---------------------------------------------------------------------------------------------

describe("Step 7: HRAs", () => {
  it("fills both blocks; the type box, family-intent and ICHRA-intent questions follow the HRA type", async () => {
    const { text, checks } = await fillRegion(withHra())
    const h1 = hraField(1)
    const h2 = hraField(2)
    expect(text).toEqual({
      [h1.name]: "Walter Testcase",
      [h1.dob]: "04/02/1950",
      [h1.employer]: "Acme Corp",
      [h1.taxId]: "12-3456789",
      [h1.start]: "01/01/2026",
      [h1.end]: "12/31/2026",
      [h1.max]: "6350",
      [h1.familyMax]: "12800.50",
      [h2.name]: "Dorothy Testcase",
      [h2.dob]: "02/11/1946",
      [h2.employer]: "Beta LLC",
      [h2.taxId]: "98-7654321",
      [h2.start]: "03/01/2026",
      [h2.max]: "5000",
    })
    expect(checks).toEqual({
      [Q1]: "2",
      [Q2]: "2",
      [HRA_Q]: "Yes",
      [h1.qsehra]: "On",
      [h1.familyIntent]: "Yes",
      [h2.ichra]: "On",
      [h2.acceptIntent]: "No",
      [PCA.needs]: "2",
    })
  })

  it("the No answers of the intent questions are written as No", async () => {
    const a = withHra()
    a.health.hra.entries[0].qsehraFamilyIntent = "no"
    a.health.hra.entries[1].ichraAcceptIntent = "yes"
    const { text, checks } = await fillRegion(a)
    expect(checks[hraField(1).familyIntent]).toBe("No")
    expect(checks[hraField(2).acceptIntent]).toBe("Yes")
    expect(text[hraField(1).familyMax]).toBeUndefined() // hidden when the intent is No
  })
})

// ---------------------------------------------------------------------------------------------
// Step 8
// ---------------------------------------------------------------------------------------------

describe("Step 8: personal-care attendant", () => {
  it("both spouses answer Yes to the whole chain: both columns are filled", async () => {
    const a = homeCouple()
    a.pca.needsPca = "yes"
    a.pca.paidByMassHealthLastSixMonths = "no"
    a.pca.byPerson = [
      { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" },
      { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" },
    ]
    const { checks } = await fillRegion(a)
    for (const name of [PCA.needs, ...Object.values(PCA).slice(2)]) expect(checks[name], name).toBe("1")
    expect(checks[PCA.paid]).toBe("2")
  })

  it("a mixed chain: Person 1 stops at the second question's No, the spouse at the first", async () => {
    const a = homeCouple()
    a.pca.needsPca = "yes"
    a.pca.paidByMassHealthLastSixMonths = "no"
    a.pca.byPerson = [
      { permanentDisability: "yes", disabilityBlocksAdls: "no", willContactPcmAgency: "yes" }, // 3b hidden
      { permanentDisability: "no", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }, // 3a and 3b hidden
    ]
    const { checks } = await fillRegion(a)
    expect(checks).toMatchObject({
      [PCA.needs]: "1",
      [PCA.paid]: "2",
      [PCA.youDisability]: "1",
      [PCA.youAdls]: "2",
      [PCA.spouseDisability]: "2",
    })
    expect(checks[PCA.youContact]).toBeUndefined()
    expect(checks[PCA.spouseAdls]).toBeUndefined()
    expect(checks[PCA.spouseContact]).toBeUndefined()
  })

  it("MassHealth already paid for PCA (Yes): the follow-ups are skipped", async () => {
    const a = completeHomeWithAllSupplements()
    a.pca.paidByMassHealthLastSixMonths = "yes"
    const { checks } = await fillRegion(a)
    expect(checks[PCA.paid]).toBe("1")
    for (const name of [PCA.youDisability, PCA.youAdls, PCA.youContact, ...SPOUSE_PCA]) expect(checks[name], name).toBeUndefined()
  })

  it("a spouse step that is visible but not a legally married spouse gets no spouse-column answers", async () => {
    const a = homeCouple()
    a.persons[0].isLegallyMarried = "no"
    a.pca.needsPca = "yes"
    a.pca.paidByMassHealthLastSixMonths = "no"
    a.pca.byPerson = [
      { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" },
      { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" },
    ]
    const { checks } = await fillRegion(a)
    expect(checks[PCA.youContact]).toBe("1")
    for (const name of SPOUSE_PCA) expect(checks[name], name).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------------------------
// Step 9
// ---------------------------------------------------------------------------------------------

describe("Step 9: additional coverage for a mixed-age couple", () => {
  it("both Yes answers with names", async () => {
    const a = mixedAgeCouple()
    a.health.additionalCoverage = { breastOrCervicalCancer: "yes", breastOrCervicalName: "Dorothy Testcase", hivPositive: "yes", hivName: "Dorothy Testcase" }
    const { text, checks } = await fillRegion(a)
    expect(text).toMatchObject({ [BCC_NAME]: "Dorothy Testcase", [HIV_NAME]: "Dorothy Testcase" })
    expect(checks).toMatchObject({ [BCC]: "1", [HIV]: "1" })
  })

  it("No answers write No and no name", async () => {
    const a = mixedAgeCouple()
    a.health.additionalCoverage = { breastOrCervicalCancer: "no", breastOrCervicalName: SENTINEL, hivPositive: "no", hivName: SENTINEL }
    const values = await fillRegion(a)
    expect(values.checks).toMatchObject({ [BCC]: "2", [HIV]: "2" })
    expect(values.text[BCC_NAME]).toBeUndefined()
    expect(values.text[HIV_NAME]).toBeUndefined()
    expectNoSentinel(values)
  })

  it("an unanswered optional question writes nothing", async () => {
    const a = mixedAgeCouple()
    a.health.additionalCoverage = { breastOrCervicalCancer: null, breastOrCervicalName: "", hivPositive: "yes", hivName: "Dorothy Testcase" }
    const { checks } = await fillRegion(a)
    expect(checks[BCC]).toBeUndefined()
    expect(checks[HIV]).toBe("1")
  })
})

// ---------------------------------------------------------------------------------------------
// Stale answers
// ---------------------------------------------------------------------------------------------

describe("Steps 6-9: stale answers never reach the form", () => {
  it("pca.needsPca No with leftover answers: only the gate says No", async () => {
    const a = completeHomeWithAllSupplements()
    a.pca.needsPca = "no"
    a.pca.paidByMassHealthLastSixMonths = "no"
    a.pca.byPerson = [
      { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" },
      { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" },
    ]
    const { text, checks } = await fillRegion(a)
    expect(text).toEqual({})
    expect(checks[PCA.needs]).toBe("2")
    for (const name of [PCA.paid, PCA.youDisability, PCA.youAdls, PCA.youContact, ...SPOUSE_PCA]) expect(checks[name], name).toBeUndefined()
  })

  it("spouse PCA answers without a Person 2 stay blank, not No, while Person 1's column is written", async () => {
    const a = completeHomeWithAllSupplements()
    expect(a.persons).toHaveLength(1)
    a.pca.byPerson[1] = { permanentDisability: "yes", disabilityBlocksAdls: "no", willContactPcmAgency: "yes" }
    const { checks } = await fillRegion(a)
    expect(checks[PCA.youDisability]).toBe("1")
    for (const name of SPOUSE_PCA) expect(checks[name], name).toBeUndefined()
  })

  it("Person 1 not disabled: the 3a and 3b boxes stay blank even with stale Yes answers", async () => {
    const a = completeHomeWithAllSupplements()
    a.pca.byPerson[0] = { permanentDisability: "no", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
    const { checks } = await fillRegion(a)
    expect(checks[PCA.youDisability]).toBe("2")
    expect(checks[PCA.youAdls]).toBeUndefined()
    expect(checks[PCA.youContact]).toBeUndefined()
  })

  it("the PCA step hidden (nobody is 65 or older) with leftover answers: nothing in Step 8", async () => {
    const a = completeRichHousehold()
    a.pca.needsPca = "yes"
    a.pca.paidByMassHealthLastSixMonths = "no"
    a.pca.byPerson[0] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }
    const { checks } = await fillRegion(a)
    for (const name of Object.values(PCA)) expect(checks[name], name).toBeUndefined()
  })

  it("hasOtherCoverage No with stale insurer text and rows: only the gate says No", async () => {
    const a = withCoverage()
    a.health.hasOtherCoverage = "no"
    a.health.partBHelpNames = SENTINEL
    a.health.otherCoverageDetails = { coveredNames: SENTINEL, policyNumber: SENTINEL, startEndDates: SENTINEL }
    a.health.employerCoverage[0].employerName = SENTINEL
    a.health.medicare[0].personName = SENTINEL
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expect(values.text).toEqual({})
    expect(values.checks).toEqual({ [Q1]: "1", [Q2]: "2", [HRA_Q]: "No", [PCA.needs]: "2" })
    expect(buildOverflowSheets(a, ON)).toEqual([])
  })

  it("no coverage type checked: the details, employer block and rows are hidden", async () => {
    const a = withCoverage()
    a.health.hasMedicare = false
    a.health.otherPrograms = { peaceCorps: false, tricare: false, vaHealth: false, masshealth: false, otherCoverage: false }
    a.health.enrolledInEmployerCoverage = false
    a.health.partBHelpNames = SENTINEL
    a.health.otherCoverageDetails = { coveredNames: SENTINEL, policyNumber: SENTINEL, startEndDates: SENTINEL }
    a.health.employerCoverage[0].employerName = SENTINEL
    a.health.employerCoverage[1].employerName = SENTINEL
    a.health.medicare[0].personName = SENTINEL
    a.health.medicare[2].personName = SENTINEL
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expect(values.text).toEqual({})
    expect(values.checks).toEqual({ [Q1]: "1", [Q2]: "1", [HRA_Q]: "No", [PCA.needs]: "2" })
    expect(buildOverflowSheets(a, ON)).toEqual([])
  })

  it("Part B help No hides the names", async () => {
    const a = withCoverage()
    a.health.wantsPartBHelp = "no"
    a.health.partBHelpNames = SENTINEL
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expect(values.checks[PART_B]).toBe("2")
  })

  it("HRA anyoneOffered No with stale HRA detail: only the gate says No", async () => {
    const a = withHra()
    a.health.hra.anyoneOffered = "no"
    a.health.hra.entries[0].individualName = SENTINEL
    a.health.hra.entries[1].employerName = SENTINEL
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expect(values.text).toEqual({})
    expect(values.checks).toEqual({ [Q1]: "2", [Q2]: "2", [HRA_Q]: "No", [PCA.needs]: "2" })
  })

  it("a QSEHRA's stale ICHRA answer and an ICHRA's stale QSEHRA answers are not written", async () => {
    const a = withHra()
    const { checks, text } = await fillRegion(a)
    expect(checks[hraField(1).acceptIntent]).toBeUndefined()
    expect(checks[hraField(2).familyIntent]).toBeUndefined()
    expect(text[hraField(2).familyMax]).toBeUndefined()
    expect(checks[hraField(1).ichra]).toBeUndefined()
    expect(checks[hraField(2).qsehra]).toBeUndefined()
  })

  it("Step 9 hidden (no mixed-age couple) with stale answers: nothing is written", async () => {
    for (const a of [completeFacilityCouple(), completeSingleSenior(), completeRichHousehold()]) {
      a.health.additionalCoverage = { breastOrCervicalCancer: "yes", breastOrCervicalName: SENTINEL, hivPositive: "yes", hivName: SENTINEL }
      const values = await fillRegion(a)
      expectNoSentinel(values)
      for (const name of [BCC, HIV]) expect(values.checks[name], name).toBeUndefined()
    }
  })

  it("Step 9: a caregiver of a child under 19 hides the step", async () => {
    const a = mixedAgeCouple()
    a.persons[1].caregiverOfChildUnder19 = "yes"
    a.health.additionalCoverage = { breastOrCervicalCancer: "yes", breastOrCervicalName: SENTINEL, hivPositive: "no", hivName: "" }
    const values = await fillRegion(a)
    expectNoSentinel(values)
    expect(values.checks[BCC]).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------------------------
// Template split
// ---------------------------------------------------------------------------------------------

describe("Step 6 covered-names field split", () => {
  it("moves only the lower widget to the __employer copy and is idempotent", async () => {
    const doc = await PDFDocument.load(await loadSaca2Template())
    splitSharedFields(doc)
    const before = doc.getForm().getFields().length
    const widgetsOf = (name: string) => doc.getForm().getTextField(name).acroField.getWidgets().map((w) => w.getRectangle().y)
    expect(widgetsOf(OTHER_NAMES)).toHaveLength(2)
    splitCoverageNames(doc)
    expect(doc.getForm().getFields()).toHaveLength(before + 1)
    const upper = widgetsOf(OTHER_NAMES)
    const lower = widgetsOf(OTHER_NAMES + EMPLOYER_NAMES_SUFFIX)
    expect(upper).toHaveLength(1)
    expect(lower).toHaveLength(1)
    expect(upper[0]).toBeGreaterThan(lower[0])
    splitCoverageNames(doc)
    expect(doc.getForm().getFields()).toHaveLength(before + 1)
  })
})

// ---------------------------------------------------------------------------------------------
// Coverage and structure
// ---------------------------------------------------------------------------------------------

describe("Steps 6-9: coverage of PDF indexes 17-19", () => {
  const onPages = getInventory().filter((f) => f.pages.some((page) => page >= 17 && page <= 19))

  it("accounts for every field: mapped here or never filled with a note", () => {
    const unaccounted = onPages.filter((f) => !MAPPED.has(f.name) && !(f.name in NEVER_FILL))
    expect(unaccounted.map((f) => f.name)).toEqual([])
  })

  it("counts: 72 mapped, 1 never-fill (the stray text widget on Step 8's paragraph), no unresolved", () => {
    expect(onPages).toHaveLength(73)
    expect(onPages.filter((f) => MAPPED.has(f.name))).toHaveLength(72)
    expect(onPages.filter((f) => f.name in NEVER_FILL).map((f) => f.name)).toEqual(["eligibility as if you do not need PCA services"])
    expect(NEVER_FILL["eligibility as if you do not need PCA services"].reason).toBe("other")
  })

  it("every mapped field is mapped exactly once in the whole form", () => {
    for (const name of MAPPED) expect(FIELD_MAP.filter((e) => e.fields.includes(name)), name).toHaveLength(1)
  })

  it("every Yes/No group names the Yes widget left of the No widget", () => {
    let groups = 0
    for (const entry of STEPS_6_9_ENTRIES) {
      if (typeof entry.encode !== "object" || entry.encode.kind !== "yesNo") continue
      groups += 1
      const info = getFieldInfo(entry.fields[0])!
      const { yes, no } = entry.encode
      const yesWidget = info.widgets.find((w) => w.onState === yes)!
      const noWidget = info.widgets.find((w) => w.onState === no)!
      expect(yesWidget, entry.fields[0]).toBeDefined()
      expect(noWidget, entry.fields[0]).toBeDefined()
      expect(yesWidget.rect[0], entry.fields[0]).toBeLessThan(noWidget.rect[0])
    }
    expect(groups).toBe(22)
  })

  it("the Medigap checkbox that ships with a phantom /On value is written like any other group", async () => {
    const bytes = await fillSaca2Pdf(completeSingleSenior(), null, ON)
    const { checks } = await readFilled(bytes)
    // hasOtherCoverage is No, so the Medigap group is left unchecked (its template /V is reset)
    expect(checks[MEDICARE_BLOCK[0].medigap]).toBeNull()
  })
})
