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
  "signing",
  "attachments",
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
  | "retirementAccounts"
  | "closedAccounts"
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
  gates: Record<AssetCategory, YesNo | null>
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

export type DailyLivingActivity =
  | "mobility"
  | "medications"
  | "bathing"
  | "dressing"
  | "rangeOfMotion"
  | "eating"
  | "toileting"

export interface RelativeInHome {
  has: YesNo | null
  name: string
  livesInHome: YesNo | null
}

export interface HomeProperty {
  ownerNames: string
  propertyAddress: string
  ownershipType: "individual" | "tenancyInCommon" | "jointTenancy" | "lifeEstate" | null
  fairMarketValue: number | null
}

export interface FamilyMemberAtHome {
  name: string
  ssn: string
  relationship: string
  /** ISO YYYY-MM-DD. */
  dateOfBirth: string | null
  monthlyIncome: number | null
}

export interface LongTermCarePolicy {
  companyAndPolicyNumber: string
  policyholder: string
  /** ISO YYYY-MM-DD. */
  effectiveDate: string | null
  premium: number | null
}

export interface SupplementA {
  needsNursingFacility: YesNo | null
  applyingHcbsWaiver: YesNo | null
  applyingPace: YesNo | null
  /** Question 15; not asked of HCBS Waiver applicants. */
  intendsToReturnHome: YesNo | null
  facility: {
    name: string
    address: string
    /** ISO YYYY-MM-DD. */
    admissionDate: string | null
    placedByOtherState: YesNo | null
    placedFromState: string
    paysGuardianshipExpenses: YesNo | null
  }
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
  familyAtHome: { hasFamily: YesNo | null; members: FamilyMemberAtHome[] }
  /** Question 6 a–h (past 60 months). `lifeEstateLivedOneYear` is 6e and is NOT a transfer. */
  transferAnswers: {
    trust: YesNo | null
    income: YesNo | null
    assets: YesNo | null
    deed: YesNo | null
    lifeEstateLivedOneYear: YesNo | null
    addedToDeed: YesNo | null
    loanOrNote: YesNo | null
    annuity: YesNo | null
  }
  /** Question 7: deposit to a health-care or residential facility. */
  facilityDeposit: {
    gaveDeposit: YesNo | null
    facilityName: string
    facilityAddress: string
    amount: number | null
    stillHeld: YesNo | null
    returned: YesNo | null
    returnedToName: string
    returnedToAddress: string
  }
  /** Questions 8–16. */
  home: {
    ownsHome: YesNo | null
    properties: HomeProperty[]
    spouse: RelativeInHome
    disabledChild: RelativeInHome
    childUnder21: RelativeInHome & { dateOfBirth: string | null }
    sibling: RelativeInHome
    caregiverChild: RelativeInHome
    dependentRelative: RelativeInHome & { relationshipDescription: string }
    ownsOtherRealEstate: YesNo | null
    otherRealEstateDescription: string
  }
  longTermCareInsurance: { hasPolicy: YesNo | null; policies: LongTermCarePolicy[] }
  /** Tax returns filed in the last two years. */
  taxReturnsFiled: "bothYears" | "oneYear" | "neither" | null
  hasCopiesOfTaxReturns: YesNo | null
}

export interface AianMember {
  name: string
  federallyRecognizedTribe: YesNo | null
  tribeName: string
  massRecognizedTribe: YesNo | null
  massTribeName: string
  receivedIhsService: YesNo | null
  eligibleForIhs: YesNo | null
  excludedIncomeAmount: number | null
  excludedIncomeFrequency: IncomeFrequency | null
}

export interface SupplementB {
  members: AianMember[]
}

export interface ActivityNeed {
  needsHandsOnHelp: YesNo | null
  timesPerDay: number | null
  daysPerWeek: number | null
}

export interface SupplementC {
  /** Three free-text lines. */
  healthProblems: string[]
  activities: Record<DailyLivingActivity, ActivityNeed>
  caregivers: Array<{ name: string; relationship: string }>
}

export interface EmployerJob {
  employeeName: string
  employeeSsn: string
  eligibleWithinThreeMonths: YesNo | null
  /** ISO YYYY-MM-DD: when a person in a waiting period can enroll. */
  waitingPeriodEnds: string | null
  employerName: string
  employerFederalTaxId: string
  employerAddress: string
  employerCity: string
  employerState: string
  employerZip: string
  employerPhone: string
  contactName: string
  contactPhone: string
  contactEmail: string
  individualPlanName: string
  individualMeetsMinimumValue: YesNo | null
  individualPremium: number | null
  individualPremiumFrequency: IncomeFrequency | null
  familyPlanName: string
  familyMeetsMinimumValue: YesNo | null
  familyPremium: number | null
  familyPremiumFrequency: IncomeFrequency | null
  upcomingChange: "none" | "employerWillNotOffer" | "personWillDrop" | "employerWillChange" | null
  changeEndDate: string | null
  changePremium: number | null
  changePremiumFrequency: IncomeFrequency | null
  changeDate: string | null
}

