/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2RuleId, Saca2RuleVerdict, Saca2ScreeningStatus } from "./eligibility/types"
import type { Saca2StepId } from "./schema"
import {
  emptySaca2Answers,
  emptySaca2Person,
  type AssetCategory,
  type BankAccountRow,
  type Saca2Answers,
  type Saca2Person,
} from "./types"

export interface Saca2ExpectedScreening {
  /** Status with the rule policy as shipped (rules 3-7 unconfirmed). */
  asShipped: Saca2ScreeningStatus
  /** Status if every rule were confirmed: pins each rule's own logic end to end. */
  ifAllConfirmed: Saca2ScreeningStatus
  /** Each rule's own verdict, before confirmation gating. */
  verdicts: Record<Saca2RuleId, Saca2RuleVerdict>
}

/** All data below is fabricated. Never copy real applicant data here. */
export interface Saca2SyntheticCase {
  id: string
  description: string
  /** ISO date used as "today" so age-gated rules are deterministic. */
  referenceDate: string
  answers: Saca2Answers
  expectedVisibleSteps: Saca2StepId[]
  expectedScreening: Saca2ExpectedScreening
}

function person(overrides: Partial<Saca2Person>): Saca2Person {
  return { ...emptySaca2Person(), ...overrides }
}

function account(n: number, balance: number): BankAccountRow {
  return {
    ownerName: "Test Person",
    accountType: "savings",
    institution: `Example Bank ${n}`,
    accountNumber: `000000${n}`,
    currentBalance: balance,
    balanceOnAdmissionDate: null,
    open: true,
    closedOn: null,
    balanceWhenClosed: null,
  }
}

const ASSET_GATES: AssetCategory[] = [
  "bankAccounts",
  "retirementAccounts",
  "closedAccounts",
  "primaryResidence",
  "otherRealEstate",
  "lifeInsurance",
  "securities",
  "annuities",
  "assistedLivingDeposit",
  "vehicles",
  "burial",
  "trusts",
]

/** Answer every asset gate the way the wizard requires: Yes for the listed categories, No for the rest. */
function answerGates(a: Saca2Answers, yes: AssetCategory[]) {
  for (const gate of ASSET_GATES) a.assets.gates[gate] = yes.includes(gate) ? "yes" : "no"
}

const NOT_APPLICABLE_LTC = {
  SACA2_R4_HOME_EQUITY: "notApplicable",
  SACA2_R5_TRANSFERS: "notApplicable",
  SACA2_R7_SPOUSAL_ALLOWANCE: "notApplicable",
} as const

const REFERENCE_DATE = "2026-10-13"

/** Visible steps for a single 65+ applicant at home with nothing conditional triggered. */
const SINGLE_SENIOR_STEPS: Saca2StepId[] = [
  "intake",
  "person1",
  "aian",
  "previousBills",
  "assets",
  "healthInsurance",
  "hra",
  "pca",
  "signature",
]

/** Visible steps for a nursing-facility couple (Person 2 and Supplement A, no PCA). */
const FACILITY_COUPLE_STEPS: Saca2StepId[] = [
  "intake",
  "person1",
  "person2",
  "aian",
  "previousBills",
  "assets",
  "healthInsurance",
  "hra",
  "signature",
  "suppA",
]

function singleSenior(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.masshealthHsn = true
  a.persons[0] = person({
    firstName: "Edna",
    lastName: "Testcase",
    dateOfBirth: "1950-04-02",
    applyingForCoverage: "yes",
    residentOfMassachusetts: "yes",
    usCitizenOrNational: "yes",
    inInstitution: "no",
    isLegallyMarried: "no",
    caregiverOfChildUnder19: "no",
    hasIncome: "yes",
    hasMedicareOrSsiOrSsdi: "yes",
    income: [{ kind: "socialSecurity", amount: 1250, frequency: "monthly" }],
  })
  a.assets.bankAccounts = [account(1, 1200)]
  answerGates(a, ["bankAccounts"])
  return a
}

