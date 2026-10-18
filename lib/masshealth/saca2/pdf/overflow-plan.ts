/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { MONTH_KEYS, MONTH_LABELS } from "../demographic-options"
import { INCOME_KINDS } from "../questions/person-income"
import { INCOME_FREQUENCIES } from "../questions/options"
import type { Saca2StepId } from "../schema"
import type { Saca2Answers } from "../types"
import { DERIVED } from "./derived"
import { RENTAL_LINES } from "./derived-income"
import { encodeText } from "./encoders"
import { assetsCollector, burialPlotNotes, previousBillsCollector } from "./overflow-assets"
import { healthCollector } from "./overflow-health"
import { supplementACollector } from "./overflow-supp-a"
import { createVisibleReader, type VisibleReader } from "./visible-reader"

/** One continuation sheet's content: a title, column headings and plain-string rows. */
export interface OverflowSheetSpec {
  title: string
  columns: string[]
  rows: string[][]
}

/**
 * Reads what does not fit on the form, only through the visible reader (so hidden or stale answers
 * never reach a sheet). Later tasks add one collector each (asset tables, supplements).
 */
export type OverflowCollector = (reader: VisibleReader, answers: Saca2Answers, on: Date) => OverflowSheetSpec[]

type Person = 0 | 1
const PEOPLE: readonly Person[] = [0, 1]
const personStep = (person: Person): Saca2StepId => (person === 1 ? "person2" : "person1")
const personLabel = (person: Person) => `Person ${person + 1}`

/** The form holds one one-time payment per year per person (Q30 / Q31 and Person 2's Q40 / Q41). */
const ONE_TIME_LINES = 1

const KIND_LABELS = new Map(INCOME_KINDS.map((option) => [option.value, option.label]))
const FREQUENCY_LABELS = new Map(INCOME_FREQUENCIES.map((option) => [option.value, option.label]))
/** These kinds are a monthly net profit or loss: no frequency is asked. */
const MONTHLY_NET_KINDS = new Set(["selfEmployment", "capitalGains", "farmingFishing"])

const money = (raw: unknown): string => encodeText("money", raw) ?? ""
const text = (raw: unknown): string => encodeText("text", raw) ?? ""
const frequencyLabel = (raw: unknown): string => (typeof raw === "string" ? (FREQUENCY_LABELS.get(raw) ?? "") : "")
const kindLabel = (kind: string): string => KIND_LABELS.get(kind) ?? kind

/** Reads one field of one row of a person's repeater (hidden -> undefined). */
function rowReader(reader: VisibleReader, person: Person, path: string, index: number) {
  return (key: string): unknown => reader.get({ kind: "row", stepId: personStep(person), path, index, key, person })
}

// ---------------------------------------------------------------------------------------------
// Income rows beyond the form's blocks
// ---------------------------------------------------------------------------------------------

const seasonKey = (month: (typeof MONTH_KEYS)[number]) => `season${month[0].toUpperCase()}${month.slice(1)}`

function incomeDescription(kind: string, get: (key: string) => unknown): string {
  switch (kind) {
    case "wages":
      return text(get("employerNameAndAddress"))
    case "pension":
      return text(get("description.pension"))
    case "otherTaxable":
      return text(get("description.otherTaxable"))
    default:
      return text(get("description"))
  }
}

function incomeDetails(kind: string, get: (key: string) => unknown): string {
  const details: string[] = []
  if (get("isLoss") === true) details.push("Loss")
  const taxId = text(get("employerFederalTaxId"))
  if (taxId !== "") details.push(`Employer tax ID ${taxId}`)
  const effective = encodeText("date", kind === "lottery" ? get("effectiveDate.lottery") : get("effectiveDate"))
  if (effective !== undefined) details.push(`effective date ${effective}`)
  const hours = encodeText("number", get("hoursPerWeek"))
  if (hours !== undefined) details.push(`${hours} hours a week`)
  const months = MONTH_KEYS.filter((month) => get(seasonKey(month)) === true).map((month) => MONTH_LABELS[month])
  if (months.length > 0) details.push(`Seasonal: ${months.join(", ")}`)
  const preTcja = money(get("preTcjaAmount"))
  if (preTcja !== "") details.push(`Before 2019 agreement: ${preTcja}`)
  return details.join("; ")
}

