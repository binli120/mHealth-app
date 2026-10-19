/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { evaluateTransfers } from "@/lib/masshealth/saca2/eligibility/rules/transfers"
import type { Saca2SuppAInputs } from "@/lib/masshealth/saca2/eligibility/types"
import { ON, cents, makeInputs, makeSuppA } from "./helpers"

const run = (suppA: Partial<Saca2SuppAInputs> | null, on = ON) =>
  evaluateTransfers(makeInputs({ suppA: suppA === null ? null : makeSuppA(suppA) }), SACA2_FIGURES, on)
const codes = (o: { findings: Array<{ code: string }> }) => o.findings.map((f) => f.code)

describe("evaluateTransfers", () => {
  it("does not apply without Supplement A", () => {
    expect(run(null).verdict).toBe("notApplicable")
  })

  it("passes with no transfers and reports the look-back start", () => {
    const o = run({})
    expect(o.verdict).toBe("pass")
    expect(o.estimates.transfersInWindow).toEqual({ count: 0, total: 0, penaltyDays: 0, lookBackStart: "2021-10-13" })
  })

  it("counts a transfer exactly 60 months back and ignores one a day earlier", () => {
    const o = run({
      transfers: [
        { date: "2021-10-13", amount: cents(900) },
        { date: "2021-10-12", amount: cents(5000) },
      ],
    })
    expect(o.verdict).toBe("review")
    expect(o.estimates.transfersInWindow).toEqual({ count: 1, total: 900, penaltyDays: 2, lookBackStart: "2021-10-13" })
    expect(codes(o)).toContain("SACA2_TRANSFER_PENALTY_ESTIMATE")
  })

  it("rounds penalty days down ($450 a day)", () => {
    const days = (dollars: number) => run({ transfers: [{ date: "2024-03-15", amount: cents(dollars) }] }).estimates.transfersInWindow?.penaltyDays
    expect(days(1000)).toBe(2)
    expect(days(450)).toBe(1)
    expect(days(449.99)).toBe(0)
    expect(days(30000)).toBe(66)
  })

  it("reviews future dates and missing or invalid details without counting them", () => {
    const future = run({ transfers: [{ date: "2026-10-14", amount: cents(100) }] })
    expect(codes(future)).toContain("SACA2_TRANSFER_DETAILS_MISSING")
    expect(future.estimates.transfersInWindow?.total).toBe(0)
    expect(run({ transfers: [{ date: null, amount: cents(100) }] }).verdict).toBe("review")
    expect(run({ transfers: [{ date: "2024-02-30", amount: cents(100) }] }).verdict).toBe("review")
    expect(run({ transfers: [{ date: "2024-03-15", amount: INVALID_AMOUNT }] }).verdict).toBe("review")
  })

  it("reviews complex transfer answers and unanswered transfer questions", () => {
    const base = makeSuppA().transferAnswers
    expect(codes(run({ transferAnswers: { ...base, deed: "yes" } }))).toContain("SACA2_TRANSFER_COMPLEX")
    expect(codes(run({ transferAnswers: { ...base, loanOrNote: null } }))).toContain("SACA2_TRANSFER_ANSWERS_MISSING")
  })

  it("clamps the look-back start on a leap day", () => {
    expect(run({}, new Date("2028-02-29T12:00:00Z")).estimates.transfersInWindow?.lookBackStart).toBe("2023-02-28")
  })
})
