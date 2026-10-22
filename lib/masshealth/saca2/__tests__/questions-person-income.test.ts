/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { MONTH_KEYS } from "@/lib/masshealth/saca2/demographic-options"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import { INCOME_KINDS } from "@/lib/masshealth/saca2/questions/person-income"
import { resolveText } from "@/lib/masshealth/saca2/questions/types"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")
const REQ = "This question is required."

type Row = Record<string, unknown>

/** Person `idx` has income and the given rows; everything else is left empty. */
function answers(rows: Row[], idx = 0): Saca2Answers {
  const a = emptySaca2Answers()
  while (a.persons.length <= idx) a.persons.push(emptySaca2Person())
  a.persons[idx].applyingForCoverage = "yes"
  a.persons[idx].hasIncome = "yes"
  ;(a.persons[idx].income as unknown[]) = rows
  return a
}

function errs(a: Saca2Answers, idx = 0): Record<string, string> {
  const step = idx === 0 ? "person1" : "person2"
  const prefix = `persons.${idx}.income.`
  return Object.fromEntries(Object.entries(validateStep(step, a, ON)).filter(([k]) => k.startsWith(prefix)))
}
const rowKeys = (row: Row, idx = 0) =>
  Object.keys(errs(answers([row], idx), idx))
    .map((k) => k.replace(`persons.${idx}.income.0.`, ""))
    .sort()

const section = () => getStepContent("person1")!.sections.find((s) => s.id === "income")!
const repeaterQ = () => section().questions.find((q) => q.path === "income")!
const rowQuestions = (path: string) => repeaterQ().repeater!.questions.filter((q) => q.path === path)
const ctxFor = (item: Row, personIndex = 0) => ({ answers: answers([item], personIndex), personIndex, on: ON, item })

describe("income section structure", () => {
  it("keeps the section id and the three non-row questions", () => {
    expect(section().questions.map((q) => q.path)).toEqual(["hasIncome", "income", "expectedIncomeThisYear", "expectedIncomeNextYear"])
  })

  it("offers the sixteen picker kinds, without rental, including capital gains and farming/fishing", () => {
    const values = INCOME_KINDS.map((o) => o.value)
    expect(values).not.toContain("rental")
    expect(values).toEqual([
      "wages", "selfEmployment", "socialSecurity", "pension", "annuity", "trust", "unemployment", "investment",
      "royalty", "alimony", "veterans", "militaryRetirement", "otherTaxable", "capitalGains", "farmingFishing", "lottery",
    ])
    expect(INCOME_KINDS.find((o) => o.value === "capitalGains")!.label).toBe("Capital gains")
    expect(INCOME_KINDS.find((o) => o.value === "farmingFishing")!.label).toBe("Net farming or fishing income")
    expect(rowQuestions("kind")[0].options).toBe(INCOME_KINDS)
  })

  it("keeps the empty row as kind, amount, and frequency only", () => {
    expect(repeaterQ().repeater!.emptyItem()).toEqual({ kind: null, amount: null, frequency: null })
  })

  it("is not asked unless the person has income", () => {
    const a = answers([])
    a.persons[0].hasIncome = "no"
    expect(validateStep("person1", a, ON)["persons.0.income"]).toBeUndefined()
  })
})