function spouseInNursingFacility(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.longTermCare = true
  a.persons[0] = person({
    firstName: "Walter",
    lastName: "Testcase",
    dateOfBirth: "1944-09-20",
    applyingForCoverage: "yes",
    residentOfMassachusetts: "yes",
    usCitizenOrNational: "yes",
    inInstitution: "yes",
    isLegallyMarried: "yes",
    caregiverOfChildUnder19: "no",
    hasIncome: "yes",
    hasMedicareOrSsiOrSsdi: "yes",
    income: [
      { kind: "socialSecurity", amount: 2100, frequency: "monthly" },
      { kind: "pension", amount: 600, frequency: "monthly" },
    ],
  })
  a.persons.push(
    person({
      firstName: "Dorothy",
      lastName: "Testcase",
      dateOfBirth: "1946-02-11",
      relationshipToPerson1: "spouse",
      applyingForCoverage: "no",
      livesWithPerson1: "no",
      residentOfMassachusetts: "yes",
      inInstitution: "no",
      caregiverOfChildUnder19: "no",
      hasIncome: "yes",
      income: [{ kind: "socialSecurity", amount: 1300, frequency: "monthly" }],
    }),
  )
  a.supplements.a.needsNursingFacility = "yes"
  a.supplements.a.intendsToReturnHome = "no"
  a.supplements.a.spouseMonthlyExpenses = {
    rent: null,
    mortgage: 1500,
    homeownersInsurance: 120,
    realEstateTaxes: 400,
    condoOrCoopFee: null,
    assistedLivingRoomAndBoard: null,
    paysHeat: "yes",
    paysUtilities: "yes",
  }
  a.supplements.a.taxReturnsFiled = "bothYears"
  a.supplements.a.hasCopiesOfTaxReturns = "yes"
  a.assets.primaryResidence = [{ address: "1 Example St, Testville MA", propertyType: "one-family", currentValue: 450000 }]
  a.assets.bankAccounts = [account(1, 54000), account(2, 18000)]
  a.transfers = [
    {
      description: "Cash gift",
      dateOfTransfer: "2024-03-15",
      transferredTo: "Test Child",
      relationship: "child",
      amount: 30000,
    },
  ]
  a.supplements.a.applyingHcbsWaiver = "no"
  a.supplements.a.applyingPace = "no"
  a.supplements.a.familyAtHome.hasFamily = "no"
  a.supplements.a.transferAnswers = {
    trust: "no",
    income: "no",
    assets: "yes",
    deed: "no",
    lifeEstateLivedOneYear: null,
    addedToDeed: "no",
    loanOrNote: "no",
    annuity: "no",
  }
  a.supplements.a.facilityDeposit.gaveDeposit = "no"
  a.supplements.a.home.ownsHome = "yes"
  a.supplements.a.home.properties = [
    { ownerNames: "Walter Testcase", propertyAddress: "1 Example St, Testville MA", ownershipType: "individual", fairMarketValue: 450000 },
  ]
  a.supplements.a.home.spouse = { has: "yes", name: "Dorothy Testcase", livesInHome: "yes" }
  a.supplements.a.home.disabledChild.has = "no"
  a.supplements.a.home.childUnder21.has = "no"
  a.supplements.a.home.sibling.has = "no"
  a.supplements.a.home.caregiverChild.has = "no"
  a.supplements.a.home.dependentRelative.has = "no"
  a.supplements.a.home.ownsOtherRealEstate = "no"
  a.supplements.a.longTermCareInsurance.hasPolicy = "no"
  answerGates(a, ["bankAccounts", "primaryResidence"])
  return a
}

