/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/** Draft schema version stored with every SACA-2 draft. */
export const SACA2_SCHEMA_VERSION = "saca2-2026-08"
/** Form code exactly as printed in the PDF footer. */
export const SACA2_FORM_CODE = "SACA-2_2026-08"

/**
 * Top-level answer keys that contain PHI. These must travel only through the
 * client-encrypted resume blob (lib/phi-token), never the server draft_state.
 * Everything except SACA2_SERVER_SAFE_KEYS is PHI: even yes/no answers such as
 * disability, PCA need, or tribal membership are health/identity data once tied
 * to a user.
 */
export const SACA2_PHI_KEYS = [
  "screening",
  "persons",
  "aian",
  "previousMedicalBills",
  "assets",
  "transfers",
  "health",
  "pca",
  "supplements",
] as const

/** Top-level keys that may be stored in the server draft_state. */
export const SACA2_SERVER_SAFE_KEYS = ["intake", "signature"] as const

export type YesNo = "yes" | "no"

export type IncomeFrequency =
  | "weekly"
  | "every2weeks"
  | "twiceMonthly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "oneTime"

export interface Saca2IncomeItem {
  kind:
    | "wages"
    | "selfEmployment"
    | "socialSecurity"
    | "pension"
    | "annuity"
    | "trust"
    | "unemployment"
    | "investment"
    | "royalty"
    | "alimony"
    | "veterans"
    | "militaryRetirement"
    | "otherTaxable"
    | "rental"
    | "lottery"
  amount: number | null
  frequency: IncomeFrequency | null
  /** Wages only: employer name and address. */
  employerNameAndAddress?: string
  /** Wages and self-employment: average hours worked each week. */
  hoursPerWeek?: number | null
}

/** One person block (Step 1 = Person 1, Step 2 = Person 2). */
export interface Saca2Person {
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  /** ISO YYYY-MM-DD. */
  dateOfBirth: string | null
  sexAtBirth: "male" | "female" | null
  relationshipToPerson1: string
  applyingForCoverage: YesNo | null

  noHomeAddress: boolean
  streetAddress: string
  apartment: string
  city: string
  state: string
  zip: string
  county: string
  /** Q9 / Person 2 Q6: hospital, nursing facility, or other institution. */
  inInstitution: YesNo | null
  facilityName: string
  mailingSameAsStreet: boolean
  mailingAddress: string
  mailingApartment: string
  mailingCity: string
  mailingState: string
  mailingZip: string

  mobilePhone: string
  otherPhone: string
  email: string
  preferredLanguageSpoken: string
  preferredLanguageWritten: string

  hasSsn: YesNo | null
  ssn: string
  noSsnReason: "illness" | "justApplied" | "noncitizenException" | "religiousException" | null

  usCitizenOrNational: YesNo | null
  naturalizedCitizen: YesNo | null
  alienNumber: string
  citizenshipCertificateNumber: string
  hasEligibleImmigrationStatus: YesNo | null
  /** Slug from the page-32 eligible immigration status list. */
  immigrationStatus: string | null
  /** Slug from the page-32 immigration document type list. */
  immigrationDocumentType: string | null
  immigrationDocumentId: string
  immigrationDocumentExpiry: string | null

  /** Residency question (Person 1 Q14 / Person 2 Q24). */
  residentOfMassachusetts: YesNo | null
  /** "Do you live with a child under 19 and are you the main caregiver?" */
  caregiverOfChildUnder19: YesNo | null
  isLegallyMarried: YesNo | null
  livesWithPerson1: YesNo | null
  hasDisability: YesNo | null
  everGotSsi: YesNo | null
  /** mm/yyyy */
  lastSsiMonth: string
  livingArrangement: "alone" | "withSpouse" | "restHome" | "someoneElsesHome" | null
  /** Screening aid (not a form question): used to decide which proofs are needed. */
  hasMedicareOrSsiOrSsdi: YesNo | null

  hasIncome: YesNo | null
  income: Saca2IncomeItem[]
  expectedIncomeThisYear: number | null
  expectedIncomeNextYear: number | null
}

export type AssetCategory =
  | "bankAccounts"
  | "primaryResidence"
  | "otherRealEstate"
  | "lifeInsurance"
  | "securities"
  | "annuities"
  | "assistedLivingDeposit"
  | "vehicles"
  | "burial"
  | "trusts"

