/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import {
  SACA2_FORM_CODE,
  SACA2_PHI_KEYS,
  SACA2_SCHEMA_VERSION,
  SACA2_SERVER_SAFE_KEYS,
  emptySaca2Answers,
  emptySaca2Person,
} from "@/lib/masshealth/saca2/types"
import { ACCOMMODATION_CONDITION_KEYS, ACCOMMODATION_KEYS, DEDUCTION_KEYS, ETHNICITY_KEYS, GENDER_IDENTITY_KEYS, RACE_KEYS, countChecked, emptyChecks } from "@/lib/masshealth/saca2/demographic-options"

describe("emptySaca2Answers", () => {
  it("starts with exactly one blank person and every yes/no unanswered", () => {
    const a = emptySaca2Answers()
    expect(a.persons).toHaveLength(1)
    expect(a.persons[0]).toEqual(emptySaca2Person())
    expect(a.persons[0].dateOfBirth).toBeNull()
    expect(a.persons[0].isLegallyMarried).toBeNull()
    expect(a.supplements.a.needsNursingFacility).toBeNull()
    expect(a.aian.anyMember).toBeNull()
    expect(a.signature.signedBy).toBeNull()
  })

  it("returns independent objects on every call", () => {
    const a = emptySaca2Answers()
    const b = emptySaca2Answers()
    a.persons[0].firstName = "Ada"
    a.transfers.push({
      description: "gift",
      dateOfTransfer: "2025-01-01",
      transferredTo: "child",
      relationship: "child",
      amount: 100,
    })
    expect(b.persons[0].firstName).toBe("")
    expect(b.transfers).toHaveLength(0)
  })
})

describe("constants", () => {
  it("pins version strings to the PDF footer / schema version", () => {
    expect(SACA2_FORM_CODE).toBe("SACA-2_2026-08")
    expect(SACA2_SCHEMA_VERSION).toBe("saca2-2026-08")
  })

  it("classifies every top-level answer key as PHI or server-safe, and only intake/signature are server-safe", () => {
    const keys = Object.keys(emptySaca2Answers()).sort()
    expect([...SACA2_PHI_KEYS, ...SACA2_SERVER_SAFE_KEYS].sort()).toEqual(keys)
    expect([...SACA2_SERVER_SAFE_KEYS]).toEqual(["intake", "signature"])
  })
})

describe("emptySaca2Person defaults", () => {
  it("gives every new person field an empty default", () => {
    const p = emptySaca2Person()
    expect(p.streetAddress).toBe("")
    expect(p.noHomeAddress).toBe(false)
    expect(p.mailingSameAsStreet).toBe(true)
    expect(p.state).toBe("MA")
    expect(p.sexAtBirth).toBeNull()
    expect(p.hasSsn).toBeNull()
    expect(p.ssn).toBe("")
    expect(p.hasIncome).toBeNull()
    expect(p.expectedIncomeThisYear).toBeNull()
    expect(p.expectedIncomeNextYear).toBeNull()
    expect(p.livingArrangement).toBeNull()
  })
})