describe("income row: required and visible fields per kind", () => {
  const FULL = { amount: 100, frequency: "monthly" }

  it.each([
    ["socialSecurity", []],
    ["annuity", []],
    ["trust", []],
    ["unemployment", []],
    ["investment", []],
    ["royalty", []],
    ["alimony", []],
    ["veterans", []],
    ["militaryRetirement", []],
    ["pension", []],
  ])("%s: only amount and frequency are required", (kind, extra) => {
    expect(rowKeys({ kind })).toEqual(["amount", "frequency", ...extra].sort())
    expect(rowKeys({ kind, ...FULL })).toEqual([])
  })

  it("wages: amount, frequency, and seasonal are required; employer details are optional", () => {
    expect(rowKeys({ kind: "wages" })).toEqual(["amount", "frequency", "seasonal"])
    expect(rowKeys({ kind: "wages", ...FULL, seasonal: "no" })).toEqual([])
  })

  it("self-employment: work type and hours are required; frequency is not", () => {
    expect(rowKeys({ kind: "selfEmployment" })).toEqual(["amount", "description", "hoursPerWeek"])
    expect(rowKeys({ kind: "selfEmployment", amount: 500, description: "Landscaping", hoursPerWeek: 30 })).toEqual([])
  })

  it.each(["capitalGains", "farmingFishing"])("%s: only the monthly net amount is required", (kind) => {
    expect(rowKeys({ kind })).toEqual(["amount"])
    expect(rowKeys({ kind, amount: 50 })).toEqual([])
  })

  it("other taxable income: the type description is required", () => {
    expect(rowKeys({ kind: "otherTaxable" })).toEqual(["amount", "description", "frequency"])
    expect(rowKeys({ kind: "otherTaxable", ...FULL, description: "Prize" })).toEqual([])
  })

  it("pension: the source is optional", () => {
    expect(rowKeys({ kind: "pension", ...FULL })).toEqual([])
  })

  it("lottery: the effective date is required and one time only is a valid frequency", () => {
    expect(rowKeys({ kind: "lottery" })).toEqual(["amount", "effectiveDate", "frequency"])
    expect(rowKeys({ kind: "lottery", amount: 100, frequency: "oneTime", effectiveDate: "2026-09-01" })).toEqual([])
  })

  it("alimony: the pre-2019 amount is optional", () => {
    expect(rowKeys({ kind: "alimony", ...FULL, preTcjaAmount: null })).toEqual([])
  })

  it("an unpicked kind asks for the kind, amount, and frequency only", () => {
    expect(rowKeys({ kind: null, amount: null, frequency: null })).toEqual(["amount", "frequency", "kind"])
  })

  it("validates the optional date and number fields when they are filled", () => {
    const row = { kind: "wages", ...FULL, seasonal: "no", effectiveDate: "2026-02-30", hoursPerWeek: -1 }
    expect(rowKeys(row)).toEqual(["effectiveDate", "hoursPerWeek"])
  })

  it("shows the extra fields only for the kinds that own them", () => {
    const visible = (kind: string) =>
      repeaterQ()
        .repeater!.questions.filter((q) => !q.visibleWhen || q.visibleWhen(ctxFor({ kind })))
        .map((q) => q.path)
        .filter((p) => !p.startsWith("season") || p === "seasonal")
        .sort()
    expect(visible("wages")).toEqual(["amount", "effectiveDate", "employerFederalTaxId", "employerNameAndAddress", "frequency", "hoursPerWeek", "kind", "seasonal"])
    expect(visible("selfEmployment")).toEqual(["amount", "description", "hoursPerWeek", "isLoss", "kind"])
    expect(visible("capitalGains")).toEqual(["amount", "isLoss", "kind"])
    expect(visible("farmingFishing")).toEqual(["amount", "hoursPerWeek", "isLoss", "kind"])
    expect(visible("pension")).toEqual(["amount", "description", "frequency", "kind"])
    expect(visible("otherTaxable")).toEqual(["amount", "description", "frequency", "kind"])
    expect(visible("alimony")).toEqual(["amount", "frequency", "kind", "preTcjaAmount"])
    expect(visible("lottery")).toEqual(["amount", "effectiveDate", "frequency", "kind"])
    expect(visible("socialSecurity")).toEqual(["amount", "frequency", "kind"])
  })
})