function hcbsWaiver(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.hcbsWaiver = true
  a.persons[0] = person({
    firstName: "Rosa",
    lastName: "Testcase",
    dateOfBirth: "1948-12-05",
    applyingForCoverage: "yes",
    residentOfMassachusetts: "yes",
    usCitizenOrNational: "yes",
    inInstitution: "no",
    isLegallyMarried: "no",
    caregiverOfChildUnder19: "no",
    hasIncome: "yes",
    income: [{ kind: "socialSecurity", amount: 1500, frequency: "monthly" }],
  })
  a.supplements.a.applyingHcbsWaiver = "yes"
  a.supplements.a.taxReturnsFiled = "oneYear"
  a.supplements.a.hasCopiesOfTaxReturns = "no"
  a.supplements.a.needsNursingFacility = "no"
  a.supplements.a.applyingPace = "no"
  a.supplements.a.transferAnswers = {
    trust: "no",
    income: "no",
    assets: "no",
    deed: "no",
    lifeEstateLivedOneYear: null,
    addedToDeed: "no",
    loanOrNote: "no",
    annuity: "no",
  }
  a.supplements.a.facilityDeposit.gaveDeposit = "no"
  a.supplements.a.home.ownsHome = "no"
  a.supplements.a.home.ownsOtherRealEstate = "no"
  a.supplements.a.longTermCareInsurance.hasPolicy = "no"
  answerGates(a, [])
  return a
}

function seniorParentOfChild(): Saca2Answers {
  const a = singleSenior()
  a.persons[0].caregiverOfChildUnder19 = "yes"
  a.persons[0].caregiverChildren = [{ name: "Test Child", dateOfBirth: "2012-05-01" }]
  return a
}

function mixedAgeCouple(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.masshealthHsn = true
  a.persons[0] = person({
    firstName: "Harold",
    lastName: "Testcase",
    dateOfBirth: "1955-06-30",
    applyingForCoverage: "yes",
    residentOfMassachusetts: "yes",
    usCitizenOrNational: "yes",
    isLegallyMarried: "yes",
    caregiverOfChildUnder19: "no",
    hasIncome: "yes",
    hasMedicareOrSsiOrSsdi: "yes",
    income: [{ kind: "socialSecurity", amount: 1600, frequency: "monthly" }],
  })
  a.persons.push(
    person({
      firstName: "June",
      lastName: "Testcase",
      dateOfBirth: "1968-08-14",
      relationshipToPerson1: "spouse",
      applyingForCoverage: "yes",
      livesWithPerson1: "yes",
      residentOfMassachusetts: "yes",
      usCitizenOrNational: "yes",
      isLegallyMarried: "yes",
      caregiverOfChildUnder19: "no",
      hasIncome: "yes",
      hasMedicareOrSsiOrSsdi: "no",
      income: [{ kind: "wages", amount: 400, frequency: "every2weeks", seasonal: "no" }],
    }),
  )
  answerGates(a, [])
  return a
}

function trustAndAnnuity(): Saca2Answers {
  const a = spouseInNursingFacility()
  a.assets.trusts = [
    {
      name: "Testcase Family Trust",
      revocable: false,
      currentPrincipal: 90000,
      principalOnAdmissionDate: 95000,
      trustees: "Test Trustee",
      grantors: "Walter Testcase",
      beneficiaries: "Test Child",
    },
  ]
  a.assets.annuities = [
    { owners: "Walter Testcase", institution: "Example Annuity Co", contractNumber: "A-0001", purchasedOn: "2023-05-01" },
  ]
  a.aian.anyMember = "no"
  a.supplements.a.transferAnswers.annuity = "yes"
  answerGates(a, ["bankAccounts", "primaryResidence", "annuities", "trusts"])
  return a
}

function overflowAccounts(): Saca2Answers {
  const a = singleSenior()
  a.assets.bankAccounts = [account(1, 500), account(2, 700), account(3, 900), account(4, 1100)]
  return a
}

