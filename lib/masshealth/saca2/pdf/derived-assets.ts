/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { ACCOUNT_TYPES, PROPERTY_TYPES } from "../questions/assets"
import { isStepVisible } from "../visibility"
import type { Saca2Answers } from "../types"
import type { DerivedRegistry, DerivedResolver } from "./pdf-fill"
import type { VisibleReader } from "./visible-reader"

/**
 * The wizard collects each asset category as a list of rows; the form lays them out as fixed blocks.
 * This module is the single place that decides which visible row lands in which block of the form
 * (`place*`), so the field map, the derived resolvers below and the overflow sheets
 * (overflow-assets.ts) can never disagree. Everything is read through the visible reader, so rows of
 * a category whose gate is "no", and item fields hidden by their own conditions, never appear.
 */

/** A row of a root-scope repeater, addressed the way the visible reader reads it. */
export interface RowRef {
  path: string
  index: number
}

/** Rows of a category that fit the form (by slot) and the rest, in the order the person entered them. */
export interface Placement {
  onForm: Map<string, RowRef>
  extra: RowRef[]
}

export const BANK_LINES = 2
export const REAL_ESTATE_LINES = 2
export const LIFE_INSURANCE_LINES = 2
export const ANNUITY_LINES = 2
export const DEPOSIT_LINES = 1
export const TRUST_LINES = 2
/** Step 4: the form lists two people requesting payment of previous medical bills. */
export const PREVIOUS_BILLS_LINES = 2

const STEP = "assets" as const

/** The form's securities rows, one per type, with the label printed on the form. */
export const SECURITIES_KINDS = [
  ["cash", "Cash"],
  ["stocks", "Stocks"],
  ["bonds", "Bonds"],
  ["savingsBonds", "Savings bonds"],
  ["mutualFunds", "Mutual funds"],
  ["options", "Options"],
  ["futures", "Future contracts"],
  ["other", "Other"],
] as const

export const OWNERS = [
  ["you", "You"],
  ["spouse", "Your spouse"],
] as const

/** The five prepaid-burial lines of each owner's block, with the label printed on the form. */
export const BURIAL_KINDS = [
  ["contract", "Burial contract"],
  ["trust", "Burial trust"],
  ["lifeInsurance", "Life insurance for burial"],
  ["burialOnlyAccount", "Burial-only account"],
  ["plot", "Burial plot"],
] as const

export const REAL_ESTATE_PATHS = ["assets.primaryResidence", "assets.otherRealEstate"] as const

/** One row value, read only when the row and the item question are visible. */
export function readRow(reader: VisibleReader, ref: RowRef, key: string): unknown {
  return reader.get({ kind: "row", stepId: STEP, path: ref.path, index: ref.index, key })
}

function visibleRows(reader: VisibleReader, path: string): RowRef[] {
  const count = reader.rows(STEP, path)
  return Array.from({ length: count }, (_, index) => ({ path, index }))
}

/** Rows fill the form's lines in order; every row after `lines` is extra. */
function placeInOrder(rows: RowRef[], lines: number): Placement {
  const onForm = new Map<string, RowRef>()
  rows.slice(0, lines).forEach((ref, line) => onForm.set(String(line), ref))
  return { onForm, extra: rows.slice(lines) }
}

/** The first row of each slot key fills that slot; later rows with the same key (or an unknown key) are extra. */
function placeByKey(reader: VisibleReader, rows: RowRef[], keyOf: (ref: RowRef) => string | undefined, slots: readonly string[]): Placement {
  const onForm = new Map<string, RowRef>()
  const extra: RowRef[] = []
  for (const ref of rows) {
    const key = keyOf(ref)
    if (key !== undefined && slots.includes(key) && !onForm.has(key)) onForm.set(key, ref)
    else extra.push(ref)
  }
  return { onForm, extra }
}

const stringOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

export const placeBank = (reader: VisibleReader) => placeInOrder(visibleRows(reader, "assets.bankAccounts"), BANK_LINES)

/** Primary residence rows come first, then other real estate: the form has one address table for both questions. */
export const placeRealEstate = (reader: VisibleReader) =>
  placeInOrder(REAL_ESTATE_PATHS.flatMap((path) => visibleRows(reader, path)), REAL_ESTATE_LINES)