describe("income row: monthly-net kinds", () => {
  it.each(["selfEmployment", "capitalGains", "farmingFishing"])("%s does not require or show frequency", (kind) => {
    const ctx = ctxFor({ kind })
    const freq = rowQuestions("frequency")[0]
    expect(freq.visibleWhen!(ctx)).toBe(false)
    expect(rowKeys({ kind, amount: 1, description: "x", hoursPerWeek: 1 })).not.toContain("frequency")
  })

  it.each(["selfEmployment", "capitalGains", "farmingFishing"])("%s labels the amount as monthly net income or loss", (kind) => {
    const amount = rowQuestions("amount")[0]
    expect(resolveText(amount.label, ctxFor({ kind }))).toBe("Average monthly net income or loss ($)")
    expect(resolveText(amount.help, ctxFor({ kind }))).toMatch(/profit after business expenses/i)
    const loss = rowQuestions("isLoss")[0]
    expect(resolveText(loss.label, ctxFor({ kind }))).toBe("This is a monthly loss, not a profit")
    expect(loss.visibleWhen!(ctxFor({ kind }))).toBe(true)
  })

  it.each(["wages", "pension", "lottery", "alimony", null])("%s keeps the amount-before-taxes label and has no loss box", (kind) => {
    const amount = rowQuestions("amount")[0]
    expect(resolveText(amount.label, ctxFor({ kind }))).toBe("Amount before taxes ($)")
    expect(resolveText(amount.help, ctxFor({ kind }))).toBe("")
    expect(rowQuestions("isLoss")[0].visibleWhen!(ctxFor({ kind }))).toBe(false)
  })

  it("a stale frequency left on a monthly-net row produces nothing", () => {
    expect(rowKeys({ kind: "capitalGains", amount: 5, frequency: "bogus" })).toEqual([])
  })

  it("switching a row from wages to self-employment drops the wage-only requirements", () => {
    expect(rowKeys({ kind: "selfEmployment", amount: 5, description: "x", hoursPerWeek: 2, seasonal: null, employerNameAndAddress: "Acme" })).toEqual([])
  })
})

describe("income row: seasonal employment", () => {
  const WAGES = { kind: "wages", amount: 100, frequency: "monthly" }

  it("requires at least one month when seasonal is yes, reported on the seasonal answer", () => {
    const a = answers([{ ...WAGES, seasonal: "yes" }])
    expect(errs(a)).toEqual({ "persons.0.income.0.seasonal": "Select at least one month." })
  })

  it.each(MONTH_KEYS)("ticking %s clears the error", (month) => {
    const key = `season${month[0].toUpperCase()}${month.slice(1)}`
    expect(errs(answers([{ ...WAGES, seasonal: "yes", [key]: true }]))).toEqual({})
  })

  it("a month set to false does not count", () => {
    expect(Object.keys(errs(answers([{ ...WAGES, seasonal: "yes", seasonJan: false }])))).toEqual(["persons.0.income.0.seasonal"])
  })

  it("shows the twelve month checkboxes only for seasonal wages, labelled with month names", () => {
    const months = repeaterQ().repeater!.questions.filter((q) => q.kind === "checkbox" && q.path.startsWith("season"))
    expect(months.map((q) => q.path)).toEqual(MONTH_KEYS.map((m) => `season${m[0].toUpperCase()}${m.slice(1)}`))
    expect(months.map((q) => resolveText(q.label, ctxFor({})))).toEqual([
      "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
    ])
    const shown = (item: Row) => months.every((q) => q.visibleWhen!(ctxFor(item)))
    const hidden = (item: Row) => months.every((q) => !q.visibleWhen!(ctxFor(item)))
    expect(shown({ ...WAGES, seasonal: "yes" })).toBe(true)
    expect(hidden({ ...WAGES, seasonal: "no" })).toBe(true)
    expect(hidden({ ...WAGES, seasonal: null })).toBe(true)
    expect(hidden({ kind: "pension", seasonal: "yes" })).toBe(true)
  })

  it("a stale seasonal=no with months left ticked produces nothing", () => {
    expect(errs(answers([{ ...WAGES, seasonal: "no", seasonJan: true, seasonFeb: true }]))).toEqual({})
  })

  it("a stale seasonal=yes left on a non-wages row produces nothing", () => {
    expect(rowKeys({ kind: "pension", amount: 1, frequency: "monthly", seasonal: "yes" })).toEqual([])
  })

  it("switching wages to pension with leftover employer fields produces nothing", () => {
    const row = {
      kind: "pension", amount: 1, frequency: "monthly",
      employerNameAndAddress: "Acme", employerFederalTaxId: "12-3456789", effectiveDate: "not-a-date",
      hoursPerWeek: -5, seasonal: "yes", seasonJan: false,
    }
    expect(rowKeys(row)).toEqual([])
  })

  it("keeps each row's error on its own path", () => {
    const a = answers([{ ...WAGES, seasonal: "yes", seasonMay: true }, { ...WAGES, seasonal: "yes" }])
    expect(errs(a)).toEqual({ "persons.0.income.1.seasonal": "Select at least one month." })
  })
})

