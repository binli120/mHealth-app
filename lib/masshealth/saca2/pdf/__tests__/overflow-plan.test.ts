/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"

import { completeFacilityCouple, completeRichHousehold, completeSingleSenior } from "../../__tests__/complete-answers"
import type { Saca2Answers, Saca2Person } from "../../types"
import {
  buildOverflowSheets,
  OVERFLOW_COLLECTORS,
  overflowHeader,
  type OverflowCollector,
} from "../overflow-plan"

const ON = new Date("2026-10-13T12:00:00Z")

const INCOME_COLUMNS = ["Income type", "Employer or description", "Amount ($)", "How often", "Other details"]
const RENTAL_COLUMNS = ["Unit", "Address", "Unit #", "Monthly income ($)", "Monthly loss ($)", "Owner-occupied"]
const ONE_TIME_COLUMNS = ["When", "Type", "Amount ($)", "Month received", "Year received"]
const NOTE_COLUMNS = ["Person", "Note"]

type Income = Saca2Person["income"][number]
const income = (item: Partial<Income>): Income => ({ kind: "wages", amount: null, frequency: null, ...item }) as Income

/** Person 1 has every kind of overflow; Person 2 (Pedro) has some of his own. */
function overflowing(): Saca2Answers {
  const a = completeRichHousehold()
  const p1 = a.persons[0]
  p1.hasIncome = "yes"
  p1.isTraffickingOrBatteredVictim = "yes"
  p1.income = [
    // first wages row: on the form, but its frequency has no box
    income({ kind: "wages", amount: 2000, frequency: "oneTime", employerNameAndAddress: "Acme, 9 Work Rd", seasonal: "no" }),
    income({
      kind: "wages",
      amount: 500,
      frequency: "weekly",
      employerNameAndAddress: "Beta Shop, 2 Main St",
      employerFederalTaxId: "12-3456789",
      effectiveDate: "2026-02-01",
      hoursPerWeek: 20,
      seasonal: "no",
    }),
    income({
      kind: "wages",
      amount: 300,
      frequency: "monthly",
      employerNameAndAddress: "Gamma Inc",
      seasonal: "yes",
      seasonJun: true,
      seasonJul: true,
    }),
    income({ kind: "pension", amount: 300, frequency: "monthly", description: "Fund A" }),
    income({ kind: "pension", amount: 150.5, frequency: "quarterly", description: "Fund B" }),
    income({ kind: "selfEmployment", amount: 800, hoursPerWeek: 10, description: "House cleaning" }),
    income({ kind: "selfEmployment", amount: 200, isLoss: true, hoursPerWeek: 5, description: "Dog walking" }),
    income({ kind: "lottery", amount: 900, frequency: "quarterly", effectiveDate: "2026-05-01" }),
  ]
  p1.rental = {
    ...p1.rental,
    hasRentalIncome: "yes",
    units: [
      { address: "1 First St", unit: "1", amount: 1000, isLoss: false, ownerOccupied: "no" },
      { address: "2 Second St", unit: "", amount: 900, isLoss: false, ownerOccupied: "yes" },
      { address: "3 Third St", unit: "3C", amount: 700, isLoss: true, ownerOccupied: "no" },
      { address: "4 Fourth St", unit: "4D", amount: 650.25, isLoss: false, ownerOccupied: "yes" },
    ],
  }
  p1.oneTimeIncome = {
    thisYear: "yes",
    thisYearItems: [
      { type: "Settlement", amount: 2500, month: 3, year: 2026 },
      { type: "Bonus", amount: 1500, month: 6, year: 2026 },
      { type: "Gift", amount: 99.99, month: 12, year: 2026 },
    ],
    nextYear: "no",
    nextYearItems: [],
  }

  const p2 = a.persons[1]
  p2.hasIncome = "yes"
  // the trafficking question is only asked of noncitizens
  p2.usCitizenOrNational = "no"
  p2.naturalizedCitizen = null
  p2.isTraffickingOrBatteredVictim = "yes"
  p2.income = [
    income({ kind: "wages", amount: 700, frequency: "weekly", employerNameAndAddress: "Globex", seasonal: "no" }),
    income({ kind: "wages", amount: 450, frequency: "every2weeks", employerNameAndAddress: "Initech", seasonal: "no" }),
  ]
  p2.rental = {
    ...p2.rental,
    hasRentalIncome: "yes",
    units: [
      { address: "5 Fifth St", unit: "", amount: 100, isLoss: false, ownerOccupied: "no" },
      { address: "6 Sixth St", unit: "", amount: 200, isLoss: false, ownerOccupied: "no" },
      { address: "7 Seventh St", unit: "7", amount: 300, isLoss: false, ownerOccupied: "yes" },
    ],
  }
  p2.oneTimeIncome = {
    thisYear: "no",
    thisYearItems: [],
    nextYear: "yes",
    nextYearItems: [
      { type: "Inheritance", amount: 5000, month: 1, year: 2027 },
      { type: "Prize", amount: 250, month: 4, year: 2027 },
    ],
  }
  return a
}