export interface BankAccountRow {
  ownerName: string
  accountType: string
  institution: string
  accountNumber: string
  currentBalance: number | null
  balanceOnAdmissionDate: number | null
  open: boolean
  closedOn: string | null
  balanceWhenClosed: number | null
}

export interface RealEstateRow {
  address: string
  propertyType: string
  currentValue: number | null
}

export interface LifeInsuranceRow {
  owners: string
  company: string
  policyNumber: string
  faceValue: number | null
  insuranceType: string
  cashSurrenderValue: number | null
}

export interface SecuritiesRow {
  kind: "cash" | "stocks" | "bonds" | "savingsBonds" | "mutualFunds" | "options" | "futures" | "other"
  owners: string
  company: string
  accountNumber: string
  currentValue: number | null
  valueOnAdmissionDate: number | null
  joint: boolean
}

export interface AnnuityRow {
  owners: string
  institution: string
  contractNumber: string
  purchasedOn: string | null
}

export interface FacilityDepositRow {
  facilityName: string
  facilityAddress: string
  amount: number | null
  depositedOn: string | null
}

export interface VehicleRow {
  owner: "you" | "spouse"
  vehicleType: string
  yearMakeModel: string
  fairMarketValue: number | null
  amountOwed: number | null
}

export interface BurialRow {
  owner: "you" | "spouse"
  kind: "contract" | "trust" | "lifeInsurance" | "burialOnlyAccount" | "plot"
  amount: number | null
}

export interface TrustRow {
  name: string
  revocable: boolean | null
  currentPrincipal: number | null
  principalOnAdmissionDate: number | null
  trustees: string
  grantors: string
  beneficiaries: string
}

export interface Saca2Assets {
  /** Gate answers ("Do you or your spouse own any ...?"); null = unanswered. */
  gates: Partial<Record<AssetCategory, YesNo | null>>
  bankAccounts: BankAccountRow[]
  primaryResidence: RealEstateRow[]
  otherRealEstate: RealEstateRow[]
  lifeInsurance: LifeInsuranceRow[]
  securities: SecuritiesRow[]
  annuities: AnnuityRow[]
  assistedLivingDeposits: FacilityDepositRow[]
  vehicles: VehicleRow[]
  burial: BurialRow[]
  trusts: TrustRow[]
}

/** Supplement A, Resource Transfers (60-month look-back). */
export interface Saca2Transfer {
  description: string
  /** ISO YYYY-MM-DD. */
  dateOfTransfer: string | null
  transferredTo: string
  relationship: string
  amount: number | null
}

export interface SupplementA {
  needsNursingFacility: YesNo | null
  applyingHcbsWaiver: YesNo | null
  applyingPace: YesNo | null
  intendsToReturnHome: YesNo | null
  spouseMonthlyExpenses: {
    rent: number | null
    mortgage: number | null
    homeownersInsurance: number | null
    realEstateTaxes: number | null
    condoOrCoopFee: number | null
    assistedLivingRoomAndBoard: number | null
    paysHeat: YesNo | null
    paysUtilities: YesNo | null
  }
  /** Tax returns filed in the last two years. */
  taxReturnsFiled: "bothYears" | "oneYear" | "neither" | null
  hasCopiesOfTaxReturns: YesNo | null
}

export interface SupplementB {
  members: Array<{ name: string; federallyRecognizedTribe: YesNo | null; tribeName: string }>
}

export type DailyLivingActivity =
  | "mobility"
  | "medications"
  | "bathing"
  | "dressing"
  | "rangeOfMotion"
  | "eating"
  | "toileting"

export interface SupplementC {
  healthProblems: string[]
  activities: Partial<
    Record<
      DailyLivingActivity,
      { needsHandsOnHelp: YesNo | null; timesPerDay: number | null; daysPerWeek: number | null }
    >
  >
  caregivers: Array<{ name: string; relationship: string }>
}

export interface SupplementD {
  jobs: Array<{
    employeeName: string
    employerName: string
    eligibleWithinThreeMonths: YesNo | null
    meetsMinimumValue: YesNo | null
    employeeMonthlyPremium: number | null
  }>
}

export interface Saca2Supplements {
  a: SupplementA
  b: SupplementB
  c: SupplementC
  d: SupplementD
}

