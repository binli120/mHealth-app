/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { fitLines } from "../derived-assets"
import { EMPLOYER_COVERAGE_LINES, MEDICARE_LINES } from "../derived-health"
import type { Encoder, FieldEntry } from "../types"

/** Steps 6, 8 and 9 and the first HRA question: the Yes widget is the first (left) one, `/1`; No is `/2`. */
const YES_NO_1_2: Encoder = { kind: "yesNo", yes: "1", no: "2" }
/** Step 7's groups name their states: the Yes widget is "Yes", the No widget "No". */
const YES_NO_NAMED: Encoder = { kind: "yesNo", yes: "Yes", no: "No" }

type RootStep = "healthInsurance" | "hra" | "pca" | "additionalCoverage"

const answer = (field: string, stepId: RootStep, path: string, encode: Encoder): FieldEntry => ({
  fields: [field],
  source: { kind: "answer", stepId, path },
  encode,
})

const rowOf =
  (stepId: RootStep, path: string, index: number) =>
  (field: string, key: string, encode: Encoder): FieldEntry => ({
    fields: [field],
    source: { kind: "row", stepId, path, index, key },
    encode,
  })

const derived = (field: string, id: string, encode: Encoder): FieldEntry => ({
  fields: [field],
  source: { kind: "derived", id },
  encode,
})

// ---------------------------------------------------------------------------------------------
// Step 6: health insurance (form page 16, PDF index 17)
// ---------------------------------------------------------------------------------------------

