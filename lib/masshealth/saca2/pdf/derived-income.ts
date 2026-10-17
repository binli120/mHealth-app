/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { MONTH_KEYS } from "../demographic-options"
import { INCOME_FREQUENCIES } from "../questions/options"
import type { Saca2IncomeItem } from "../types"
import type { DerivedRegistry, DerivedResolver } from "./pdf-fill"
import type { VisibleReader } from "./visible-reader"

type PersonIndex = 0 | 1
type IncomeKind = Saca2IncomeItem["kind"]

/**
 * The wizard collects income as rows (a kind, an amount, a frequency, ...). The form lays income
 * out as fixed blocks: one current-job table, one self-employment block, and one line per other
 * income type. Each resolver below picks the FIRST row of a kind from the visible rows and returns
 * one of its values; later rows of the same kind are ignored here (they need an overflow sheet).
 * Everything is read through the visible reader, so hidden rows and stale item fields never leak.
 */

const stepOf = (person: PersonIndex) => (person === 1 ? "person2" : "person1")

function needPerson(person: PersonIndex | undefined, id: string): PersonIndex {
  if (person === undefined) throw new Error(`Derived source "${id}" needs a person`)
  return person
}

function firstRowIndex(reader: VisibleReader, person: PersonIndex, kind: IncomeKind): number {
  const stepId = stepOf(person)
  const count = reader.rows(stepId, "income", person)
  for (let index = 0; index < count; index += 1) {
    if (reader.get({ kind: "row", stepId, path: "income", index, key: "kind", person }) === kind) return index
  }
  return -1
}

/** `key` is an item question id (several kinds share one stored field under different ids). */
function rowValue(reader: VisibleReader, person: PersonIndex, kind: IncomeKind, key: string): unknown {
  const index = firstRowIndex(reader, person, kind)
  if (index < 0) return undefined
  return reader.get({ kind: "row", stepId: stepOf(person), path: "income", index, key, person })
}

const frequencyLabel = (value: unknown): string | undefined =>
  INCOME_FREQUENCIES.find((option) => option.value === value)?.label

const value =
  (kind: IncomeKind, key: string, map: (raw: unknown) => unknown = (raw) => raw): DerivedResolver =>
  (reader, _answers, _on, person) =>
    map(rowValue(reader, needPerson(person, `income.${kind}.${key}`), kind, key))

/** A box that is ticked when the person has a row of this kind. */
const present =
  (kind: IncomeKind): DerivedResolver =>
  (reader, _answers, _on, person) =>
    firstRowIndex(reader, needPerson(person, `income.${kind}.checked`), kind) >= 0 ? true : undefined

/** Monthly net kinds put the amount in the profit or the loss blank, never both. */
const profitOrLoss =
  (kind: IncomeKind, loss: boolean): DerivedResolver =>
  (reader, _answers, _on, person) => {
    const p = needPerson(person, `income.${kind}.${loss ? "loss" : "profit"}`)
    if (firstRowIndex(reader, p, kind) < 0) return undefined
    const isLoss = rowValue(reader, p, kind, "isLoss") === true
    return isLoss === loss ? rowValue(reader, p, kind, "amount") : undefined
  }

/** Kinds that have a "$ amount / How often?" line on the form (pension and other taxable add a text blank). */
const LINE_KINDS: IncomeKind[] = [
  "socialSecurity",
  "pension",
  "annuity",
  "trust",
  "unemployment",
  "investment",
  "royalty",
  "alimony",
  "veterans",
  "militaryRetirement",
  "otherTaxable",
]

const registry: DerivedRegistry = {
  // Current job (Q23-26): the first wages row
  "income.wages.employer": value("wages", "employerNameAndAddress"),
  "income.wages.taxId": value("wages", "employerFederalTaxId"),
  "income.wages.amount": value("wages", "amount"),
  "income.wages.frequency": value("wages", "frequency"),
  "income.wages.effectiveDate": value("wages", "effectiveDate"),
  "income.wages.hoursPerWeek": value("wages", "hoursPerWeek"),
  "income.wages.seasonal": value("wages", "seasonal"),

  // Self-employment (Q27): "No" is written when the person has income but no self-employment row
  "income.selfEmployment.answer": (reader, _answers, _on, person) => {
    const p = needPerson(person, "income.selfEmployment.answer")
    if (firstRowIndex(reader, p, "selfEmployment") >= 0) return "yes"
    return reader.get({ kind: "answer", stepId: stepOf(p), path: "hasIncome", person: p }) === "yes" ? "no" : undefined
  },
  "income.selfEmployment.work": value("selfEmployment", "description"),
  "income.selfEmployment.profit": profitOrLoss("selfEmployment", false),
  "income.selfEmployment.loss": profitOrLoss("selfEmployment", true),
  "income.selfEmployment.hoursPerWeek": value("selfEmployment", "hoursPerWeek"),

  // Source / type blanks on the pension and other-taxable lines; the alimony pre-2019 amount
  "income.pension.source": value("pension", "description.pension"),
  "income.otherTaxable.type": value("otherTaxable", "description.otherTaxable"),
  "income.alimony.preTcja": value("alimony", "preTcjaAmount"),

  // Capital gains, farming/fishing (monthly profit or loss) and lottery
  "income.capitalGains.checked": present("capitalGains"),
  "income.capitalGains.profit": profitOrLoss("capitalGains", false),
  "income.capitalGains.loss": profitOrLoss("capitalGains", true),
  "income.farmingFishing.checked": present("farmingFishing"),
  "income.farmingFishing.profit": profitOrLoss("farmingFishing", false),
  "income.farmingFishing.loss": profitOrLoss("farmingFishing", true),
  "income.farmingFishing.hoursPerWeek": value("farmingFishing", "hoursPerWeek"),
  "income.lottery.checked": present("lottery"),
  "income.lottery.amount": value("lottery", "amount"),
  "income.lottery.effectiveDate": value("lottery", "effectiveDate.lottery"),
  "income.lottery.frequency": value("lottery", "frequency"),
}

for (const kind of LINE_KINDS) {
  registry[`income.${kind}.checked`] = present(kind)
  registry[`income.${kind}.amount`] = value(kind, "amount")
  registry[`income.${kind}.frequencyText`] = value(kind, "frequency", frequencyLabel)
}

// Seasonal months: only readable while the row is a seasonal wages row (the reader hides the rest)
for (const month of MONTH_KEYS) {
  const key = `season${month[0].toUpperCase()}${month.slice(1)}`
  registry[`income.wages.month.${month}`] = value("wages", key, (raw) => (raw === true ? true : undefined))
}

/** Rental units: the form has two lines; amount and loss share one wizard amount, split by `isLoss`. */
const RENTAL_LINES = 2
for (let line = 0; line < RENTAL_LINES; line += 1) {
  for (const loss of [false, true]) {
    registry[`rental.unit.${line}.${loss ? "loss" : "income"}`] = (reader, _answers, _on, person) => {
      const p = needPerson(person, "rental.unit")
      const source = (key: string) =>
        ({ kind: "row", stepId: stepOf(p), path: "rental.units", index: line, key, person: p }) as const
      if (reader.get(source("amount")) === undefined) return undefined
      return (reader.get(source("isLoss")) === true) === loss ? reader.get(source("amount")) : undefined
    }
  }
}

export const INCOME_DERIVED: DerivedRegistry = registry