export interface SupplementD {
  jobs: EmployerJob[]
}

export interface Saca2Supplements {
  a: SupplementA
  b: SupplementB
  /** One entry per person (index 0 = Person 1, 1 = Person 2). */
  c: SupplementC[]
  d: SupplementD
}

export interface ArdData {
  /** Which ARD section applies: 1 applicant designates in writing, 2 cannot designate, 3 appointed by law. */
  section: "applicantDesignates" | "cannotDesignate" | "appointedByLaw" | null
  repKind: "person" | "organization" | null
  repName: string
  repPhone: string
  repStreet: string
  repCity: string
  repState: string
  repZip: string
  repEmail: string
  orgName: string
  staffName: string
  staffEmail: string
  officerName: string
  officerTitle: string
  /** Section 3: description of the legal document (guardianship, power of attorney, ...). */
  legalDocument: string
}

export interface Irs4506Data {
  jointReturn: YesNo | null
  /** Taxpayer ID (ITIN) when Person 1 has no SSN. */
  taxpayerId: string
  previousAddress: string
  formNumber: string
  yearsRequested: Array<{ periodEnd: string | null }>
}

export interface MedicalBillRequest {
  name: string
  /** ISO YYYY-MM-DD. */
  earliestDateRequested: string | null
  circumstancesChanged: YesNo | null
}

export interface MedicareEntry {
  personName: string
  claimNumber: string
  coverageStart: string | null
  hasPartD: YesNo | null
  partDStart: string | null
  hasMedigap: YesNo | null
  medigapPlan: string
  medigapStart: string | null
}

export interface EmployerCoverageEntry {
  employerName: string
  planName: string
  coveredNames: string
  policyNumber: string
  /** Free text: start and end dates (mm/dd/yyyy). */
  startEndDates: string
}

export type HraType = "qsehra" | "ichra"

export interface HraEntry {
  individualName: string
  dateOfBirth: string | null
  employerName: string
  federalTaxId: string
  hraType: HraType | null
  startDate: string | null
  endDate: string | null
  maxSelfOnlyAmount: number | null
  qsehraFamilyIntent: YesNo | null
  qsehraFamilyMax: number | null
  ichraAcceptIntent: YesNo | null
}

