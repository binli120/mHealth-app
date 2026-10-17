/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { DEDUCTION_KEYS, DEDUCTION_LABELS } from "@/lib/masshealth/saca2/demographic-options"
import { getStepContent, validateStep } from "@/lib/masshealth/saca2/questions"
import {
  DEDUCTIONS_SECTION,
  ONE_TIME_SECTION,
  RENTAL_SECTION,
  validateDeductions,
} from "@/lib/masshealth/saca2/questions/person-income-extras"
import { resolveText } from "@/lib/masshealth/saca2/questions/types"
import {
  emptySaca2Answers,
  emptySaca2Person,
  type OneTimeIncomeItem,
  type RentalUnit,
  type Saca2Answers,
} from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")
const REQ = "This question is required."
const NONE_ERR = "Check None or enter at least one deduction."

type Row = Record<string, unknown>

/** Person `idx` is really pushed onto the answers; income gate defaults to yes. */
function answers(idx = 0, hasIncome: "yes" | "no" | null = "yes"): Saca2Answers {
  const a = emptySaca2Answers()
  while (a.persons.length <= idx) a.persons.push(emptySaca2Person())
  a.persons[idx].applyingForCoverage = "yes"
  a.persons[idx].hasIncome = hasIncome
  return a
}

function errsFor(a: Saca2Answers, prefixes: string[], idx = 0): Record<string, string> {
  const step = idx === 0 ? "person1" : "person2"
  return Object.fromEntries(
    Object.entries(validateStep(step, a, ON)).filter(([k]) => prefixes.some((p) => k.startsWith(`persons.${idx}.${p}`))),
  )
}
const rentalErrs = (a: Saca2Answers, idx = 0) => errsFor(a, ["rental"], idx)
const oneTimeErrs = (a: Saca2Answers, idx = 0) => errsFor(a, ["oneTimeIncome"], idx)
const deductionErrs = (a: Saca2Answers, idx = 0) => errsFor(a, ["deductions"], idx)
const keys = (e: Record<string, string>, idx = 0) => Object.keys(e).map((k) => k.replace(`persons.${idx}.`, "")).sort()

const ctx = (a: Saca2Answers, personIndex = 0, item?: Row) => ({ answers: a, personIndex, on: ON, item })
const find = (section: { questions: { path: string }[] }, path: string) =>
  section.questions.find((q) => q.path === path)! as ReturnType<typeof Object.create>

const UNIT: RentalUnit = { address: "5 Elm St", unit: "", amount: 800, isLoss: false, ownerOccupied: "no" }
const ITEM: OneTimeIncomeItem = { type: "Lump-sum pension", amount: 1000, month: 3, year: 2026 }

/** A fully valid rental chain for Person `idx`. */
function withRental(idx = 0, units: Row[] = [UNIT]): Saca2Answers {
  const a = answers(idx)
  a.persons[idx].rental = {
    hasRentalIncome: "yes",
    realEstateType: "twoFamily",
    realEstateTypeOther: "",
    units: units as unknown as RentalUnit[],
    paysHeatOrUtilities: "no",
  }
  return a
}

describe("section wiring", () => {
  it("appends rental, one-time, and deductions after income in the person step", () => {
    const ids = getStepContent("person1")!.sections.map((s) => s.id)
    expect(ids.slice(ids.indexOf("income"))).toEqual(["income", "rental", "oneTime", "deductions"])
    const sections = getStepContent("person1")!.sections
    expect(sections.find((s) => s.id === "rental")).toBe(RENTAL_SECTION)
    expect(sections.find((s) => s.id === "oneTime")).toBe(ONE_TIME_SECTION)
    expect(sections.find((s) => s.id === "deductions")).toBe(DEDUCTIONS_SECTION)
  })

  it("lists the exact question paths", () => {
    expect(RENTAL_SECTION.questions.map((q) => q.path)).toEqual([
      "rental.hasRentalIncome", "rental.realEstateType", "rental.realEstateTypeOther", "rental.units", "rental.paysHeatOrUtilities",
    ])
    expect(ONE_TIME_SECTION.questions.map((q) => q.path)).toEqual([
      "oneTimeIncome.thisYear", "oneTimeIncome.thisYearItems", "oneTimeIncome.nextYear", "oneTimeIncome.nextYearItems",
    ])
    expect(DEDUCTIONS_SECTION.questions.map((q) => q.path)).toEqual([
      "deductions.none", ...DEDUCTION_KEYS.map((k) => `deductions.amounts.${k}`),
    ])
  })
})

