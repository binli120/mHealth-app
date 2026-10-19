/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { completeFacilityCouple, completeSingleSenior } from "@/lib/masshealth/saca2/__tests__/complete-answers"
import { readSaca2EligibilityInputs } from "@/lib/masshealth/saca2/eligibility/inputs"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import type { BankAccountRow } from "@/lib/masshealth/saca2/types"
import { ON } from "./helpers"

const bank = (overrides: Partial<BankAccountRow>): BankAccountRow => ({
  ownerName: "Test Person",
  accountType: "savings",
  institution: "Example Bank",
  accountNumber: "0001",
  currentBalance: 1000,
  balanceOnAdmissionDate: null,
  open: true,
  closedOn: null,
  balanceWhenClosed: null,
  ...overrides,
})

describe("readSaca2EligibilityInputs: what the wizard shows", () => {
  it("reads a single senior: one person, no spouse, household of one", () => {
    const inputs = readSaca2EligibilityInputs(completeSingleSenior(), ON)
    expect(inputs.persons).toHaveLength(1)
    expect(inputs.persons[0]).toMatchObject({ index: 0, age: 76, applying: true, resident: "yes", citizen: "yes", hasIncome: "no" })
    expect(inputs.hasSpouse).toBe(false)
    expect(inputs.householdSize).toBe(1)
    expect(inputs.suppA).toBeNull()
    expect(inputs.programs).toEqual({ masshealthHsn: true, longTermCare: false, hcbsWaiver: false })
  })

  it("reads the facility couple: spouse present, Supplement A values, assets, Medicare, ARD", () => {
    const inputs = readSaca2EligibilityInputs(completeFacilityCouple(), ON)
    expect(inputs.persons).toHaveLength(2)
    expect(inputs.hasSpouse).toBe(true)
    expect(inputs.householdSize).toBe(1)
    expect(inputs.persons[0]).toMatchObject({ age: 82, applying: true, inInstitution: "yes" })
    // Person 2 is not applying, so their residency question is hidden even though the fixture holds "yes".
    expect(inputs.persons[1]).toMatchObject({ index: 1, applying: false, resident: null, livesWithPerson1: "no" })
    expect(inputs.suppA).toMatchObject({
      needsNursingFacility: "yes",
      transfers: [{ date: "2024-03-15", amount: 3_000_000 }],
      homes: [{ ownershipType: "individual", fairMarketValue: 45_000_000 }],
      occupants: { spouse: false, childUnder21: false, disabledChild: false, dependentRelative: false },
      ownsHome: "yes",
    })
    expect(inputs.suppA?.spouseExpenses).toMatchObject({ rent: 120_000, mortgage: null, paysHeat: "yes", paysUtilities: "yes" })
    expect(inputs.assets.bankAccounts).toEqual([{ open: true, balance: 5_400_000 }])
    expect(inputs.assets.annuities).toBe(1)
    expect(inputs.health).toMatchObject({ hasMedicare: true, medigapOrPartD: true, wantsPartBHelp: "no" })
    expect(inputs.paperwork).toEqual({ signedBy: "authorizedRepresentative", ardSection: "applicantDesignates", irs4506Needed: false })
  })
})

describe("readSaca2EligibilityInputs: stale hidden answers are ignored", () => {
  it("drops income rows when hasIncome is No", () => {
    const a = completeSingleSenior()
    a.persons[0].hasIncome = "no"
    a.persons[0].income = [{ kind: "wages", amount: 9000, frequency: "monthly" }]
    expect(readSaca2EligibilityInputs(a, ON).persons[0].income).toEqual([])
  })

  it("drops bank rows when every bank gate is No", () => {
    const a = completeSingleSenior()
    a.assets.bankAccounts = [bank({ currentBalance: 50_000 })]
    expect(readSaca2EligibilityInputs(a, ON).assets.bankAccounts).toEqual([])
  })

  it("does not treat a remaining Person 2 as a spouse after married -> No", () => {
    const a = completeFacilityCouple()
    a.persons[0].isLegallyMarried = "no"
    const inputs = readSaca2EligibilityInputs(a, ON)
    expect(inputs.persons).toHaveLength(2) // Person 2 still holds data, so the step stays
    expect(inputs.hasSpouse).toBe(false)
    expect(inputs.householdSize).toBe(1)
  })

  it("does not treat Person 2 as a spouse when Person 1 is not applying (married question hidden)", () => {
    const a = completeFacilityCouple()
    a.persons[0].applyingForCoverage = "no"
    expect(readSaca2EligibilityInputs(a, ON).hasSpouse).toBe(false)
  })

  it("returns no Supplement A (and so no transfers) when long-term care is no longer selected", () => {
    const a = completeFacilityCouple()
    a.intake.programs.longTermCare = false
    a.supplements.a.needsNursingFacility = "no"
    expect(readSaca2EligibilityInputs(a, ON).suppA).toBeNull()
  })
})

describe("readSaca2EligibilityInputs: values", () => {
  it("marks a string amount invalid instead of trusting it", () => {
    const a = completeSingleSenior()
    a.persons[0].hasIncome = "yes"
    a.persons[0].income = [{ kind: "socialSecurity", amount: "1200" as unknown as number, frequency: "monthly" }]
    expect(readSaca2EligibilityInputs(a, ON).persons[0].income[0].amount).toBe(INVALID_AMOUNT)
  })

  it("computes ages on the screening date at the 64/65 and 18/19 boundaries", () => {
    const a = completeSingleSenior()
    a.persons[0].dateOfBirth = "1961-10-13"
    expect(readSaca2EligibilityInputs(a, ON).persons[0].age).toBe(65)
    a.persons[0].dateOfBirth = "1961-10-14"
    expect(readSaca2EligibilityInputs(a, ON).persons[0].age).toBe(64)

    a.persons[0].caregiverOfChildUnder19 = "yes"
    a.persons[0].caregiverChildren = [
      { name: "Test Child", dateOfBirth: "2007-10-13" },
      { name: "Test Child Two", dateOfBirth: "2007-10-14" },
    ]
    expect(readSaca2EligibilityInputs(a, ON).persons[0].childAges).toEqual([19, 18])
  })

  it("reads a closed account as closed with no current balance", () => {
    const a = completeSingleSenior()
    a.assets.gates.closedAccounts = "yes"
    a.assets.bankAccounts = [bank({ open: false, currentBalance: 700, closedOn: "2025-01-01", balanceWhenClosed: 700 })]
    expect(readSaca2EligibilityInputs(a, ON).assets.bankAccounts).toEqual([{ open: false, balance: null }])
  })
})