export interface Saca2Answers {
  /** Server-safe (non-PHI): which program boxes were checked on page 1. */
  intake: {
    programs: {
      masshealthHsn: boolean
      longTermCare: boolean
      hcbsWaiver: boolean
      healthConnector: boolean
    }
    applyForSnap: boolean
  }
  /**
   * Screening-only questions drawn from EOM 26-03 that the printed form does not
   * ask directly. Non-PHI categorical flags.
   */
  screening: {
    disabledAndWorkingQualifies: YesNo | null
    commonHealthTenYears: YesNo | null
  }
  /** Index 0 = Person 1 (applicant), index 1 = Person 2 (spouse / other). */
  persons: Saca2Person[]
  aian: { anyMember: YesNo | null }
  previousMedicalBills: { hasBills: YesNo | null }
  assets: Saca2Assets
  transfers: Saca2Transfer[]
  health: {
    employerOfferedCoverage: YesNo | null
    enrolledInEmployerCoverage: boolean
  }
  /** Step 8 — personal-care attendant screen. */
  pca: {
    needsPca: YesNo | null
    paidByMassHealthLastSixMonths: YesNo | null
    byPerson: Array<{
      permanentDisability: YesNo | null
      disabilityBlocksAdls: YesNo | null
      willContactPcmAgency: YesNo | null
    }>
  }
  supplements: Saca2Supplements
  signature: {
    signedBy: "applicant" | "authorizedRepresentative" | "responsibleParty" | null
  }
}

export function emptySaca2Person(): Saca2Person {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    dateOfBirth: null,
    sexAtBirth: null,
    relationshipToPerson1: "",
    applyingForCoverage: null,

    noHomeAddress: false,
    streetAddress: "",
    apartment: "",
    city: "",
    state: "MA",
    zip: "",
    county: "",
    inInstitution: null,
    facilityName: "",
    mailingSameAsStreet: true,
    mailingAddress: "",
    mailingApartment: "",
    mailingCity: "",
    mailingState: "MA",
    mailingZip: "",

    mobilePhone: "",
    otherPhone: "",
    email: "",
    preferredLanguageSpoken: "",
    preferredLanguageWritten: "",

    hasSsn: null,
    ssn: "",
    noSsnReason: null,

    usCitizenOrNational: null,
    naturalizedCitizen: null,
    alienNumber: "",
    citizenshipCertificateNumber: "",
    hasEligibleImmigrationStatus: null,
    immigrationStatus: null,
    immigrationDocumentType: null,
    immigrationDocumentId: "",
    immigrationDocumentExpiry: null,

    residentOfMassachusetts: null,
    caregiverOfChildUnder19: null,
    isLegallyMarried: null,
    livesWithPerson1: null,
    hasDisability: null,
    everGotSsi: null,
    lastSsiMonth: "",
    livingArrangement: null,
    hasMedicareOrSsiOrSsdi: null,

    hasIncome: null,
    income: [],
    expectedIncomeThisYear: null,
    expectedIncomeNextYear: null,
  }
}

export function emptySaca2Answers(): Saca2Answers {
  return {
    intake: {
      programs: { masshealthHsn: false, longTermCare: false, hcbsWaiver: false, healthConnector: false },
      applyForSnap: false,
    },
    screening: { disabledAndWorkingQualifies: null, commonHealthTenYears: null },
    persons: [emptySaca2Person()],
    aian: { anyMember: null },
    previousMedicalBills: { hasBills: null },
    assets: {
      gates: {},
      bankAccounts: [],
      primaryResidence: [],
      otherRealEstate: [],
      lifeInsurance: [],
      securities: [],
      annuities: [],
      assistedLivingDeposits: [],
      vehicles: [],
      burial: [],
      trusts: [],
    },
    transfers: [],
    health: { employerOfferedCoverage: null, enrolledInEmployerCoverage: false },
    pca: { needsPca: null, paidByMassHealthLastSixMonths: null, byPerson: [] },
    supplements: {
      a: {
        needsNursingFacility: null,
        applyingHcbsWaiver: null,
        applyingPace: null,
        intendsToReturnHome: null,
        spouseMonthlyExpenses: {
          rent: null,
          mortgage: null,
          homeownersInsurance: null,
          realEstateTaxes: null,
          condoOrCoopFee: null,
          assistedLivingRoomAndBoard: null,
          paysHeat: null,
          paysUtilities: null,
        },
        taxReturnsFiled: null,
        hasCopiesOfTaxReturns: null,
      },
      b: { members: [] },
      c: { healthProblems: [], activities: {}, caregivers: [] },
      d: { jobs: [] },
    },
    signature: { signedBy: null },
  }
}
