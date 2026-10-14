/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2StepId } from "./schema"
import {
  emptySaca2Answers,
  emptySaca2Person,
  type BankAccountRow,
  type Saca2Answers,
  type Saca2Person,
} from "./types"

/** All data below is fabricated. Never copy real applicant data here. */
export interface Saca2SyntheticCase {
  id: string
  description: string
  /** ISO date used as "today" so age-gated rules are deterministic. */
  referenceDate: string
  answers: Saca2Answers
  expectedVisibleSteps: Saca2StepId[]
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
    income: [{ kind: "socialSecurity", amount: 1400, frequency: "monthly" }],
  })
  a.assets.bankAccounts = [account(1, 1200)]
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
      caregiverOfChildUnder19: "no",
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
    income: [{ kind: "socialSecurity", amount: 1500, frequency: "monthly" }],
  })
  a.supplements.a.applyingHcbsWaiver = "yes"
  a.supplements.a.taxReturnsFiled = "oneYear"
  a.supplements.a.hasCopiesOfTaxReturns = "no"
  return a
}

function seniorParentOfChild(): Saca2Answers {
  const a = singleSenior()
  a.persons[0].caregiverOfChildUnder19 = "yes"
  return a
}

function mixedAgeCouple(): Saca2Answers {
  const a = emptySaca2Answers()
  a.persons[0] = person({
    firstName: "Harold",
    lastName: "Testcase",
    dateOfBirth: "1955-06-30",
    applyingForCoverage: "yes",
    residentOfMassachusetts: "yes",
    usCitizenOrNational: "yes",
    isLegallyMarried: "yes",
    caregiverOfChildUnder19: "no",
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
    }),
  )
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
    description: "Single 76-year-old at home, Social Security only, one savings account.",
    referenceDate: REFERENCE_DATE,
    answers: singleSenior(),
    expectedVisibleSteps: SINGLE_SENIOR_STEPS,
  },
  {
    id: "couple-spouse-in-nursing-facility",
    description: "Husband in a nursing facility, wife at home; $30k gift inside the 60-month window.",
    referenceDate: REFERENCE_DATE,
    answers: spouseInNursingFacility(),
    expectedVisibleSteps: FACILITY_COUPLE_STEPS,
  },
  {
    id: "hcbs-waiver-applicant",
    description: "Single 77-year-old applying for a Home- and Community-Based Services Waiver; no copies of tax returns.",
    referenceDate: REFERENCE_DATE,
    answers: hcbsWaiver(),
    expectedVisibleSteps: [...SINGLE_SENIOR_STEPS, "suppA", "irs4506"],
  },
  {
    id: "senior-parent-of-child-under-19",
    description: "65+ applicant who lives with and cares for a child under 19 (belongs on ACA-3).",
    referenceDate: REFERENCE_DATE,
    answers: seniorParentOfChild(),
    expectedVisibleSteps: SINGLE_SENIOR_STEPS,
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
  },
  {
    id: "trust-and-annuity-applicant",
    description: "Nursing-facility couple with an irrevocable trust and a recent annuity.",
    referenceDate: REFERENCE_DATE,
    answers: trustAndAnnuity(),
    expectedVisibleSteps: FACILITY_COUPLE_STEPS,
  },
  {
    id: "overflow-accounts",
    description: "Single senior with four bank accounts (form has room for two).",
    referenceDate: REFERENCE_DATE,
    answers: overflowAccounts(),
    expectedVisibleSteps: SINGLE_SENIOR_STEPS,
  },
]

export function getSyntheticCase(id: string): Saca2SyntheticCase {
  const found = SACA2_SYNTHETIC_CASES.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown synthetic case: ${id}`)
  return found
}
