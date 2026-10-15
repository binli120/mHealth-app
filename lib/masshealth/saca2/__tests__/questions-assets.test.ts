/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type AssetCategory, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")
const CATEGORIES: AssetCategory[] = [
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

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

function allNo(a: Saca2Answers) {
  for (const c of CATEGORIES) a.assets.gates[c] = "no"
}

describe("assets step", () => {
  it("is registered with root scope", () => {
    expect(getStepContent("assets")?.scope).toBe("root")
  })

  it("requires every gate question", () => {
    const errors = validateStep("assets", answers(), ON)
    expect(Object.keys(errors).sort()).toEqual(CATEGORIES.map((c) => `assets.gates.${c}`).sort())
  })

  it("is complete when every gate is no", () => {
    expect(validateStep("assets", answers(allNo), ON)).toEqual({})
  })

  it("does not block on rows left behind after a gate flips back to no", () => {
    const a = answers((x) => {
      allNo(x)
      x.assets.bankAccounts = [
        { ownerName: "", accountType: "", institution: "", accountNumber: "", currentBalance: null, balanceOnAdmissionDate: null, open: true, closedOn: null, balanceWhenClosed: null },
      ]
    })
    expect(validateStep("assets", a, ON)).toEqual({})
  })

  describe("bank accounts", () => {
    it("asks for at least one account when any bank-related gate is yes", () => {
      for (const gate of ["bankAccounts", "retirementAccounts", "closedAccounts"] as const) {
        const a = answers((x) => {
          allNo(x)
          x.assets.gates[gate] = "yes"
        })
        expect(validateStep("assets", a, ON)).toEqual({ "assets.bankAccounts": "Add at least one." })
      }
    })

    it("validates each account row", () => {
      const a = answers((x) => {
        allNo(x)
        x.assets.gates.bankAccounts = "yes"
        x.assets.bankAccounts = [
          { ownerName: "", accountType: "", institution: "", accountNumber: "", currentBalance: null, balanceOnAdmissionDate: null, open: true, closedOn: null, balanceWhenClosed: null },
        ]
      })
      expect(Object.keys(validateStep("assets", a, ON)).sort()).toEqual([
        "assets.bankAccounts.0.accountType",
        "assets.bankAccounts.0.currentBalance",
        "assets.bankAccounts.0.institution",
        "assets.bankAccounts.0.ownerName",
      ])
    })

    it("requires the closing details only for a closed account", () => {
      const row = { ownerName: "A", accountType: "checking", institution: "B", accountNumber: "1", currentBalance: 5, balanceOnAdmissionDate: null, open: false, closedOn: null, balanceWhenClosed: null }
      const a = answers((x) => {
        allNo(x)
        x.assets.gates.closedAccounts = "yes"
        x.assets.bankAccounts = [row]
      })
      expect(Object.keys(validateStep("assets", a, ON)).sort()).toEqual([
        "assets.bankAccounts.0.balanceWhenClosed",
        "assets.bankAccounts.0.closedOn",
      ])
      a.assets.bankAccounts = [{ ...row, open: true }]
      expect(validateStep("assets", a, ON)).toEqual({})
    })

    it("checks the admission-date balance only for facility applicants", () => {
      const row = { ownerName: "A", accountType: "savings", institution: "B", accountNumber: "1", currentBalance: 5, balanceOnAdmissionDate: -5, open: true, closedOn: null, balanceWhenClosed: null }
      const home = answers((x) => {
        allNo(x)
        x.assets.gates.bankAccounts = "yes"
        x.assets.bankAccounts = [row]
      })
      expect(validateStep("assets", home, ON)).toEqual({})
      const facility = answers((x) => {
        allNo(x)
        x.intake.programs.longTermCare = true
        x.assets.gates.bankAccounts = "yes"
        x.assets.bankAccounts = [row]
      })
      expect(validateStep("assets", facility, ON)).toEqual({
        "assets.bankAccounts.0.balanceOnAdmissionDate": "Enter a number that is 0 or more.",
      })
    })
  })

  describe("other categories", () => {
    function withRow<K extends keyof Saca2Answers["assets"]>(gate: AssetCategory, key: K, rows: unknown[]) {
      return answers((x) => {
        allNo(x)
        x.assets.gates[gate] = "yes"
        ;(x.assets[key] as unknown[]) = rows
      })
    }

    it("asks for rows under each yes gate (note the deposits and real-estate paths)", () => {
      const expected: Array<[AssetCategory, string]> = [
        ["primaryResidence", "assets.primaryResidence"],
        ["otherRealEstate", "assets.otherRealEstate"],
        ["lifeInsurance", "assets.lifeInsurance"],
        ["securities", "assets.securities"],
        ["annuities", "assets.annuities"],
        ["assistedLivingDeposit", "assets.assistedLivingDeposits"],
        ["vehicles", "assets.vehicles"],
        ["burial", "assets.burial"],
        ["trusts", "assets.trusts"],
      ]
      for (const [gate, path] of expected) {
        const a = answers((x) => {
          allNo(x)
          x.assets.gates[gate] = "yes"
        })
        expect(validateStep("assets", a, ON), gate).toEqual({ [path]: "Add at least one." })
      }
    })

    it("validates a real-estate row", () => {
      const a = withRow("primaryResidence", "primaryResidence", [{ address: "", propertyType: "", currentValue: null }])
      expect(Object.keys(validateStep("assets", a, ON)).sort()).toEqual([
        "assets.primaryResidence.0.address",
        "assets.primaryResidence.0.currentValue",
        "assets.primaryResidence.0.propertyType",
      ])
      const ok = withRow("primaryResidence", "primaryResidence", [{ address: "1 Example St", propertyType: "oneFamily", currentValue: 450000 }])
      expect(validateStep("assets", ok, ON)).toEqual({})
    })

    it("validates a vehicle row and accepts a complete one", () => {
      const bad = withRow("vehicles", "vehicles", [{ owner: "you", vehicleType: "", yearMakeModel: "", fairMarketValue: null, amountOwed: null }])
      expect(Object.keys(validateStep("assets", bad, ON)).sort()).toEqual([
        "assets.vehicles.0.fairMarketValue",
        "assets.vehicles.0.vehicleType",
      ])
      const ok = withRow("vehicles", "vehicles", [{ owner: "spouse", vehicleType: "Car", yearMakeModel: "2018 Honda Civic", fairMarketValue: 9000, amountOwed: 0 }])
      expect(validateStep("assets", ok, ON)).toEqual({})
    })

    it("validates a trust row and checks principal on admission only for facility applicants", () => {
      const row = { name: "Family Trust", revocable: false, currentPrincipal: 90000, principalOnAdmissionDate: -1, trustees: "", grantors: "", beneficiaries: "" }
      expect(validateStep("assets", withRow("trusts", "trusts", [row]), ON)).toEqual({})
      const facility = withRow("trusts", "trusts", [row])
      facility.intake.programs.longTermCare = true
      expect(validateStep("assets", facility, ON)).toEqual({
        "assets.trusts.0.principalOnAdmissionDate": "Enter a number that is 0 or more.",
      })
      const missing = withRow("trusts", "trusts", [{ ...row, name: "", currentPrincipal: null, principalOnAdmissionDate: null }])
      expect(Object.keys(validateStep("assets", missing, ON)).sort()).toEqual([
        "assets.trusts.0.currentPrincipal",
        "assets.trusts.0.name",
      ])
    })

    it("validates life insurance, securities, annuity, deposit, and burial rows", () => {
      expect(
        Object.keys(validateStep("assets", withRow("lifeInsurance", "lifeInsurance", [{ owners: "", company: "", policyNumber: "", faceValue: null, insuranceType: "", cashSurrenderValue: null }]), ON)).sort(),
      ).toEqual([
        "assets.lifeInsurance.0.company",
        "assets.lifeInsurance.0.faceValue",
        "assets.lifeInsurance.0.insuranceType",
        "assets.lifeInsurance.0.policyNumber",
      ])
      expect(
        Object.keys(validateStep("assets", withRow("securities", "securities", [{ kind: "stocks", owners: "", company: "", accountNumber: "", currentValue: null, valueOnAdmissionDate: null, joint: false }]), ON)),
      ).toEqual(["assets.securities.0.currentValue"])
      expect(
        Object.keys(validateStep("assets", withRow("annuities", "annuities", [{ owners: "", institution: "", contractNumber: "", purchasedOn: null }]), ON)).sort(),
      ).toEqual([
        "assets.annuities.0.contractNumber",
        "assets.annuities.0.institution",
        "assets.annuities.0.purchasedOn",
      ])
      expect(
        Object.keys(validateStep("assets", withRow("assistedLivingDeposit", "assistedLivingDeposits", [{ facilityName: "", facilityAddress: "", amount: null, depositedOn: null }]), ON)).sort(),
      ).toEqual(["assets.assistedLivingDeposits.0.amount", "assets.assistedLivingDeposits.0.facilityName"])
      expect(
        validateStep("assets", withRow("burial", "burial", [{ owner: "you", kind: "contract", amount: 5000 }]), ON),
      ).toEqual({})
    })
  })
})