describe("rental income (Q29)", () => {
  it("is not asked unless the person has income, even with a stale yes", () => {
    for (const hasIncome of ["no", null] as const) {
      const a = answers(0, hasIncome)
      a.persons[0].rental.hasRentalIncome = "yes"
      expect(rentalErrs(a)).toEqual({})
    }
  })

  it("asks only the gate question when income is yes and nothing is answered", () => {
    expect(keys(rentalErrs(answers()))).toEqual(["rental.hasRentalIncome"])
    expect(rentalErrs(answers())["persons.0.rental.hasRentalIncome"]).toBe(REQ)
  })

  it("answering no needs nothing more, and stale detail is ignored", () => {
    const a = withRental(0, [{ address: "", amount: null }])
    a.persons[0].rental.hasRentalIncome = "no"
    expect(rentalErrs(a)).toEqual({})
  })

  it("answering yes requires the type, the units, and the heat question", () => {
    const a = answers()
    a.persons[0].rental.hasRentalIncome = "yes"
    expect(keys(rentalErrs(a))).toEqual(["rental.paysHeatOrUtilities", "rental.realEstateType", "rental.units"])
    expect(rentalErrs(a)["persons.0.rental.units"]).toBe("Add at least one.")
  })

  it("a complete chain has no errors", () => {
    expect(rentalErrs(withRental())).toEqual({})
  })

  it("requires the description only for the other real estate type", () => {
    const a = withRental()
    a.persons[0].rental.realEstateType = "other"
    expect(keys(rentalErrs(a))).toEqual(["rental.realEstateTypeOther"])
    a.persons[0].rental.realEstateTypeOther = "Duplex"
    expect(rentalErrs(a)).toEqual({})
    for (const t of ["oneFamily", "twoFamily", "threeFamily"] as const) {
      const b = withRental()
      b.persons[0].rental.realEstateType = t
      expect(rentalErrs(b)).toEqual({})
    }
  })

  it("offers the four real estate types", () => {
    expect(find(RENTAL_SECTION, "rental.realEstateType").options.map((o: { value: string }) => o.value)).toEqual([
      "oneFamily", "twoFamily", "threeFamily", "other",
    ])
  })

  it("validates each unit row: address, amount, and owner-occupied are required; unit and loss are not", () => {
    const a = withRental(0, [{ address: "", unit: "", amount: null, isLoss: false, ownerOccupied: null }])
    expect(keys(rentalErrs(a))).toEqual([
      "rental.units.0.address", "rental.units.0.amount", "rental.units.0.ownerOccupied",
    ])
    expect(rentalErrs(withRental(0, [{ ...UNIT, unit: "2B", isLoss: true }]))).toEqual({})
  })

  it("rejects a negative amount and keeps each row's error on its own index", () => {
    const a = withRental(0, [UNIT, { ...UNIT, amount: -5 }])
    expect(keys(rentalErrs(a))).toEqual(["rental.units.1.amount"])
  })

  it("repeater config: max 6, empty row matches RentalUnit", () => {
    const cfg = find(RENTAL_SECTION, "rental.units").repeater
    expect(cfg.maxItems).toBe(6)
    const empty: RentalUnit = cfg.emptyItem()
    expect(empty).toEqual({ address: "", unit: "", amount: null, isLoss: false, ownerOccupied: null })
  })

  it("gates the detail questions on the yes answer only", () => {
    const yes = withRental()
    const no = withRental()
    no.persons[0].rental.hasRentalIncome = "no"
    for (const path of ["rental.realEstateType", "rental.units", "rental.paysHeatOrUtilities"]) {
      expect(find(RENTAL_SECTION, path).visibleWhen(ctx(yes))).toBe(true)
      expect(find(RENTAL_SECTION, path).visibleWhen(ctx(no))).toBe(false)
    }
  })

  it("Person 2: same rules on Person 2's path, wording in the third person", () => {
    const a = answers(1)
    a.persons[1].rental.hasRentalIncome = "yes"
    expect(a.persons).toHaveLength(2)
    expect(keys(rentalErrs(a, 1), 1)).toEqual(["rental.paysHeatOrUtilities", "rental.realEstateType", "rental.units"])
    expect(rentalErrs(a, 0)).toEqual({})
    const gate = find(RENTAL_SECTION, "rental.hasRentalIncome")
    expect(resolveText(gate.label, ctx(a, 0))).toBe("Do you get rental income?")
    expect(resolveText(gate.label, ctx(a, 1))).toBe("Does this person get rental income?")
    const heat = find(RENTAL_SECTION, "rental.paysHeatOrUtilities")
    expect(resolveText(heat.label, ctx(a, 0))).toBe("Do you pay for heat or utilities for your tenant?")
    expect(resolveText(heat.label, ctx(a, 1))).toBe("Does this person pay for heat or utilities for their tenant?")
  })

  it("Person 2 without income is not asked, even though Person 1 has income", () => {
    const a = answers(1, "no")
    a.persons[0].hasIncome = "yes"
    a.persons[1].rental.hasRentalIncome = "yes"
    expect(rentalErrs(a, 1)).toEqual({})
  })
})

