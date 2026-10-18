/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { householdHasSpouse } from "./derived-assets"
import { encodeSsn, encodeText } from "./encoders"
import type { DerivedRegistry } from "./pdf-fill"
import type { VisibleReader } from "./visible-reader"
import { isStepVisible } from "../visibility"

/**
 * Supplement A (form pages 25-28, PDF indexes 26-29). The form's fixed tables and how many wizard rows
 * each holds; rows beyond the capacity go on a continuation sheet (overflow-supp-a.ts).
 */
export const SUPP_A_TRANSFER_LINES = 3
export const SUPP_A_FAMILY_LINES = 2
export const SUPP_A_PROPERTY_LINES = 2
export const SUPP_A_POLICY_LINES = 2

/** The wizard's ownership types, in the order of the form's four "Fair-market value" lines. */
export const OWNERSHIP_TYPES = ["individual", "tenancyInCommon", "jointTenancy", "lifeEstate"] as const
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number]

const STEP = "suppA" as const

const suppAAnswer = (reader: VisibleReader, path: string): unknown => reader.get({ kind: "answer", stepId: STEP, path })
const suppARow = (reader: VisibleReader, path: string, index: number, key: string): unknown =>
  reader.get({ kind: "row", stepId: STEP, path, index, key })

const dashedSsn = (raw: unknown): string | undefined => {
  const digits = encodeSsn(raw)
  return digits === undefined ? undefined : `${digits.slice(0, 3).join("")}-${digits.slice(3, 5).join("")}-${digits.slice(5).join("")}`
}

/** "Last, First M": the form's "last name, first name, middle initial" line. */
function lastFirstMiddle(reader: VisibleReader, person: 0 | 1): string | undefined {
  const stepId = person === 1 ? "person2" : "person1"
  const read = (path: string): string => {
    const raw = reader.get({ kind: "answer", stepId, path, person })
    return typeof raw === "string" ? raw.trim() : ""
  }
  const last = read("lastName")
  const first = read("firstName")
  const middle = read("middleName").slice(0, 1)
  const given = [first, middle].filter((part) => part !== "").join(" ")
  const name = [last, given].filter((part) => part !== "").join(", ")
  return name === "" ? undefined : name
}

function ssnLineOf(reader: VisibleReader, person: 0 | 1): string | undefined {
  return dashedSsn(reader.get({ kind: "answer", stepId: person === 1 ? "person2" : "person1", path: "ssn", person }))
}

/** True only when the wizard shows Supplement A (the pages of a hidden supplement are dropped). */
const suppAVisible = (answers: Parameters<typeof isStepVisible>[1], on: Date): boolean => isStepVisible(STEP, answers, on)

/**
 * The spouse's header lines: written only for a nursing-facility applicant whose Person 2 is a legally
 * married spouse (`householdHasSpouse`); a visible Person 2 who is not a married spouse is never named here.
 */
function spouseApplies(reader: VisibleReader, answers: Parameters<typeof isStepVisible>[1], on: Date): boolean {
  return suppAAnswer(reader, "supplements.a.needsNursingFacility") === "yes" && householdHasSpouse(reader, answers, on)
}

// ---------------------------------------------------------------------------------------------
// Long free-text answers across the form's several lines
// ---------------------------------------------------------------------------------------------

/**
 * Splits `raw` over lines holding at most `limits[i]` characters, breaking at spaces (a word longer than
 * a line is cut). `rest` is whatever does not fit, for the continuation sheet.
 */
export function wrapLines(raw: unknown, limits: readonly number[]): { lines: string[]; rest: string } {
  const text = encodeText("text", raw) ?? ""
  let words = text === "" ? [] : text.split(" ")
  const lines: string[] = []
  for (const limit of limits) {
    let line = ""
    while (words.length > 0) {
      const word = words[0]
      const candidate = line === "" ? word : `${line} ${word}`
      if (candidate.length <= limit) {
        line = candidate
        words = words.slice(1)
      } else if (line === "") {
        line = word.slice(0, limit)
        words = [word.slice(limit), ...words.slice(1)]
        break
      } else break
    }
    lines.push(line)
  }
  return { lines, rest: words.join(" ") }
}

