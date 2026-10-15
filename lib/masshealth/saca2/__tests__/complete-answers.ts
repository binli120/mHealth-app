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
    hasIncome: "no",
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
  return a
}