describe("buildOverflowSheets", () => {
  it("collects exactly what the form cannot hold, in a fixed order, tagged by person", () => {
    expect(buildOverflowSheets(overflowing(), ON)).toEqual([
      {
        title: "Person 1 additional income",
        columns: INCOME_COLUMNS,
        rows: [
          ["Wages or salary", "Beta Shop, 2 Main St", "500", "Weekly", "Employer tax ID 12-3456789; effective date 02/01/2026; 20 hours a week"],
          ["Wages or salary", "Gamma Inc", "300", "Monthly", "Seasonal: June, July"],
          ["Retirement or pension", "Fund B", "150.50", "Quarterly", ""],
          ["Self-employment", "Dog walking", "200", "Monthly average net", "Loss; 5 hours a week"],
        ],
      },
      {
        title: "Person 2 additional income",
        columns: INCOME_COLUMNS,
        rows: [["Wages or salary", "Initech", "450", "Every 2 weeks", ""]],
      },
      {
        title: "Person 1 additional rental units",
        columns: RENTAL_COLUMNS,
        rows: [
          ["3", "3 Third St", "3C", "", "700", "No"],
          ["4", "4 Fourth St", "4D", "650.25", "", "Yes"],
        ],
      },
      {
        title: "Person 2 additional rental units",
        columns: RENTAL_COLUMNS,
        rows: [["3", "7 Seventh St", "7", "300", "", "Yes"]],
      },
      {
        title: "Person 1 additional one-time payments",
        columns: ONE_TIME_COLUMNS,
        rows: [
          ["This calendar year", "Bonus", "1500", "6", "2026"],
          ["This calendar year", "Gift", "99.99", "12", "2026"],
        ],
      },
      {
        title: "Person 2 additional one-time payments",
        columns: ONE_TIME_COLUMNS,
        rows: [["Next calendar year", "Prize", "250", "4", "2027"]],
      },
      {
        title: "Additional information",
        columns: NOTE_COLUMNS,
        rows: [
          ["Person 1", "Answered Yes to the optional trafficking/battered-spouse question (13f); category not specified"],
          ["Person 1", "Wages or salary, $2000, One time only: the form has no box for this frequency"],
          ["Person 1", "Lottery and gambling winnings, $900, Quarterly: the form has no box for this frequency"],
          ["Person 2", "Answered Yes to the optional trafficking/battered-spouse question (23f); category not specified"],
        ],
      },
    ])
  })

  it("produces nothing for an application that fits the form", () => {
    expect(buildOverflowSheets(completeSingleSenior(), ON)).toEqual([])
    expect(buildOverflowSheets(completeRichHousehold(), ON)).toEqual([])
    expect(buildOverflowSheets(completeFacilityCouple(), ON)).toEqual([])
  })

  it("leaves a single row of each kind, two rental units and one payment per year on the form", () => {
    const a = overflowing()
    a.persons[0].income = a.persons[0].income.slice(0, 1).concat(a.persons[0].income.slice(3, 4))
    a.persons[0].income[0].frequency = "monthly"
    a.persons[0].rental.units = a.persons[0].rental.units.slice(0, 2)
    a.persons[0].oneTimeIncome.thisYearItems = a.persons[0].oneTimeIncome.thisYearItems.slice(0, 1)
    a.persons[0].isTraffickingOrBatteredVictim = "no"
    const sheets = buildOverflowSheets(a, ON)
    expect(sheets.filter((s) => s.title.startsWith("Person 1"))).toEqual([])
    expect(sheets.find((s) => s.title === "Additional information")?.rows).toEqual([
      ["Person 2", "Answered Yes to the optional trafficking/battered-spouse question (23f); category not specified"],
    ])
  })

  it("writes nothing for hidden or stale data (hasIncome no with leftover rows, rental and payments)", () => {
    const a = overflowing()
    for (const p of a.persons) p.hasIncome = "no"
    a.persons[0].isTraffickingOrBatteredVictim = "no"
    a.persons[1].isTraffickingOrBatteredVictim = "no"
    // the nextYear question is asked of everyone, so only its items are cleared by the gate
    a.persons[1].oneTimeIncome.nextYear = "no"
    expect(buildOverflowSheets(a, ON)).toEqual([])
  })

  it("ignores a rental block whose gate is No and payments whose Yes/No is No", () => {
    const a = overflowing()
    a.persons[0].rental.hasRentalIncome = "no"
    a.persons[0].oneTimeIncome.thisYear = "no"
    a.persons[1].oneTimeIncome.nextYear = "no"
    const titles = buildOverflowSheets(a, ON).map((s) => s.title)
    expect(titles).not.toContain("Person 1 additional rental units")
    expect(titles).not.toContain("Person 1 additional one-time payments")
    expect(titles).not.toContain("Person 2 additional one-time payments")
    expect(titles).toContain("Person 2 additional rental units")
  })

  it("ignores a leftover trafficking Yes once the person is a citizen", () => {
    const a = overflowing()
    a.persons[0].usCitizenOrNational = "yes"
    a.persons[0].naturalizedCitizen = "no"
    const notes = buildOverflowSheets(a, ON).find((s) => s.title === "Additional information")?.rows ?? []
    expect(notes.map((row) => row[1]).filter((note) => note.startsWith("Answered Yes"))).toHaveLength(1)
    expect(notes.find((row) => row[1].startsWith("Answered Yes"))?.[0]).toBe("Person 2")
  })

  it("does not read stale item fields of a row whose kind changed", () => {
    const a = overflowing()
    a.persons[0].income = [
      income({ kind: "wages", amount: 100, frequency: "monthly", seasonal: "no" }),
      income({
        kind: "pension",
        amount: 50,
        frequency: "monthly",
        description: "Pension source",
        employerNameAndAddress: "STALE-EMPLOYER",
        employerFederalTaxId: "STALE-ID",
        hoursPerWeek: 99,
        seasonal: "yes",
        seasonJan: true,
      }),
      income({ kind: "pension", amount: 60, frequency: "monthly", description: "Second source", employerNameAndAddress: "STALE-EMPLOYER", hoursPerWeek: 99 }),
    ]
    const json = JSON.stringify(buildOverflowSheets(a, ON))
    expect(json).toContain("Second source")
    expect(json).not.toContain("STALE")
    expect(json).not.toContain("99 hours")
  })

  it("hides Person 2's rows when Person 2 is not on the application", () => {
    const a = overflowing()
    a.persons = [a.persons[0]]
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.includes("Person 2"))).toEqual([])
    expect(JSON.stringify(buildOverflowSheets(a, ON))).not.toContain("Person 2")
  })

  it("runs every registered collector, so later tasks add one function each", () => {
    expect(OVERFLOW_COLLECTORS.length).toBeGreaterThanOrEqual(4)
    const extra: OverflowCollector = (_reader, _answers, on) => [
      { title: "Extra", columns: ["On"], rows: [[String(on.getUTCFullYear())]] },
    ]
    expect(buildOverflowSheets(completeSingleSenior(), ON, [extra])).toEqual([{ title: "Extra", columns: ["On"], rows: [["2026"]] }])
  })

  it("is pure: the answers are not changed", () => {
    const a = overflowing()
    const before = JSON.stringify(a)
    buildOverflowSheets(a, ON)
    expect(JSON.stringify(a)).toBe(before)
  })
})

describe("overflowHeader", () => {
  it("is Person 1's full name and SSN with dashes", () => {
    expect(overflowHeader(completeRichHousehold(), ON)).toEqual({ headerName: "Maria Q Testcase", headerSsn: "123-45-6789" })
  })

  it("accepts an SSN typed without dashes", () => {
    const a = completeRichHousehold()
    a.persons[0].ssn = "123456789"
    expect(overflowHeader(a, ON).headerSsn).toBe("123-45-6789")
  })

  it("says 'not provided' when Person 1 has no usable SSN", () => {
    expect(overflowHeader(completeSingleSenior(), ON)).toEqual({ headerName: "Edna Testcase", headerSsn: "not provided" })
    const a = completeRichHousehold()
    a.persons[0].ssn = "12-34"
    expect(overflowHeader(a, ON).headerSsn).toBe("not provided")
  })
})
