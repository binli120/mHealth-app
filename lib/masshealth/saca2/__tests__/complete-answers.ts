/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  emptySaca2Answers,
  emptySaca2Person,
  type AssetCategory,
  type Saca2Answers,
  type Saca2Person,
} from "@/lib/masshealth/saca2/types"

const ALL_GATES: AssetCategory[] = [
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

/** All data is fabricated. */
function completePerson(person: Saca2Person, overrides: Partial<Saca2Person>): Saca2Person {
  return {
    ...person,
    firstName: "Edna",
    lastName: "Testcase",
    dateOfBirth: "1950-04-02",
    sexAtBirth: "female",
    applyingForCoverage: "yes",
    streetAddress: "1 Example St",
    city: "Testville",
    state: "MA",
    zip: "02101",
    inInstitution: "no",
    mobilePhone: "6175550100",
    hasSsn: "no",
    noSsnReason: "justApplied",
    usCitizenOrNational: "yes",
    naturalizedCitizen: "no",
    residentOfMassachusetts: "yes",
    caregiverOfChildUnder19: "no",
    isLegallyMarried: "no",
    hasDisability: "no",
    everGotSsi: "no",
    hasMedicareOrSsiOrSsdi: "yes",
    pregnant: "no",
    everInFosterCare: "no",
    rentOrOwn: "rent",
    needsAccommodation: "no",
    hasIncome: "no",
    oneTimeIncome: { ...person.oneTimeIncome, nextYear: "no" },
    deductions: { ...person.deductions, none: true },
    tax: { ...person.tax, agreesToFileIfAptc: "no", claimedAsDependent: "no", filingSeparatelyAbuse: "no" },
    ...overrides,
  }
}

function setAllGates(a: Saca2Answers, value: "yes" | "no") {
  for (const gate of ALL_GATES) a.assets.gates[gate] = value
}

export function completeSingleSenior(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.masshealthHsn = true
  a.persons[0] = completePerson(a.persons[0], {})
  a.aian.anyMember = "no"
  a.previousMedicalBills.hasBills = "no"
  setAllGates(a, "no")
  a.health.employerOfferedCoverage = "no"
  a.health.hasOtherCoverage = "no"
  a.health.hra.anyoneOffered = "no"
  a.pca.needsPca = "no"
  a.signature.signedBy = "applicant"
  return a
}

export function completeFacilityCouple(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.longTermCare = true
  a.persons[0] = completePerson(a.persons[0], {
    firstName: "Walter",
    dateOfBirth: "1944-09-20",
    sexAtBirth: "male",
    inInstitution: "yes",
    facilityName: "Example Nursing Home",
    isLegallyMarried: "yes",
  })
  a.persons.push(
    completePerson(emptySaca2Person(), {
      firstName: "Dorothy",
      dateOfBirth: "1946-02-11",
      sexAtBirth: "female",
      relationshipToPerson1: "spouse",
      applyingForCoverage: "no",
      livesWithPerson1: "no",
      isLegallyMarried: "yes",
    }),
  )
  a.aian.anyMember = "no"
  a.previousMedicalBills.hasBills = "no"

  a.supplements.a.needsNursingFacility = "yes"
  a.supplements.a.applyingHcbsWaiver = "no"
  a.supplements.a.applyingPace = "no"
  a.supplements.a.facility = {
    name: "Example Nursing Home",
    address: "5 Elm St, Testville MA",
    admissionDate: "2026-09-01",
    placedByOtherState: "no",
    placedFromState: "",
    paysGuardianshipExpenses: "no",
  }
  a.supplements.a.spouseMonthlyExpenses.rent = 1200
  a.supplements.a.spouseMonthlyExpenses.paysHeat = "yes"
  a.supplements.a.spouseMonthlyExpenses.paysUtilities = "yes"
  a.supplements.a.familyAtHome.hasFamily = "no"
  a.supplements.a.transferAnswers = {
    ...a.supplements.a.transferAnswers,
    trust: "no",
    income: "no",
    assets: "yes",
    deed: "no",
    addedToDeed: "no",
    loanOrNote: "no",
    annuity: "no",
  }
  a.transfers = [{ description: "Cash gift", dateOfTransfer: "2024-03-15", transferredTo: "Test Child", relationship: "child", amount: 30000 }]
  a.supplements.a.facilityDeposit.gaveDeposit = "no"
  a.supplements.a.home.ownsHome = "yes"
  a.supplements.a.home.properties = [
    { ownerNames: "Walter Testcase", propertyAddress: "1 Example St, Testville MA", ownershipType: "individual", fairMarketValue: 450000 },
  ]
  a.supplements.a.home.spouse.has = "no"
  a.supplements.a.home.disabledChild.has = "no"
  a.supplements.a.home.childUnder21.has = "no"
  a.supplements.a.home.sibling.has = "no"
  a.supplements.a.home.caregiverChild.has = "no"
  a.supplements.a.home.dependentRelative.has = "no"
  a.supplements.a.intendsToReturnHome = "no"
  a.supplements.a.home.ownsOtherRealEstate = "yes"
  a.supplements.a.home.otherRealEstateDescription = "Cottage at 9 Cape Rd, Testville MA"
  a.supplements.a.longTermCareInsurance.hasPolicy = "no"
  a.supplements.a.taxReturnsFiled = "bothYears"
  a.supplements.a.hasCopiesOfTaxReturns = "yes"

  setAllGates(a, "yes")
  a.assets.bankAccounts = [
    { ownerName: "Walter Testcase", accountType: "savings", institution: "Example Bank", accountNumber: "0001", currentBalance: 54000, balanceOnAdmissionDate: 55000, open: true, closedOn: null, balanceWhenClosed: null },
  ]
  a.assets.primaryResidence = [{ address: "1 Example St, Testville MA", propertyType: "oneFamily", currentValue: 450000 }]
  a.assets.otherRealEstate = [{ address: "9 Cape Rd, Testville MA", propertyType: "other", currentValue: 120000 }]
  a.assets.lifeInsurance = [{ owners: "Walter Testcase", company: "Example Life", policyNumber: "L-1", faceValue: 10000, insuranceType: "whole life", cashSurrenderValue: 2000 }]
  a.assets.securities = [{ kind: "stocks", owners: "Walter Testcase", company: "Example Brokerage", accountNumber: "S-1", currentValue: 8000, valueOnAdmissionDate: 8200, joint: false }]
  a.assets.annuities = [{ owners: "Walter Testcase", institution: "Example Annuity Co", contractNumber: "A-1", purchasedOn: "2023-05-01" }]
  a.assets.assistedLivingDeposits = [{ facilityName: "Example Residence", facilityAddress: "5 Elm St", amount: 3000, depositedOn: "2025-01-15" }]
  a.assets.vehicles = [{ owner: "spouse", vehicleType: "Car", yearMakeModel: "2018 Honda Civic", fairMarketValue: 9000, amountOwed: 0 }]
  a.assets.burial = [{ owner: "you", kind: "contract", amount: 5000 }]
  a.assets.trusts = [{ name: "Testcase Family Trust", revocable: false, currentPrincipal: 90000, principalOnAdmissionDate: 95000, trustees: "Test Trustee", grantors: "Walter Testcase", beneficiaries: "Test Child" }]

  a.health.employerOfferedCoverage = "no"
  a.health.hasOtherCoverage = "yes"
  a.health.hasMedicare = true
  a.health.medicare = [
    { personName: "Walter Testcase", claimNumber: "1EG4-TE5-MK72", coverageStart: "2009-09-01", hasPartD: "yes", partDStart: "2010-01-01", hasMedigap: "no", medigapPlan: "", medigapStart: null },
  ]
  a.health.wantsPartBHelp = "no"
  a.health.hra.anyoneOffered = "no"
  a.signature.signedBy = "authorizedRepresentative"
  a.attachments.ard = {
    ...a.attachments.ard,
    section: "applicantDesignates",
    repKind: "person",
    repName: "Quinn Rep",
    repPhone: "6175550101",
    repStreet: "3 Example St",
    repCity: "Testville",
    repState: "MA",
    repZip: "02101",
  }
  return a
}

/**
 * A married couple under 65, both applying. Person 1 is a noncitizen with an eligible status and exercises every
 * newer Person-block area: demographics, tax chain, household extras, income row details, rental, one-time income,
 * and deductions. Person 2 is a citizen with no income. Fresh objects on every call.
 */
export function completeRichHousehold(): Saca2Answers {
  const a = emptySaca2Answers()
  a.intake.programs.masshealthHsn = true

  const p1 = completePerson(a.persons[0], {
    firstName: "Maria",
    middleName: "Q",
    dateOfBirth: "1985-06-15",
    sexAtBirth: "female",
    isLegallyMarried: "yes",
    hasSsn: "yes",
    ssn: "123-45-6789",
    nameMatchesSsnCard: "no",
    ssnCardName: "Maria Quinn Testcase",
    usCitizenOrNational: "no",
    naturalizedCitizen: null,
    hasEligibleImmigrationStatus: "yes",
    immigrationStatus: "lawful-permanent-resident",
    immigrationDocumentType: "permanent-resident-card-green-card-i-551",
    immigrationDocumentId: "A000000001",
    immigrationDocumentExpiry: "2030-01-31",
    isLprCheCofa: "yes",
    immigrationStatusDate: "2015-03-01",
    immigrationCountry: "Brazil",
    immigrationSameName: "yes",
    arrivedAfterAug1996: "yes",
    isVeteranOrMilitaryFamily: "no",
    isTraffickingOrBatteredVictim: "no",
    caregiverOfChildUnder19: "yes",
    caregiverChildren: [{ name: "Lucas Testcase", dateOfBirth: "2015-09-09" }],
    pregnant: "yes",
    babiesExpected: 1,
    dueDate: "2027-01-20",
    everInFosterCare: "yes",
    fosterCareState: "MA",
    fosterCareMedicaid: "yes",
    rentOrOwn: "rent",
    needsAccommodation: "yes",
    accommodationOther: "",
    hasMedicareOrSsiOrSsdi: "no",
    hasIncome: "yes",
    expectedIncomeThisYear: 60000,
    expectedIncomeNextYear: null,
  })
  p1.demographics.genderIdentity.female = true
  p1.demographics.sexualOrientation.straight = true
  p1.demographics.hispanicOrLatino = "yes"
  p1.demographics.race.white = true
  p1.demographics.ethnicity.brazilian = true
  p1.tax = {
    ...p1.tax,
    agreesToFileIfAptc: "yes",
    spouseName: "Pedro Testcase",
    spouseDateOfBirth: "1983-02-02",
    plansJointReturn: "yes",
    claimsDependents: "yes",
    dependents: [{ name: "Lucas Testcase", dateOfBirth: "2015-09-09" }],
    claimedAsDependent: "no",
    filingSeparatelyAbuse: "no",
  }
  p1.accommodationConditions.lowVision = true
  p1.accommodations.largePrint = true
  p1.income = [
    {
      kind: "wages",
      amount: 2000,
      frequency: "monthly",
      employerNameAndAddress: "Acme, 9 Work Rd, Testville MA",
      hoursPerWeek: 30,
      effectiveDate: "2026-01-05",
      seasonal: "yes",
      seasonJun: true,
      seasonJul: true,
      seasonAug: true,
    },
    { kind: "selfEmployment", amount: 800, frequency: null, hoursPerWeek: 10, description: "House cleaning" },
    { kind: "pension", amount: 300, frequency: "monthly", description: "Brazilian pension fund" },
    { kind: "capitalGains", amount: 100, frequency: null },
  ] as Saca2Person["income"]
  p1.rental = {
    ...p1.rental,
    hasRentalIncome: "yes",
    realEstateType: "twoFamily",
    units: [
      { address: "12 Rental Ave, Testville MA", unit: "1", amount: 1100, isLoss: false, ownerOccupied: "no" },
      { address: "12 Rental Ave, Testville MA", unit: "2", amount: 900, isLoss: false, ownerOccupied: "yes" },
    ],
    paysHeatOrUtilities: "no",
  }
  p1.oneTimeIncome = {
    thisYear: "yes",
    thisYearItems: [{ type: "Insurance settlement", amount: 2500, month: 3, year: 2026 }],
    nextYear: "yes",
    nextYearItems: [{ type: "Lump-sum pension payment", amount: 4000, month: 2, year: 2027 }],
  }
  p1.deductions = {
    none: false,
    amounts: { ...p1.deductions.amounts, hsa: 1500, studentLoanInterest: 600 },
  }
  a.persons[0] = p1

  a.persons.push(
    completePerson(emptySaca2Person(), {
      firstName: "Pedro",
      lastName: "Testcase",
      dateOfBirth: "1983-02-02",
      sexAtBirth: "male",
      relationshipToPerson1: "spouse",
      livesWithPerson1: "yes",
      isLegallyMarried: "yes",
      hasSsn: "yes",
      ssn: "123-45-6780",
      nameMatchesSsnCard: "yes",
      hasMedicareOrSsiOrSsdi: "no",
    }),
  )

  a.aian.anyMember = "no"
  a.previousMedicalBills.hasBills = "no"
  setAllGates(a, "no")
  a.health.employerOfferedCoverage = "no"
  a.health.hasOtherCoverage = "no"
  a.health.hra.anyoneOffered = "no"
  a.pca.needsPca = "no"
  a.signature.signedBy = "applicant"
  return a
}

/** A 76-year-old at home with an HCBS Waiver who triggers Supplements A–D, the ARD, and the IRS 4506. */
export function completeHomeWithAllSupplements(): Saca2Answers {
  const a = completeSingleSenior()
  a.intake.programs.hcbsWaiver = true
  a.aian.anyMember = "yes"

  // Step 6: a job offers coverage (Supplement D).
  a.health.employerOfferedCoverage = "yes"

  // Step 8: the PCA chain qualifies Person 1 (Supplement C).
  a.pca.needsPca = "yes"
  a.pca.paidByMassHealthLastSixMonths = "no"
  a.pca.byPerson[0] = { permanentDisability: "yes", disabilityBlocksAdls: "yes", willContactPcmAgency: "yes" }

  a.signature.signedBy = "authorizedRepresentative"

  // Supplement A: HCBS Waiver (no nursing facility, so no facility or spouse sections).
  const sa = a.supplements.a
  sa.needsNursingFacility = "no"
  sa.applyingHcbsWaiver = "yes"
  sa.applyingPace = "no"
  sa.transferAnswers = {
    trust: "no",
    income: "no",
    assets: "no",
    deed: "no",
    lifeEstateLivedOneYear: null,
    addedToDeed: "no",
    loanOrNote: "no",
    annuity: "no",
  }
  sa.facilityDeposit.gaveDeposit = "no"
  sa.home.ownsHome = "no"
  sa.home.ownsOtherRealEstate = "no"
  sa.longTermCareInsurance.hasPolicy = "no"
  sa.taxReturnsFiled = "oneYear"
  sa.hasCopiesOfTaxReturns = "no"

  // Supplement B.
  a.supplements.b.members = [
    {
      name: "Edna Testcase",
      federallyRecognizedTribe: "yes",
      tribeName: "Example Tribe",
      massRecognizedTribe: "no",
      massTribeName: "",
      receivedIhsService: "yes",
      eligibleForIhs: null,
      excludedIncomeAmount: null,
      excludedIncomeFrequency: null,
    },
  ]

  // Supplement C for Person 1.
  const c = a.supplements.c[0]
  c.healthProblems = ["Arthritis", "", ""]
  for (const key of ["mobility", "medications", "bathing", "dressing", "rangeOfMotion", "eating", "toileting"] as const) {
    c.activities[key] = { needsHandsOnHelp: "no", timesPerDay: null, daysPerWeek: null }
  }
  c.activities.bathing = { needsHandsOnHelp: "yes", timesPerDay: 1, daysPerWeek: 7 }
  c.caregivers = [{ name: "Test Child", relationship: "daughter" }]

  // Supplement D.
  a.supplements.d.jobs = [
    {
      employeeName: "Edna Testcase",
      employeeSsn: "",
      eligibleWithinThreeMonths: "yes",
      waitingPeriodEnds: null,
      employerName: "Acme",
      employerFederalTaxId: "",
      employerAddress: "9 Work Rd",
      employerCity: "Testville",
      employerState: "MA",
      employerZip: "02101",
      employerPhone: "6175550100",
      contactName: "HR",
      contactPhone: "",
      contactEmail: "",
      individualPlanName: "Gold Individual",
      individualMeetsMinimumValue: "yes",
      individualPremium: 120,
      individualPremiumFrequency: "monthly",
      familyPlanName: "",
      familyMeetsMinimumValue: null,
      familyPremium: null,
      familyPremiumFrequency: null,
      upcomingChange: "none",
      changeEndDate: null,
      changePremium: null,
      changePremiumFrequency: null,
      changeDate: null,
    },
  ]

  // ARD and IRS 4506.
  a.attachments.ard = {
    ...a.attachments.ard,
    section: "applicantDesignates",
    repKind: "person",
    repName: "Quinn Rep",
    repPhone: "6175550101",
    repStreet: "3 Example St",
    repCity: "Testville",
    repState: "MA",
    repZip: "02101",
  }
  a.persons[0].hasSsn = "yes"
  a.persons[0].nameMatchesSsnCard = "yes"
  a.persons[0].ssn = "123-45-6789"
  a.attachments.irs4506.jointReturn = "no"
  a.attachments.irs4506.yearsRequested = [{ periodEnd: "2025-12-31" }]
  return a
}