/** The form's two "person with Medicare" blocks (each: name, claim number, start, Part D, Medigap). */
const MEDICARE_BLOCKS = [
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

/** The employer-coverage block's lines; the covered-names line is the Task 9 split copy of the shared field. */
const EMPLOYER_BLOCKS = [
  {
    employer: "Name of employer",
    plan: "Plan name",
    names: "Name(s) of covered household members__employer",
    policy: "Policy number or Member ID_2",
    dates: "Start date and end date mmddyyyy_2",
  },
]

const health = (field: string, path: string, encode: Encoder) => answer(field, "healthInsurance", path, encode)

const OTHER_PROGRAMS: Array<[string, string]> = [
  ["Qualifies for Peace Corps", "peaceCorps"],
  ["Qualifies for TRICARE Do not check if you have direct care or Line of Duty", "tricare"],
  ["Enrolled in Veterans Affairs VA health programs", "vaHealth"],
  ["MassHealth", "masshealth"],
  ["Other coverage including  COBRA and retiree health plans", "otherCoverage"],
]

const HEALTH_ENTRIES: FieldEntry[] = [
  health("1. Is anyone listed on this application offered health coverage from a job but not enrolled in it?", "health.employerOfferedCoverage", YES_NO_1_2),
  health("2. Does anyone qualify for or is anyone enrolled in the following types of health coverage?", "health.hasOtherCoverage", YES_NO_1_2),
  health("Enrolled in Medicare or qualifies for a Medicare Part A plan with no premium", "health.hasMedicare", { kind: "check" }),
  ...fitLines(MEDICARE_BLOCKS, MEDICARE_LINES, "MEDICARE_BLOCKS").flatMap((block, index) => {
    const medicare = rowOf("healthInsurance", "health.medicare", index)
    return [
      medicare(block.name, "personName", "text"),
      medicare(block.claim, "claimNumber", "text"),
      medicare(block.start, "coverageStart", "date"),
      medicare(block.partD, "hasPartD", YES_NO_1_2),
      medicare(block.partDStart, "partDStart", "date"),
      medicare(block.medigap, "hasMedigap", YES_NO_1_2),
      medicare(block.plan, "medigapPlan", "text"),
      medicare(block.medigapStart, "medigapStart", "date"),
    ]
  }),
  health("2b. Do any of the persons above want to apply for help paying for the Medicare Part B premiums?", "health.wantsPartBHelp", YES_NO_1_2),
  health("If Yes names", "health.partBHelpNames", "text"),
  ...OTHER_PROGRAMS.map(([field, key]) => health(field, `health.otherPrograms.${key}`, { kind: "check" })),
  health("Name(s) of covered household members", "health.otherCoverageDetails.coveredNames", "text"),
  health("Policy number or Member ID", "health.otherCoverageDetails.policyNumber", "text"),
  health("Start date and end date mmddyyyy", "health.otherCoverageDetails.startEndDates", "text"),
  health("Enrolled in employer coverage If anyone on this application is enrolled in employer coverage you must complete", "health.enrolledInEmployerCoverage", { kind: "check" }),
  ...fitLines(EMPLOYER_BLOCKS, EMPLOYER_COVERAGE_LINES, "EMPLOYER_BLOCKS").flatMap((block, index) => {
    const employer = rowOf("healthInsurance", "health.employerCoverage", index)
    return [
      employer(block.employer, "employerName", "text"),
      employer(block.plan, "planName", "text"),
      employer(block.names, "coveredNames", "text"),
      employer(block.policy, "policyNumber", "text"),
      employer(block.dates, "startEndDates", "text"),
    ]
  }),
]

// ---------------------------------------------------------------------------------------------
// Step 7: health reimbursement arrangements (form page 17, PDF index 18)
// ---------------------------------------------------------------------------------------------

/** The form's two HRA blocks: the wizard allows exactly two entries. */
const HRA_BLOCKS = ["_1", "_2"]

const hraBlock = (suffix: string, index: number): FieldEntry[] => {
  const hra = rowOf("hra", "health.hra.entries", index)
  return [
    hra(`S7. Name(s)${suffix}`, "individualName", "text"),
    hra(`S7. DOB${suffix}`, "dateOfBirth", "date"),
    hra(`S7. Employer Name${suffix}`, "employerName", "text"),
    hra(`S7. Federal Tax ID${suffix}`, "federalTaxId", "text"),
    // two separate tick boxes for one select: each is ticked only for its own type
    hra(`S7. QSEHRA${suffix}`, "hraType", { kind: "pick", states: { qsehra: "On" } }),
    hra(`S7. ICHRA${suffix}`, "hraType", { kind: "pick", states: { ichra: "On" } }),
    hra(`S7. Start date${suffix}`, "startDate", "date"),
    hra(`S7. End date${suffix}`, "endDate", "date"),
    hra(`S7. Max amount${suffix}`, "maxSelfOnlyAmount", "money"),
    hra(`S&. do you intend to use QSEHRA family coverage benefits from your employer?${suffix}`, "qsehraFamilyIntent", YES_NO_NAMED),
    hra(`S7. Max QSEHRA amount${suffix}`, "qsehraFamilyMax", "money"),
    hra(`S7. Does anyone in the household intend to accept an ICHRA?${suffix}`, "ichraAcceptIntent", YES_NO_NAMED),
  ]
}

const HRA_ENTRIES: FieldEntry[] = [
  answer("Is anyone in the household offered Health Reimbursement Arrangements (HRAs) from their employer?", "hra", "health.hra.anyoneOffered", YES_NO_NAMED),
  ...HRA_BLOCKS.flatMap(hraBlock),
]

// ---------------------------------------------------------------------------------------------
// Step 8: personal-care attendant (form pages 17-18, PDF indexes 18-19)
// ---------------------------------------------------------------------------------------------

const pca = (field: string, path: string) => answer(field, "pca", path, YES_NO_1_2)

const PCA_ENTRIES: FieldEntry[] = [
  pca("1. Do you or your spouse need the services of a personal-care attendant?", "pca.needsPca"),
  pca("2. Have you or your spouse had the services of a personal-care attendant paid for by MassHealth within 6 months", "pca.paidByMassHealthLastSixMonths"),
  pca("3. Do you have a permanent or long-lasting disability?", "pca.byPerson.0.permanentDisability"),
  pca("3a. Do you need help", "pca.byPerson.0.disabilityBlocksAdls"),
  pca("3b. If Yes, do you plan to contact a MassHealth", "pca.byPerson.0.willContactPcmAgency"),
  // the "Your spouse" column is blank unless there is a spouse (derived-health.ts)
  derived("3. Does your spouse have a permanent or long-lasting disability?", "pca.spouse.permanentDisability", YES_NO_1_2),
  derived("3a. Does your spouse need help", "pca.spouse.disabilityBlocksAdls", YES_NO_1_2),
  derived("3b. If Yes, does your spouse plan to contact a MassHealth", "pca.spouse.willContactPcmAgency", YES_NO_1_2),
]

// ---------------------------------------------------------------------------------------------
// Step 9: additional (optional) coverage (form page 18, PDF index 19)
// ---------------------------------------------------------------------------------------------

const additional = (field: string, path: string, encode: Encoder) => answer(field, "additionalCoverage", path, encode)

const ADDITIONAL_ENTRIES: FieldEntry[] = [
  additional("Do you have breast or cervical cancer?", "health.additionalCoverage.breastOrCervicalCancer", YES_NO_1_2),
  additional("Name_BCC", "health.additionalCoverage.breastOrCervicalName", "text"),
  additional("Are you HIV positive?", "health.additionalCoverage.hivPositive", YES_NO_1_2),
  additional("Name_HIV", "health.additionalCoverage.hivName", "text"),
]

/** Steps 6-9 (form pages 16-18, PDF indexes 17-19). */
export const STEPS_6_9_ENTRIES: FieldEntry[] = [
  ...HEALTH_ENTRIES,
  ...HRA_ENTRIES,
  ...PCA_ENTRIES,
  ...ADDITIONAL_ENTRIES,
]