/**
 * The form holds the FIRST row of each income kind (derived-income.ts); every later row of a kind
 * is printed here, in the order the person entered them.
 */
function incomeRows(reader: VisibleReader, person: Person): string[][] {
  const count = reader.rows(personStep(person), "income", person)
  const onForm = new Set<string>()
  const rows: string[][] = []
  for (let index = 0; index < count; index += 1) {
    const get = rowReader(reader, person, "income", index)
    const kind = get("kind")
    if (typeof kind !== "string") continue
    if (KIND_LABELS.has(kind) && !onForm.has(kind)) {
      onForm.add(kind)
      continue
    }
    rows.push([
      kindLabel(kind),
      incomeDescription(kind, get),
      money(get("amount")),
      MONTHLY_NET_KINDS.has(kind) ? "Monthly average net" : frequencyLabel(get("frequency")),
      incomeDetails(kind, get),
    ])
  }
  return rows
}

const INCOME_COLUMNS = ["Income type", "Employer or description", "Amount ($)", "How often", "Other details"]

const incomeCollector: OverflowCollector = (reader) =>
  PEOPLE.flatMap((person) => {
    const rows = incomeRows(reader, person)
    return rows.length === 0 ? [] : [{ title: `${personLabel(person)} additional income`, columns: INCOME_COLUMNS, rows }]
  })

// ---------------------------------------------------------------------------------------------
// Rental units beyond the form's two lines
// ---------------------------------------------------------------------------------------------

const RENTAL_COLUMNS = ["Unit", "Address", "Unit #", "Monthly income ($)", "Monthly loss ($)", "Owner-occupied"]

function rentalRows(reader: VisibleReader, person: Person): string[][] {
  const count = reader.rows(personStep(person), "rental.units", person)
  const rows: string[][] = []
  for (let index = RENTAL_LINES; index < count; index += 1) {
    const get = rowReader(reader, person, "rental.units", index)
    const amount = money(get("amount"))
    const loss = get("isLoss") === true
    const owner = get("ownerOccupied")
    rows.push([
      String(index + 1),
      text(get("address")),
      text(get("unit")),
      loss ? "" : amount,
      loss ? amount : "",
      owner === "yes" ? "Yes" : owner === "no" ? "No" : "",
    ])
  }
  return rows
}

const rentalCollector: OverflowCollector = (reader) =>
  PEOPLE.flatMap((person) => {
    const rows = rentalRows(reader, person)
    return rows.length === 0 ? [] : [{ title: `${personLabel(person)} additional rental units`, columns: RENTAL_COLUMNS, rows }]
  })

// ---------------------------------------------------------------------------------------------
// One-time payments beyond the first per year
// ---------------------------------------------------------------------------------------------

const ONE_TIME_COLUMNS = ["When", "Type", "Amount ($)", "Month received", "Year received"]

function oneTimeRows(reader: VisibleReader, person: Person): string[][] {
  const rows: string[][] = []
  for (const [path, when] of [
    ["oneTimeIncome.thisYearItems", "This calendar year"],
    ["oneTimeIncome.nextYearItems", "Next calendar year"],
  ] as const) {
    const count = reader.rows(personStep(person), path, person)
    for (let index = ONE_TIME_LINES; index < count; index += 1) {
      const get = rowReader(reader, person, path, index)
      rows.push([
        when,
        text(get("type")),
        money(get("amount")),
        encodeText("number", get("month")) ?? "",
        encodeText("number", get("year")) ?? "",
      ])
    }
  }
  return rows
}