describe("income row: Person 2", () => {
  it("asks Person 2's seasonal question in the third person and validates on Person 2's path", () => {
    const a = answers([{ kind: "wages", amount: 1, frequency: "monthly", seasonal: "yes" }], 1)
    expect(a.persons).toHaveLength(2)
    expect(errs(a, 1)).toEqual({ "persons.1.income.0.seasonal": "Select at least one month." })
    expect(errs(a, 0)).toEqual({})
    const q = rowQuestions("seasonal")[0]
    expect(resolveText(q.label, ctxFor({}, 0))).toBe("Are you seasonally employed?")
    expect(resolveText(q.label, ctxFor({}, 1))).toBe("Is this person seasonally employed?")
  })

  it("requires the same self-employment fields for Person 2", () => {
    expect(rowKeys({ kind: "selfEmployment" }, 1)).toEqual(["amount", "description", "hoursPerWeek"])
  })

  it("keeps the section wording and gates for both people", () => {
    const hasIncome = section().questions[0]
    expect(resolveText(hasIncome.label, { answers: answers([]), personIndex: 0, on: ON })).toBe("Do you have any income?")
    expect(resolveText(hasIncome.label, { answers: answers([], 1), personIndex: 1, on: ON })).toBe("Does this person have any income?")
    const a = answers([], 1)
    expect(validateStep("person2", a, ON)["persons.1.income"]).toBe("Add at least one.")
    expect(validateStep("person2", a, ON)["persons.1.expectedIncomeThisYear"]).toBe(REQ)
  })
})

describe("income row: farming and fishing weekly hours", () => {
  const hours = () => rowQuestions("hoursPerWeek")[0]

  it("shows the hours field for farming and fishing", () => {
    expect(hours().visibleWhen!(ctxFor({ kind: "farmingFishing" }))).toBe(true)
  })

  it("does not require hours, but still validates a filled value", () => {
    expect(rowKeys({ kind: "farmingFishing", amount: 50 })).toEqual([])
    expect(rowKeys({ kind: "farmingFishing", amount: 50, hoursPerWeek: null })).toEqual([])
    expect(rowKeys({ kind: "farmingFishing", amount: 50, hoursPerWeek: -2 })).toEqual(["hoursPerWeek"])
    expect(rowKeys({ kind: "farmingFishing", amount: 50, hoursPerWeek: 20 })).toEqual([])
  })

  it.each(["capitalGains", "pension", "lottery", "alimony", "socialSecurity", null])("keeps hours hidden for %s", (kind) => {
    expect(hours().visibleWhen!(ctxFor({ kind }))).toBe(false)
  })

  it("keeps the monthly-net label, loss box, and no frequency alongside hours", () => {
    const ctx = ctxFor({ kind: "farmingFishing", hoursPerWeek: 10 })
    expect(resolveText(rowQuestions("amount")[0].label, ctx)).toBe("Average monthly net income or loss ($)")
    expect(rowQuestions("isLoss")[0].visibleWhen!(ctx)).toBe(true)
    expect(rowQuestions("frequency")[0].visibleWhen!(ctx)).toBe(false)
    expect(rowKeys({ kind: "farmingFishing", amount: 5, isLoss: true, hoursPerWeek: 10 })).toEqual([])
  })

  it("leaves hours required for self-employment and optional for wages", () => {
    expect(rowKeys({ kind: "selfEmployment", amount: 1, description: "x" })).toEqual(["hoursPerWeek"])
    expect(rowKeys({ kind: "wages", amount: 1, frequency: "monthly", seasonal: "no" })).toEqual([])
  })
})
