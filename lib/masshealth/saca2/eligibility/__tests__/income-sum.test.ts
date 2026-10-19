/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { monthlyIncomeOf } from "@/lib/masshealth/saca2/eligibility/income-sum"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { cents, incomeLine, makePerson } from "./helpers"

describe("monthlyIncomeOf", () => {
  it("is 0 for No income and unknown for an unanswered income question", () => {
    expect(monthlyIncomeOf(makePerson({ hasIncome: "no" }))).toEqual({ cents: 0, oneTimeIncome: false })
    expect(monthlyIncomeOf(makePerson({ hasIncome: null })).cents).toBeNull()
  })

  it("adds recurring income normalized to monthly", () => {
    const p = makePerson({
      hasIncome: "yes",
      income: [incomeLine("wages", 250, "weekly"), incomeLine("pension", 3000, "quarterly"), incomeLine("investment", 1200, "yearly")],
    })
    expect(monthlyIncomeOf(p).cents).toBe(108_333 + 100_000 + 10_000)
  })

  it("subtracts monthly-net losses and rental losses, never below 0", () => {
    const p = makePerson({
      hasIncome: "yes",
      income: [incomeLine("socialSecurity", 1000), incomeLine("selfEmployment", 300, null, true)],
      rental: [{ amount: cents(200), isLoss: false }],
    })
    expect(monthlyIncomeOf(p).cents).toBe(90_000)
    const loss = makePerson({ hasIncome: "yes", income: [incomeLine("selfEmployment", 300, null, true)] })
    expect(monthlyIncomeOf(loss).cents).toBe(0)
  })

  it("skips one-time income but flags it, including listed one-time payments", () => {
    const p = makePerson({ hasIncome: "yes", income: [incomeLine("lottery", 5000, "oneTime"), incomeLine("socialSecurity", 1000)] })
    expect(monthlyIncomeOf(p)).toEqual({ cents: 100_000, oneTimeIncome: true })
    expect(monthlyIncomeOf(makePerson({ hasIncome: "yes", oneTimeIncomeThisYear: 1 })).oneTimeIncome).toBe(true)
  })

  it("is unknown when an amount or a recurring frequency is missing or invalid", () => {
    expect(monthlyIncomeOf(makePerson({ hasIncome: "yes", income: [incomeLine("pension", 100, null)] })).cents).toBeNull()
    expect(monthlyIncomeOf(makePerson({ hasIncome: "yes", income: [{ kind: "pension", amount: null, frequency: "monthly", isLoss: false }] })).cents).toBeNull()
    expect(monthlyIncomeOf(makePerson({ hasIncome: "yes", rental: [{ amount: INVALID_AMOUNT, isLoss: false }] })).cents).toBeNull()
  })

  it("is unknown when income is answered Yes but no income rows were listed", () => {
    expect(monthlyIncomeOf(makePerson({ hasIncome: "yes" })).cents).toBeNull()
  })
})