export const placeLifeInsurance = (reader: VisibleReader) =>
  placeInOrder(visibleRows(reader, "assets.lifeInsurance"), LIFE_INSURANCE_LINES)

export const placeAnnuities = (reader: VisibleReader) => placeInOrder(visibleRows(reader, "assets.annuities"), ANNUITY_LINES)

export const placeDeposits = (reader: VisibleReader) =>
  placeInOrder(visibleRows(reader, "assets.assistedLivingDeposits"), DEPOSIT_LINES)

export const placeTrusts = (reader: VisibleReader) => placeInOrder(visibleRows(reader, "assets.trusts"), TRUST_LINES)

export const placeSecurities = (reader: VisibleReader) =>
  placeByKey(
    reader,
    visibleRows(reader, "assets.securities"),
    (ref) => stringOf(readRow(reader, ref, "kind")),
    SECURITIES_KINDS.map(([kind]) => kind),
  )

/** One vehicle line per owner: the form has a block for "You" and one for "Your spouse". */
export const placeVehicles = (reader: VisibleReader) =>
  placeByKey(
    reader,
    visibleRows(reader, "assets.vehicles"),
    (ref) => stringOf(readRow(reader, ref, "owner")),
    OWNERS.map(([owner]) => owner),
  )

/** One line per owner and arrangement type; the slot is `owner.kind`. */
export const placeBurial = (reader: VisibleReader) =>
  placeByKey(
    reader,
    visibleRows(reader, "assets.burial"),
    (ref) => {
      const owner = stringOf(readRow(reader, ref, "owner"))
      const kind = stringOf(readRow(reader, ref, "kind"))
      return owner === undefined || kind === undefined ? undefined : `${owner}.${kind}`
    },
    OWNERS.flatMap(([owner]) => BURIAL_KINDS.map(([kind]) => `${owner}.${kind}`)),
  )

const labelOf = (options: readonly { value: string; label: string }[], raw: unknown): string | undefined =>
  options.find((option) => option.value === raw)?.label

export const accountTypeLabel = (raw: unknown) => labelOf(ACCOUNT_TYPES, raw)
export const propertyTypeLabel = (raw: unknown) => labelOf(PROPERTY_TYPES, raw)

const gateAnswer = (reader: VisibleReader, category: string): unknown =>
  reader.get({ kind: "answer", stepId: STEP, path: `assets.gates.${category}` })

const yesNoOf = (value: unknown): "yes" | "no" | undefined => (value === true ? "yes" : value === false ? "no" : undefined)

/** A resolver that reads `key` from the row placed in `slot`, optionally mapped (hidden or absent -> undefined). */
function cell(place: (reader: VisibleReader) => Placement, slot: string, key: string, map: (raw: unknown) => unknown = (raw) => raw): DerivedResolver {
  return (reader) => {
    const ref = place(reader).onForm.get(slot)
    return ref === undefined ? undefined : map(readRow(reader, ref, key))
  }
}

/** Fails at module load when a table of field names does not have exactly the form's number of lines. */
export function fitLines<T>(table: readonly T[], lines: number, name: string): readonly T[] {
  if (table.length !== lines) throw new Error(`${name} has ${table.length} lines, the form has ${lines}`)
  return table
}

const registry: DerivedRegistry = {}

// Bank accounts: type label and the open / closed group. Closed accounts hide their current balance
// and open ones hide the closing date and amount through the wizard's own item conditions.
for (let line = 0; line < BANK_LINES; line += 1) {
  registry[`assets.bank.${line}.accountType`] = cell(placeBank, String(line), "accountType", accountTypeLabel)
  registry[`assets.bank.${line}.status`] = cell(placeBank, String(line), "open", (raw) =>
    raw === true ? "open" : raw === false ? "closed" : undefined,
  )
}