describe("one-time-only income (Q30-31)", () => {
  it("this year is hidden without income; next year is always required", () => {
    for (const hasIncome of ["no", null] as const) {
      const a = answers(0, hasIncome)
      a.persons[0].oneTimeIncome.thisYear = "yes"
      expect(keys(oneTimeErrs(a))).toEqual(["oneTimeIncome.nextYear"])
    }
  })

  it("with income, both gates are required", () => {
    expect(keys(oneTimeErrs(answers()))).toEqual(["oneTimeIncome.nextYear", "oneTimeIncome.thisYear"])
  })

  it("applies to a person who is not applying, too", () => {
    const a = answers(0, "no")
    a.persons[0].applyingForCoverage = "no"
    expect(keys(oneTimeErrs(a))).toEqual(["oneTimeIncome.nextYear"])
  })

  it("no on both needs nothing more", () => {
    const a = answers()
    a.persons[0].oneTimeIncome.thisYear = "no"
    a.persons[0].oneTimeIncome.nextYear = "no"
    expect(oneTimeErrs(a)).toEqual({})
  })

  it("yes requires its own items repeater, and stale items under no are ignored", () => {
    const a = answers()
    a.persons[0].oneTimeIncome.thisYear = "yes"
    a.persons[0].oneTimeIncome.nextYear = "yes"
    expect(keys(oneTimeErrs(a))).toEqual(["oneTimeIncome.nextYearItems", "oneTimeIncome.thisYearItems"])
    a.persons[0].oneTimeIncome.thisYear = "no"
    a.persons[0].oneTimeIncome.thisYearItems = [{ type: "", amount: null, month: 99, year: 1 }]
    expect(keys(oneTimeErrs(a))).toEqual(["oneTimeIncome.nextYearItems"])
  })

  it("a valid this-year item and next-year item pass at ON 2026-10-13", () => {
    const a = answers()
    a.persons[0].oneTimeIncome = {
      thisYear: "yes", thisYearItems: [{ ...ITEM, year: 2026 }],
      nextYear: "yes", nextYearItems: [{ ...ITEM, year: 2027 }],
    }
    expect(oneTimeErrs(a)).toEqual({})
  })

  it("requires type, amount, month, and year on each item", () => {
    const a = answers()
    a.persons[0].oneTimeIncome = {
      thisYear: "yes", thisYearItems: [{ type: "", amount: null, month: null, year: null }],
      nextYear: "no", nextYearItems: [],
    }
    expect(keys(oneTimeErrs(a))).toEqual([
      "oneTimeIncome.thisYearItems.0.amount", "oneTimeIncome.thisYearItems.0.month",
      "oneTimeIncome.thisYearItems.0.type", "oneTimeIncome.thisYearItems.0.year",
    ])
  })

  it.each([0, 13, 1.5, -1])("rejects month %s", (month) => {
    const a = answers()
    a.persons[0].oneTimeIncome = { thisYear: "yes", thisYearItems: [{ ...ITEM, month }], nextYear: "no", nextYearItems: [] }
    expect(keys(oneTimeErrs(a))).toEqual(["oneTimeIncome.thisYearItems.0.month"])
  })

  it.each([1, 12])("accepts month %s", (month) => {
    const a = answers()
    a.persons[0].oneTimeIncome = { thisYear: "yes", thisYearItems: [{ ...ITEM, month }], nextYear: "no", nextYearItems: [] }
    expect(oneTimeErrs(a)).toEqual({})
  })

  it("this year must be exactly the current calendar year of ctx.on", () => {
    const run = (year: number) => {
      const a = answers()
      a.persons[0].oneTimeIncome = { thisYear: "yes", thisYearItems: [{ ...ITEM, year }], nextYear: "no", nextYearItems: [] }
      return keys(oneTimeErrs(a))
    }
    expect(run(2025)).toEqual(["oneTimeIncome.thisYearItems.0.year"])
    expect(run(2027)).toEqual(["oneTimeIncome.thisYearItems.0.year"])
    expect(run(2026.5)).toEqual(["oneTimeIncome.thisYearItems.0.year"])
    expect(run(2026)).toEqual([])
  })

  it("next year must be exactly the year after ctx.on", () => {
    const run = (year: number) => {
      const a = answers()
      a.persons[0].oneTimeIncome = { thisYear: "no", thisYearItems: [], nextYear: "yes", nextYearItems: [{ ...ITEM, year }] }
      return keys(oneTimeErrs(a))
    }
    expect(run(2026)).toEqual(["oneTimeIncome.nextYearItems.0.year"])
    expect(run(2028)).toEqual(["oneTimeIncome.nextYearItems.0.year"])
    expect(run(2027)).toEqual([])
  })

  it("takes the year from ctx.on, not the system clock", () => {
    const a = answers()
    a.persons[0].oneTimeIncome = { thisYear: "yes", thisYearItems: [{ ...ITEM, year: 2031 }], nextYear: "no", nextYearItems: [] }
    const later = new Date("2031-02-01T12:00:00Z")
    const errs = Object.keys(validateStep("person1", a, later)).filter((k) => k.startsWith("persons.0.oneTimeIncome"))
    expect(errs).toEqual([])
  })

  it("repeater config: max 4, empty row matches OneTimeIncomeItem", () => {
    for (const path of ["oneTimeIncome.thisYearItems", "oneTimeIncome.nextYearItems"]) {
      const cfg = find(ONE_TIME_SECTION, path).repeater
      expect(cfg.maxItems).toBe(4)
      const empty: OneTimeIncomeItem = cfg.emptyItem()
      expect(empty).toEqual({ type: "", amount: null, month: null, year: null })
    }
  })

  it("Person 2: gates and year checks run on Person 2's path with third-person wording", () => {
    const a = answers(1)
    a.persons[1].oneTimeIncome = { thisYear: "yes", thisYearItems: [{ ...ITEM, year: 2025 }], nextYear: null, nextYearItems: [] }
    expect(a.persons).toHaveLength(2)
    expect(keys(oneTimeErrs(a, 1), 1)).toEqual(["oneTimeIncome.nextYear", "oneTimeIncome.thisYearItems.0.year"])
    expect(oneTimeErrs(a, 0)).toHaveProperty(["persons.0.oneTimeIncome.nextYear"])
    // Person 1 has no income answered here, so only the always-asked next-year gate applies.
    expect(keys(oneTimeErrs(a, 0))).toEqual(["oneTimeIncome.nextYear"])
    const q30 = find(ONE_TIME_SECTION, "oneTimeIncome.thisYear")
    expect(resolveText(q30.label, ctx(a, 0))).toBe("Have you or will you receive income during this calendar year as a one-time only payment?")
    expect(resolveText(q30.label, ctx(a, 1))).toBe("Has or will this person receive income during this calendar year as a one-time only payment?")
    const q31 = find(ONE_TIME_SECTION, "oneTimeIncome.nextYear")
    expect(resolveText(q31.label, ctx(a, 0))).toBe("Will you receive income during the next calendar year as a one-time only payment?")
    expect(resolveText(q31.label, ctx(a, 1))).toBe("Will this person receive income during the next calendar year as a one-time only payment?")
  })

  it("Person 2 without income still answers next year", () => {
    const a = answers(1, "no")
    expect(keys(oneTimeErrs(a, 1), 1)).toEqual(["oneTimeIncome.nextYear"])
  })
})