describe("remaining-step defaults", () => {
  it("starts every asset gate unanswered, with all 12 keys present", () => {
    const gates = emptySaca2Answers().assets.gates
    expect(Object.keys(gates).sort()).toEqual([
      "annuities",
      "assistedLivingDeposit",
      "bankAccounts",
      "burial",
      "closedAccounts",
      "lifeInsurance",
      "otherRealEstate",
      "primaryResidence",
      "retirementAccounts",
      "securities",
      "trusts",
      "vehicles",
    ])
    for (const value of Object.values(gates)) expect(value).toBeNull()
  })

  it("starts with one blank PCA entry per possible person", () => {
    const { byPerson } = emptySaca2Answers().pca
    expect(byPerson).toHaveLength(2)
    for (const entry of byPerson) {
      expect(entry).toEqual({ permanentDisability: null, disabilityBlocksAdls: null, willContactPcmAgency: null })
    }
  })

  it("starts the previous-bills, health, and signing blocks empty", () => {
    const a = emptySaca2Answers()
    expect(a.previousMedicalBills).toEqual({ hasBills: null, wantsCoverageForPeriod: null, earliestDate: null, requests: [] })
    expect(a.health.hasOtherCoverage).toBeNull()
    expect(a.health.hasMedicare).toBe(false)
    expect(a.health.medicare).toEqual([])
    expect(a.health.otherPrograms).toEqual({ peaceCorps: false, tricare: false, vaHealth: false, masshealth: false, otherCoverage: false })
    expect(a.health.employerCoverage).toEqual([])
    expect(a.health.hra).toEqual({ anyoneOffered: null, entries: [] })
    expect(a.health.additionalCoverage).toEqual({
      breastOrCervicalCancer: null,
      breastOrCervicalName: "",
      hivPositive: null,
      hivName: "",
    })
    expect(a.signing.emancipatedMinor).toBeNull()
    expect(a.signing.registerToVote).toBeNull()
    expect(a.signing.responsibleParty.ssn).toBe("")
    expect(a.signing.responsibleParty.dateOfBirth).toBeNull()
  })

  it("keeps defaults independent between calls", () => {
    const a = emptySaca2Answers()
    const b = emptySaca2Answers()
    a.pca.byPerson[0].permanentDisability = "yes"
    a.health.medicare.push({
      personName: "A",
      claimNumber: "",
      coverageStart: null,
      hasPartD: null,
      partDStart: null,
      hasMedigap: null,
      medigapPlan: "",
      medigapStart: null,
    })
    expect(b.pca.byPerson[0].permanentDisability).toBeNull()
    expect(b.health.medicare).toHaveLength(0)
  })
})

describe("supplement and attachment defaults", () => {
  it("starts Supplement A with the new blocks empty", () => {
    const a = emptySaca2Answers().supplements.a
    expect(a.facility).toEqual({ name: "", address: "", admissionDate: null, placedByOtherState: null, placedFromState: "", paysGuardianshipExpenses: null })
    expect(a.familyAtHome).toEqual({ hasFamily: null, members: [] })
    expect(Object.values(a.transferAnswers).every((v) => v === null)).toBe(true)
    expect(Object.keys(a.transferAnswers).sort()).toEqual([
      "addedToDeed",
      "annuity",
      "assets",
      "deed",
      "income",
      "lifeEstateLivedOneYear",
      "loanOrNote",
      "trust",
    ])
    expect(a.facilityDeposit.gaveDeposit).toBeNull()
    expect(a.home.ownsHome).toBeNull()
    expect(a.home.properties).toEqual([])
    for (const key of ["spouse", "disabledChild", "childUnder21", "sibling", "caregiverChild", "dependentRelative"] as const) {
      expect(a.home[key]).toMatchObject({ has: null, name: "", livesInHome: null })
    }
    expect(a.home.childUnder21.dateOfBirth).toBeNull()
    expect(a.home.dependentRelative.relationshipDescription).toBe("")
    expect(a.home.ownsOtherRealEstate).toBeNull()
    expect(a.longTermCareInsurance).toEqual({ hasPolicy: null, policies: [] })
  })

  it("starts two blank Supplement C entries with all seven activities answerable", () => {
    const c = emptySaca2Answers().supplements.c
    expect(c).toHaveLength(2)
    for (const entry of c) {
      expect(entry.healthProblems).toEqual(["", "", ""])
      expect(Object.keys(entry.activities).sort()).toEqual([
        "bathing",
        "dressing",
        "eating",
        "medications",
        "mobility",
        "rangeOfMotion",
        "toileting",
      ])
      for (const need of Object.values(entry.activities)) {
        expect(need).toEqual({ needsHandsOnHelp: null, timesPerDay: null, daysPerWeek: null })
      }
      expect(entry.caregivers).toEqual([])
    }
    expect(c[0]).not.toBe(c[1])
    expect(c[0].activities.eating).not.toBe(c[1].activities.eating)
  })

  it("starts Supplements B and D empty", () => {
    const s = emptySaca2Answers().supplements
    expect(s.b.members).toEqual([])
    expect(s.d.jobs).toEqual([])
  })

  it("starts the attachments block empty with IRS form 1040 and a Massachusetts representative", () => {
    const { attachments } = emptySaca2Answers()
    expect(attachments.ard).toMatchObject({ section: null, repKind: null, repName: "", repState: "MA", legalDocument: "" })
    expect(attachments.irs4506).toEqual({ jointReturn: null, taxpayerId: "", previousAddress: "", formNumber: "1040", yearsRequested: [] })
  })
})