// Real estate: one address table for the primary residence and other real estate
for (let line = 0; line < REAL_ESTATE_LINES; line += 1) {
  registry[`assets.realEstate.${line}.address`] = cell(placeRealEstate, String(line), "address")
  registry[`assets.realEstate.${line}.propertyType`] = cell(placeRealEstate, String(line), "propertyType", propertyTypeLabel)
  registry[`assets.realEstate.${line}.currentValue`] = cell(placeRealEstate, String(line), "currentValue")
}

/**
 * True when the application has a spouse: Person 1 is legally married and the Person 2 step is
 * visible. Read through the visible reader and step visibility, never from raw answers. Every
 * "You / Your spouse" box is written for the spouse only when this holds, so a single applicant
 * never gets answers about a spouse who does not exist.
 */
export function householdHasSpouse(reader: VisibleReader, answers: Saca2Answers, on: Date): boolean {
  return (
    reader.get({ kind: "answer", stepId: "person1", path: "isLegallyMarried", person: 0 }) === "yes" &&
    isStepVisible("person2", answers, on)
  )
}

/**
 * The form asks "You" and "Your spouse" separately; the wizard asks once about "you or your spouse".
 * - Gate No answers every person: "You" is No, and "Your spouse" is No only when there is a spouse.
 * - Gate Yes with no spouse can only mean "You: Yes"; the spouse boxes stay blank.
 * - Gate Yes with a spouse does not say whose it is: both boxes stay blank (WIZARD GAP: the wizard
 *   has no owner question for real estate; the filled address table carries the Yes).
 */
for (const [id, category] of [
  ["primary", "primaryResidence"],
  ["other", "otherRealEstate"],
] as const) {
  registry[`assets.realEstate.${id}.you`] = (reader, answers, on) => {
    const gate = gateAnswer(reader, category)
    if (gate === "no") return "no"
    return gate === "yes" && !householdHasSpouse(reader, answers, on) ? "yes" : undefined
  }
  registry[`assets.realEstate.${id}.spouse`] = (reader, answers, on) =>
    gateAnswer(reader, category) === "no" && householdHasSpouse(reader, answers, on) ? "no" : undefined
}

// Life insurance rows map straight from row sources; trusts need a Yes / No for "Revocable?".
// Trust questions 10 and 11 are one wizard gate and have no You / spouse boxes; only "No" can be
// written to both (WIZARD GAP: a Yes does not say which question, so both stay blank).
registry["assets.trusts.gate"] = (reader) => (gateAnswer(reader, "trusts") === "no" ? "no" : undefined)
for (let line = 0; line < TRUST_LINES; line += 1) {
  registry[`assets.trusts.${line}.revocable`] = cell(placeTrusts, String(line), "revocable", yesNoOf)
}

// Securities: one row per type; "Joint asset?" is Yes / No whenever the row exists
for (const [kind] of SECURITIES_KINDS) {
  for (const key of ["owners", "company", "accountNumber", "currentValue", "valueOnAdmissionDate"]) {
    registry[`assets.securities.${kind}.${key}`] = cell(placeSecurities, kind, key)
  }
  registry[`assets.securities.${kind}.joint`] = cell(placeSecurities, kind, "joint", yesNoOf)
}

// Vehicles: one line per owner
for (const [owner] of OWNERS) {
  for (const key of ["vehicleType", "yearMakeModel", "fairMarketValue", "amountOwed"]) {
    registry[`assets.vehicles.${owner}.${key}`] = cell(placeVehicles, owner, key)
  }
}

// Prepaid burial: when the gate says Yes, every line of the "You" block is answered; a line with a row
// is Yes (with its amount), a line without one is No. The spouse block is answered "No" only when the
// household has a spouse; a spouse row that exists is always written.
for (const [owner] of OWNERS) {
  for (const [kind] of BURIAL_KINDS) {
    const slot = `${owner}.${kind}`
    registry[`assets.burial.${slot}.checked`] = (reader, answers, on) => {
      if (gateAnswer(reader, "burial") !== "yes") return undefined
      if (placeBurial(reader).onForm.has(slot)) return "yes"
      return owner === "spouse" && !householdHasSpouse(reader, answers, on) ? undefined : "no"
    }
    registry[`assets.burial.${slot}.amount`] = cell(placeBurial, slot, "amount")
  }
}

export const ASSETS_DERIVED: DerivedRegistry = registry