const oneTimeCollector: OverflowCollector = (reader) =>
  PEOPLE.flatMap((person) => {
    const rows = oneTimeRows(reader, person)
    return rows.length === 0
      ? []
      : [{ title: `${personLabel(person)} additional one-time payments`, columns: ONE_TIME_COLUMNS, rows }]
  })

// ---------------------------------------------------------------------------------------------
// Wizard answers the form cannot represent
// ---------------------------------------------------------------------------------------------

/** Index of the first visible row of a kind (the one the form's block takes), or -1. */
function firstRowOfKind(reader: VisibleReader, person: Person, kind: string): number {
  const count = reader.rows(personStep(person), "income", person)
  for (let index = 0; index < count; index += 1) {
    if (rowReader(reader, person, "income", index)("kind") === kind) return index
  }
  return -1
}

/** A note when the first row of `kind` has a frequency the form has no box for. */
function unsupportedFrequencyNote(reader: VisibleReader, person: Person, kind: string, frequency: string): string | undefined {
  const index = firstRowOfKind(reader, person, kind)
  if (index < 0) return undefined
  const get = rowReader(reader, person, "income", index)
  if (get("frequency") !== frequency) return undefined
  const amount = money(get("amount"))
  return [kindLabel(kind), amount === "" ? undefined : `$${amount}`, frequencyLabel(frequency)].filter(Boolean).join(", ") +
    ": the form has no box for this frequency"
}

function notesFor(reader: VisibleReader, person: Person): string[] {
  const notes: string[] = []
  // Q13f (Person 2: Q23f): the wizard has one Yes/No, the form has four category boxes
  if (reader.get({ kind: "answer", stepId: personStep(person), path: "isTraffickingOrBatteredVictim", person }) === "yes") {
    notes.push(
      `Answered Yes to the optional trafficking/battered-spouse question (${person === 1 ? "23f" : "13f"}); category not specified`,
    )
  }
  // The wages boxes stop at "Yearly" and the lottery line has no Quarterly box
  for (const [kind, frequency] of [
    ["wages", "oneTime"],
    ["lottery", "quarterly"],
  ] as const) {
    const note = unsupportedFrequencyNote(reader, person, kind, frequency)
    if (note !== undefined) notes.push(note)
  }
  return notes
}

const notesCollector: OverflowCollector = (reader) => {
  const rows = [
    ...PEOPLE.flatMap((person) => notesFor(reader, person).map((note) => [personLabel(person), note])),
    ...burialPlotNotes(reader),
  ]
  return rows.length === 0 ? [] : [{ title: "Additional information", columns: ["Person", "Note"], rows }]
}

/** In sheet order. Tasks 11-12 append their collectors here. */
export const OVERFLOW_COLLECTORS: OverflowCollector[] = [
  incomeCollector,
  rentalCollector,
  oneTimeCollector,
  notesCollector,
  previousBillsCollector,
  assetsCollector,
  healthCollector,
  supplementACollector,
]

/** All continuation sheets the answers need; empty when everything fits the form. Pure. */
export function buildOverflowSheets(
  answers: Saca2Answers,
  on: Date,
  collectors: OverflowCollector[] = OVERFLOW_COLLECTORS,
): OverflowSheetSpec[] {
  const reader = createVisibleReader(answers, on)
  return collectors.flatMap((collect) => collect(reader, answers, on))
}

/** Person 1's name and SSN, printed on every continuation page as the form instructs. */
export function overflowHeader(answers: Saca2Answers, on: Date): { headerName: string; headerSsn: string } {
  const reader = createVisibleReader(answers, on)
  const name = DERIVED["person.fullName"](reader, answers, on, 0)
  const ssn = reader.get({ kind: "answer", stepId: "person1", path: "ssn" })
  const digits = typeof ssn === "string" ? ssn.replace(/\D/g, "") : ""
  return {
    headerName: typeof name === "string" && name !== "" ? name : "not provided",
    headerSsn: digits.length === 9 ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : "not provided",
  }
}