describe("person detail defaults", () => {
  it("starts demographics unanswered with every checkbox unticked", () => {
    const p = emptySaca2Person()
    expect(p.demographics.hispanicOrLatino).toBeNull()
    expect(Object.keys(p.demographics.genderIdentity).sort()).toEqual([...GENDER_IDENTITY_KEYS].sort())
    expect(Object.keys(p.demographics.race).sort()).toEqual([...RACE_KEYS].sort())
    expect(Object.keys(p.demographics.ethnicity).sort()).toEqual([...ETHNICITY_KEYS].sort())
    expect(ETHNICITY_KEYS).toHaveLength(38)
    expect(countChecked(p.demographics.genderIdentity)).toBe(0)
    expect(p.demographics.genderIdentityOther).toBe("")
  })

  it("starts the tax block, household extras, accommodations, rental, one-time income and deductions empty", () => {
    const p = emptySaca2Person()
    expect(p.tax).toMatchObject({ agreesToFileIfAptc: null, spouseName: "", plansJointReturn: null, claimsDependents: null, dependents: [], claimedAsDependent: null, filingSeparatelyAbuse: null, filedForAptcYears: null })
    expect(p.tax.taxFiler).toMatchObject({ name: "", dateOfBirth: null, relationship: "", marriedFilingJointly: null, spouseName: "", otherDependents: "" })
    expect(p.pregnant).toBeNull()
    expect(p.everInFosterCare).toBeNull()
    expect(p.rentOrOwn).toBeNull()
    expect(p.caregiverChildren).toEqual([])
    expect(p.needsAccommodation).toBeNull()
    expect(Object.keys(p.accommodationConditions).sort()).toEqual([...ACCOMMODATION_CONDITION_KEYS].sort())
    expect(Object.keys(p.accommodations).sort()).toEqual([...ACCOMMODATION_KEYS].sort())
    expect(p.rental).toEqual({ hasRentalIncome: null, realEstateType: null, realEstateTypeOther: "", units: [], paysHeatOrUtilities: null })
    expect(p.oneTimeIncome).toEqual({ thisYear: null, thisYearItems: [], nextYear: null, nextYearItems: [] })
    expect(p.deductions.none).toBe(false)
    expect(Object.keys(p.deductions.amounts).sort()).toEqual([...DEDUCTION_KEYS].sort())
    expect(Object.values(p.deductions.amounts).every((v) => v === null)).toBe(true)
  })

  it("starts the SSN-card and immigration extras empty", () => {
    const p = emptySaca2Person()
    expect(p).toMatchObject({
      nameMatchesSsnCard: null,
      ssnCardName: "",
      isLprCheCofa: null,
      immigrationStatusDate: null,
      immigrationCountry: "",
      immigrationSameName: null,
      immigrationOtherName: "",
      arrivedAfterAug1996: null,
      isVeteranOrMilitaryFamily: null,
      isTraffickingOrBatteredVictim: null,
    })
  })

  it("gives each person independent objects", () => {
    const a = emptySaca2Person()
    const b = emptySaca2Person()
    expect(a.demographics.race).not.toBe(b.demographics.race)
    expect(a.deductions.amounts).not.toBe(b.deductions.amounts)
    expect(emptyChecks(["x", "y"])).toEqual({ x: false, y: false })
  })
})