describe("deductions (Q32)", () => {
  it("empty deductions give the single None error, on the none path", () => {
    expect(deductionErrs(answers())).toEqual({ "persons.0.deductions.none": NONE_ERR })
    expect(deductionErrs(answers(0, "no"))).toEqual({ "persons.0.deductions.none": NONE_ERR })
  })

  it("ticking None clears it", () => {
    const a = answers()
    a.persons[0].deductions.none = true
    expect(deductionErrs(a)).toEqual({})
  })

  it("one amount clears it, including zero", () => {
    for (const v of [100, 0]) {
      const a = answers()
      a.persons[0].deductions.amounts.hsa = v
      expect(deductionErrs(a)).toEqual({})
    }
  })

  it("generates eleven amount questions labelled from DEDUCTION_LABELS", () => {
    const amounts = DEDUCTIONS_SECTION.questions.filter((q) => q.path.startsWith("deductions.amounts."))
    expect(amounts).toHaveLength(11)
    amounts.forEach((q, i) => {
      expect(q.kind).toBe("money")
      expect(q.required).toBeFalsy()
      expect(resolveText(q.label, ctx(answers()))).toBe(`${DEDUCTION_LABELS[DEDUCTION_KEYS[i]]}: yearly amount ($)`)
    })
  })

  it("shows the amounts only while None is not ticked, and a stale amount under None is ignored", () => {
    const a = answers()
    const amountQ = find(DEDUCTIONS_SECTION, "deductions.amounts.ira")
    expect(amountQ.visibleWhen(ctx(a))).toBe(true)
    a.persons[0].deductions.none = true
    a.persons[0].deductions.amounts.ira = -50
    expect(amountQ.visibleWhen(ctx(a))).toBe(false)
    expect(deductionErrs(a)).toEqual({})
  })

  it("rejects a negative amount", () => {
    const a = answers()
    a.persons[0].deductions.amounts.studentLoanInterest = -1
    expect(keys(deductionErrs(a))).toEqual(["deductions.amounts.studentLoanInterest"])
  })

  it("is always asked: a non-applying person without income still needs None or an amount", () => {
    const a = answers(0, null)
    a.persons[0].applyingForCoverage = "no"
    expect(deductionErrs(a)).toEqual({ "persons.0.deductions.none": NONE_ERR })
  })

  it("validateDeductions returns {} for a missing person", () => {
    expect(validateDeductions(emptySaca2Answers(), 3)).toEqual({})
  })

  it("Person 2: error lands on Person 2's path only, and Person 1's None does not leak", () => {
    const a = answers(1)
    a.persons[0].deductions.none = true
    expect(a.persons).toHaveLength(2)
    expect(deductionErrs(a, 1)).toEqual({ "persons.1.deductions.none": NONE_ERR })
    expect(deductionErrs(a, 0)).toEqual({})
    expect(validateDeductions(a, 1)).toEqual({ "persons.1.deductions.none": NONE_ERR })
    const heading = find(DEDUCTIONS_SECTION, "deductions.none")
    expect(resolveText(heading.label, ctx(a, 0))).toBe("None")
  })

  it("wording for the section description follows the person", () => {
    const a = answers(1)
    const d = DEDUCTIONS_SECTION.description!
    expect(resolveText(d, ctx(a, 0))).toMatch(/^What deductions do you report on your income tax return\?/)
    expect(resolveText(d, ctx(a, 1))).toMatch(/^What deductions does this person report on their income tax return\?/)
  })
})