export interface ResponsibleParty {
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  ssn: string
  relationship: string
  dateOfBirth: string | null
  street: string
  apartment: string
  city: string
  state: string
  zip: string
  county: string
  phone: string
  phoneType: "mobile" | "home" | "work" | null
  secondPhone: string
  email: string
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
  previousMedicalBills: {
    hasBills: YesNo | null
    wantsCoverageForPeriod: YesNo | null
    /** ISO YYYY-MM-DD: earliest date MassHealth is needed. */
    earliestDate: string | null
    requests: MedicalBillRequest[]
  }
  assets: Saca2Assets
  transfers: Saca2Transfer[]
  health: {
    /** Step 6 Q1: anyone offered coverage from a job. */
    employerOfferedCoverage: YesNo | null
    /** Step 6 Q2 gate: anyone qualifies for or is enrolled in the listed coverage types. */
    hasOtherCoverage: YesNo | null
    hasMedicare: boolean
    medicare: MedicareEntry[]
    wantsPartBHelp: YesNo | null
    partBHelpNames: string
    otherPrograms: {
      peaceCorps: boolean
      tricare: boolean
      vaHealth: boolean
      masshealth: boolean
      otherCoverage: boolean
    }
    otherCoverageDetails: { coveredNames: string; policyNumber: string; startEndDates: string }
    enrolledInEmployerCoverage: boolean
    employerCoverage: EmployerCoverageEntry[]
    /** Step 7. */
    hra: { anyoneOffered: YesNo | null; entries: HraEntry[] }
    /** Step 9 (optional, spouse under 65). */
    additionalCoverage: {
      breastOrCervicalCancer: YesNo | null
      breastOrCervicalName: string
      hivPositive: YesNo | null
      hivName: string
    }
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
  /** Step 10 signer details — PHI (a responsible party's identity), kept out of `signature`. */
  signing: {
    emancipatedMinor: YesNo | null
    responsibleParty: ResponsibleParty
    registerToVote: YesNo | null
  }
  /** ARD-1122 and IRS 4506 attachment data — PHI. */
  attachments: { ard: ArdData; irs4506: Irs4506Data }
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

function emptyActivityNeed(): ActivityNeed {
  return { needsHandsOnHelp: null, timesPerDay: null, daysPerWeek: null }
}

export function emptySupplementC(): SupplementC {
  return {
    healthProblems: ["", "", ""],
    activities: {
      mobility: emptyActivityNeed(),
      medications: emptyActivityNeed(),
      bathing: emptyActivityNeed(),
      dressing: emptyActivityNeed(),
      rangeOfMotion: emptyActivityNeed(),
      eating: emptyActivityNeed(),
      toileting: emptyActivityNeed(),
    },
    caregivers: [],
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
    previousMedicalBills: { hasBills: null, wantsCoverageForPeriod: null, earliestDate: null, requests: [] },
    assets: {
      gates: {
        bankAccounts: null,
        retirementAccounts: null,
        closedAccounts: null,
        primaryResidence: null,
        otherRealEstate: null,
        lifeInsurance: null,
        securities: null,
        annuities: null,
        assistedLivingDeposit: null,
        vehicles: null,
        burial: null,
        trusts: null,
      },
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
    health: {
      employerOfferedCoverage: null,
      hasOtherCoverage: null,
      hasMedicare: false,
      medicare: [],
      wantsPartBHelp: null,
      partBHelpNames: "",
      otherPrograms: { peaceCorps: false, tricare: false, vaHealth: false, masshealth: false, otherCoverage: false },
      otherCoverageDetails: { coveredNames: "", policyNumber: "", startEndDates: "" },
      enrolledInEmployerCoverage: false,
      employerCoverage: [],
      hra: { anyoneOffered: null, entries: [] },
      additionalCoverage: { breastOrCervicalCancer: null, breastOrCervicalName: "", hivPositive: null, hivName: "" },
    },
    pca: {
      needsPca: null,
      paidByMassHealthLastSixMonths: null,
      byPerson: [
        { permanentDisability: null, disabilityBlocksAdls: null, willContactPcmAgency: null },
        { permanentDisability: null, disabilityBlocksAdls: null, willContactPcmAgency: null },
      ],
    },
    supplements: {
      a: {
        needsNursingFacility: null,
        applyingHcbsWaiver: null,
        applyingPace: null,
        intendsToReturnHome: null,
        facility: { name: "", address: "", admissionDate: null, placedByOtherState: null, placedFromState: "", paysGuardianshipExpenses: null },
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
        familyAtHome: { hasFamily: null, members: [] },
        transferAnswers: {
          trust: null,
          income: null,
          assets: null,
          deed: null,
          lifeEstateLivedOneYear: null,
          addedToDeed: null,
          loanOrNote: null,
          annuity: null,
        },
        facilityDeposit: {
          gaveDeposit: null,
          facilityName: "",
          facilityAddress: "",
          amount: null,
          stillHeld: null,
          returned: null,
          returnedToName: "",
          returnedToAddress: "",
        },
        home: {
          ownsHome: null,
          properties: [],
          spouse: { has: null, name: "", livesInHome: null },
          disabledChild: { has: null, name: "", livesInHome: null },
          childUnder21: { has: null, name: "", livesInHome: null, dateOfBirth: null },
          sibling: { has: null, name: "", livesInHome: null },
          caregiverChild: { has: null, name: "", livesInHome: null },
          dependentRelative: { has: null, name: "", livesInHome: null, relationshipDescription: "" },
          ownsOtherRealEstate: null,
          otherRealEstateDescription: "",
        },
        longTermCareInsurance: { hasPolicy: null, policies: [] },
        taxReturnsFiled: null,
        hasCopiesOfTaxReturns: null,
      },
      b: { members: [] },
      c: [emptySupplementC(), emptySupplementC()],
      d: { jobs: [] },
    },
    signature: { signedBy: null },
    signing: {
      emancipatedMinor: null,
      responsibleParty: {
        firstName: "",
        middleName: "",
        lastName: "",
        suffix: "",
        ssn: "",
        relationship: "",
        dateOfBirth: null,
        street: "",
        apartment: "",
        city: "",
        state: "MA",
        zip: "",
        county: "",
        phone: "",
        phoneType: null,
        secondPhone: "",
        email: "",
      },
      registerToVote: null,
    },
    attachments: {
      ard: {
        section: null,
        repKind: null,
        repName: "",
        repPhone: "",
        repStreet: "",
        repCity: "",
        repState: "MA",
        repZip: "",
        repEmail: "",
        orgName: "",
        staffName: "",
        staffEmail: "",
        officerName: "",
        officerTitle: "",
        legalDocument: "",
      },
      irs4506: { jointReturn: null, taxpayerId: "", previousAddress: "", formNumber: "1040", yearsRequested: [] },
    },
  }
}