export const SACA2_SYNTHETIC_CASES: readonly Saca2SyntheticCase[] = [
  {
    id: "single-senior-home",
    description: "Single 76-year-old at home, Social Security only ($1,250/month), one savings account.",
    referenceDate: REFERENCE_DATE,
    answers: singleSenior(),
    expectedVisibleSteps: SINGLE_SENIOR_STEPS,
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "LIKELY_ELIGIBLE",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "pass",
        SACA2_R6_INCOME: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
        ...NOT_APPLICABLE_LTC,
      },
    },
  },
  {
    id: "couple-spouse-in-nursing-facility",
    description: "Husband in a nursing facility, wife at home; $30k gift inside the 60-month window.",
    referenceDate: REFERENCE_DATE,
    answers: spouseInNursingFacility(),
    expectedVisibleSteps: FACILITY_COUPLE_STEPS,
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "NEEDS_REVIEW",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "review",
        SACA2_R4_HOME_EQUITY: "pass",
        SACA2_R5_TRANSFERS: "review",
        SACA2_R6_INCOME: "pass",
        SACA2_R7_SPOUSAL_ALLOWANCE: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
      },
    },
  },
  {
    id: "hcbs-waiver-applicant",
    description: "Single 77-year-old applying for a Home- and Community-Based Services Waiver; no copies of tax returns.",
    referenceDate: REFERENCE_DATE,
    answers: hcbsWaiver(),
    expectedVisibleSteps: [...SINGLE_SENIOR_STEPS, "suppA", "irs4506"],
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "PENDING_DOCUMENTS",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "documents",
        SACA2_R3_ASSETS: "pass",
        SACA2_R4_HOME_EQUITY: "notApplicable",
        SACA2_R5_TRANSFERS: "pass",
        SACA2_R6_INCOME: "pass",
        SACA2_R7_SPOUSAL_ALLOWANCE: "notApplicable",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
      },
    },
  },
  {
    id: "senior-parent-of-child-under-19",
    description: "65+ applicant who lives with and cares for a child under 19 (belongs on ACA-3).",
    referenceDate: REFERENCE_DATE,
    answers: seniorParentOfChild(),
    expectedVisibleSteps: SINGLE_SENIOR_STEPS,
    expectedScreening: {
      asShipped: "REDIRECT_ACA3",
      ifAllConfirmed: "REDIRECT_ACA3",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "redirect",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "pass",
        SACA2_R6_INCOME: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
        ...NOT_APPLICABLE_LTC,
      },
    },
  },
  {
    id: "mixed-age-couple",
    description: "Married couple, husband 71 and wife 58, living together with no child under 19.",
    referenceDate: REFERENCE_DATE,
    answers: mixedAgeCouple(),
    expectedVisibleSteps: [
      "intake",
      "person1",
      "person2",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "pca",
      "additionalCoverage",
      "signature",
    ],
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "NEEDS_REVIEW",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "documents",
        SACA2_R3_ASSETS: "pass",
        SACA2_R6_INCOME: "review",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
        ...NOT_APPLICABLE_LTC,
      },
    },
  },
  {
    id: "trust-and-annuity-applicant",
    description: "Nursing-facility couple with an irrevocable trust and a recent annuity.",
    referenceDate: REFERENCE_DATE,
    answers: trustAndAnnuity(),
    expectedVisibleSteps: FACILITY_COUPLE_STEPS,
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "NEEDS_REVIEW",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "review",
        SACA2_R4_HOME_EQUITY: "pass",
        SACA2_R5_TRANSFERS: "review",
        SACA2_R6_INCOME: "pass",
        SACA2_R7_SPOUSAL_ALLOWANCE: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
      },
    },
  },
  {
    id: "overflow-accounts",
    description: "Single senior with four bank accounts (form has room for two).",
    referenceDate: REFERENCE_DATE,
    answers: overflowAccounts(),
    expectedVisibleSteps: SINGLE_SENIOR_STEPS,
    expectedScreening: {
      asShipped: "NEEDS_REVIEW",
      ifAllConfirmed: "LIKELY_INELIGIBLE",
      verdicts: {
        SACA2_R1_RESIDENCY_ROUTE: "pass",
        SACA2_R2_CITIZENSHIP: "pass",
        SACA2_R3_ASSETS: "fail",
        SACA2_R6_INCOME: "pass",
        SACA2_R8_MEDICARE_MSP: "notApplicable",
        ...NOT_APPLICABLE_LTC,
      },
    },
  },
]

export function getSyntheticCase(id: string): Saca2SyntheticCase {
  const found = SACA2_SYNTHETIC_CASES.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown synthetic case: ${id}`)
  return found
}
