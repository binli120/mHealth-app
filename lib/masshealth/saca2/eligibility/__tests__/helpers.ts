/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type {
  Saca2AssetInputs,
  Saca2EligibilityInputs,
  Saca2IncomeLine,
  Saca2PersonInputs,
  Saca2SuppAInputs,
} from "@/lib/masshealth/saca2/eligibility/types"

/** Fixed screening date for rule tests (fabricated data only). */
export const ON = new Date("2026-10-13T12:00:00Z")

export const cents = (dollars: number) => Math.round(dollars * 100)

export function incomeLine(kind: string, dollars: number, frequency: string | null = "monthly", isLoss = false): Saca2IncomeLine {
  return { kind, amount: cents(dollars), frequency, isLoss }
}

export function makePerson(overrides: Partial<Saca2PersonInputs> = {}): Saca2PersonInputs {
  return {
    index: 0,
    age: 70,
    applying: true,
    resident: "yes",
    caregiverOfChildUnder19: "no",
    childAges: [],
    citizen: "yes",
    hasEligibleImmigrationStatus: null,
    immigrationStatus: null,
    hasMedicareOrSsiOrSsdi: "yes",
    livesWithPerson1: null,
    inInstitution: "no",
    hasIncome: "no",
    income: [],
    rental: [],
    oneTimeIncomeThisYear: 0,
    ...overrides,
  }
}

export function makeAssets(overrides: Partial<Saca2AssetInputs> = {}): Saca2AssetInputs {
  return {
    gates: {
      bankAccounts: "no",
      retirementAccounts: "no",
      closedAccounts: "no",
      primaryResidence: "no",
      otherRealEstate: "no",
      lifeInsurance: "no",
      securities: "no",
      annuities: "no",
      assistedLivingDeposit: "no",
      vehicles: "no",
      burial: "no",
      trusts: "no",
    },
    bankAccounts: [],
    primaryResidence: [],
    otherRealEstate: [],
    lifeInsurance: [],
    securities: [],
    annuities: 0,
    deposits: 0,
    vehicles: [],
    burial: 0,
    trusts: [],
    ...overrides,
  }
}

export function makeSuppA(overrides: Partial<Saca2SuppAInputs> = {}): Saca2SuppAInputs {
  return {
    needsNursingFacility: "no",
    applyingHcbsWaiver: "no",
    applyingPace: "no",
    intendsToReturnHome: null,
    paysGuardianshipExpenses: null,
    spouseExpenses: null,
    familyAtHome: null,
    transferAnswers: { trust: "no", income: "no", assets: "no", deed: "no", addedToDeed: "no", loanOrNote: "no", annuity: "no" },
    transfers: [],
    gaveFacilityDeposit: "no",
    ownsHome: "no",
    homes: [],
    occupants: { spouse: false, childUnder21: false, disabledChild: false, dependentRelative: false },
    ltcPolicies: 0,
    taxReturnsFiled: null,
    hasCopiesOfTaxReturns: null,
    ...overrides,
  }
}

export function makeInputs(overrides: Partial<Saca2EligibilityInputs> = {}): Saca2EligibilityInputs {
  return {
    persons: [makePerson()],
    hasSpouse: false,
    householdSize: 1,
    programs: { masshealthHsn: true, longTermCare: false, hcbsWaiver: false },
    screening: { disabledAndWorkingQualifies: null, commonHealthTenYears: null },
    suppA: null,
    assets: makeAssets(),
    health: { hasMedicare: false, medigapOrPartD: false, wantsPartBHelp: null, employerCoverageSupplement: false },
    paperwork: { signedBy: "applicant", ardSection: null, irs4506Needed: false },
    ...overrides,
  }
}

/** Person 1 (82) in a nursing facility, spouse (80) at home and not applying; $900 rent, pays heat. */
export function facilityCouple(overrides: Partial<Saca2EligibilityInputs> = {}): Saca2EligibilityInputs {
  return makeInputs({
    persons: [
      makePerson({ age: 82, inInstitution: "yes", hasIncome: "yes", income: [incomeLine("socialSecurity", 2700)] }),
      makePerson({
        index: 1,
        age: 80,
        applying: false,
        resident: null,
        caregiverOfChildUnder19: null,
        citizen: null,
        hasMedicareOrSsiOrSsdi: null,
        livesWithPerson1: "no",
        inInstitution: "no",
        hasIncome: "yes",
        income: [incomeLine("socialSecurity", 1000)],
      }),
    ],
    hasSpouse: true,
    householdSize: 1,
    programs: { masshealthHsn: false, longTermCare: true, hcbsWaiver: false },
    suppA: makeSuppA({
      needsNursingFacility: "yes",
      familyAtHome: "no",
      spouseExpenses: {
        rent: cents(900),
        mortgage: null,
        homeownersInsurance: null,
        realEstateTaxes: null,
        condoOrCoopFee: null,
        paysHeat: "yes",
        paysUtilities: "yes",
      },
    }),
    ...overrides,
  })
}