interface WrappedText {
  /** Label of the question, for the continuation sheet. */
  label: string
  limits: readonly number[]
  read: (reader: VisibleReader) => unknown
}

const propertyText = (index: number, key: string) => (reader: VisibleReader) => suppARow(reader, "supplements.a.home.properties", index, key)

/** Characters that fit on each printed line (the lines are 330-570 points wide). */
export const WRAPPED_TEXTS: Record<string, WrappedText> = {
  ...Object.fromEntries(
    Array.from({ length: SUPP_A_PROPERTY_LINES }, (_, index) => index).flatMap((index) => [
      [`property${index}.owners`, { label: `8. Name and address of person(s) on ownership papers (property ${index + 1})`, limits: [55, 95], read: propertyText(index, "ownerNames") }],
      [`property${index}.address`, { label: `8. Description and address of property location (property ${index + 1})`, limits: [55, 95], read: propertyText(index, "propertyAddress") }],
    ]),
  ),
  dependentRelative: {
    label: "14. Relationship and the nature of the dependency",
    limits: [55, 95],
    read: (reader) => suppAAnswer(reader, "supplements.a.home.dependentRelative.relationshipDescription"),
  },
  otherRealEstate: {
    label: "16. Other real estate: description and address",
    limits: [100, 100, 100],
    read: (reader) => suppAAnswer(reader, "supplements.a.home.otherRealEstateDescription"),
  },
}

const registry: DerivedRegistry = {
  /** Person 1's name and SSN repeat at the top of Supplement A; nothing is written when the supplement is hidden. */
  "p1.nameLastFirst": (reader, answers, on) => (suppAVisible(answers, on) ? lastFirstMiddle(reader, 0) : undefined),
  "p1.ssnLine": (reader, answers, on) => (suppAVisible(answers, on) ? ssnLineOf(reader, 0) : undefined),

  "suppA.spouse.nameLastFirst": (reader, answers, on) =>
    suppAVisible(answers, on) && spouseApplies(reader, answers, on) ? lastFirstMiddle(reader, 1) : undefined,
  "suppA.spouse.ssnLine": (reader, answers, on) =>
    suppAVisible(answers, on) && spouseApplies(reader, answers, on) ? ssnLineOf(reader, 1) : undefined,

  /** The form has ONE line for the facility's name and address. */
  "suppA.facility.nameAndAddress": (reader) => {
    const read = (path: string) => encodeText("text", suppAAnswer(reader, `supplements.a.facility.${path}`)) ?? ""
    return [read("name"), read("address")].filter((part) => part !== "").join(", ") || undefined
  },
}

for (let index = 0; index < SUPP_A_FAMILY_LINES; index += 1) {
  registry[`suppA.family.${index}.ssnLine`] = (reader) =>
    dashedSsn(suppARow(reader, "supplements.a.familyAtHome.members", index, "ssn"))
}

// The fair-market value is written on the line of the ownership type that was chosen
for (let index = 0; index < SUPP_A_PROPERTY_LINES; index += 1) {
  for (const type of OWNERSHIP_TYPES) {
    registry[`suppA.property.${index}.fmv.${type}`] = (reader) =>
      suppARow(reader, "supplements.a.home.properties", index, "ownershipType") === type
        ? suppARow(reader, "supplements.a.home.properties", index, "fairMarketValue")
        : undefined
  }
}

for (const [name, spec] of Object.entries(WRAPPED_TEXTS)) {
  spec.limits.forEach((_, line) => {
    registry[`suppA.wrap.${name}.${line}`] = (reader) => {
      const value = wrapLines(spec.read(reader), spec.limits).lines[line]
      return value === "" ? undefined : value
    }
  })
}

export const SUPP_A_DERIVED: DerivedRegistry = registry
