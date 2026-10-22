/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { householdHasSpouse } from "./derived-assets"
import { StandardFontEmbedder, StandardFonts } from "pdf-lib"

import type { Saca2Answers } from "../types"
import { encodeSsn, encodeText } from "./encoders"
import { getFieldInfo } from "./inventory"
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
const suppAVisible = (answers: Saca2Answers, on: Date): boolean => isStepVisible(STEP, answers, on)

/**
 * The spouse's header lines: written only for a nursing-facility applicant whose Person 2 is a legally
 * married spouse (`householdHasSpouse`); a visible Person 2 who is not a married spouse is never named here.
 */
function spouseApplies(reader: VisibleReader, answers: Saca2Answers, on: Date): boolean {
  return suppAAnswer(reader, "supplements.a.needsNursingFacility") === "yes" && householdHasSpouse(reader, answers, on)
}

// ---------------------------------------------------------------------------------------------
// Long free-text answers across the form's several lines
// ---------------------------------------------------------------------------------------------

/** The text fields render in /Helv 10 Tf (Helvetica 10 pt, single line, no auto-size). */
const FONT_SIZE = 10
/** Room kept free inside each widget (the form's own text inset is about 2 pt per side). */
const PADDING = 4
const HELVETICA = StandardFontEmbedder.for(StandardFonts.Helvetica as unknown as Parameters<typeof StandardFontEmbedder.for>[0])

/** Width of `text` as the form's fields draw it. */
export const measureHelvetica = (text: string): number => HELVETICA.widthOfTextAtSize(text, FONT_SIZE)

/**
 * Splits `raw` over lines no wider than `widths[i]` points (measured by `measure`), breaking at spaces;
 * a word wider than a whole line is split by characters. `rest` is whatever does not fit, in order.
 * Pure: no word is dropped or repeated (lines joined with `rest`, split at spaces or inside a long
 * word, always give back the sanitized text).
 */
export function wrapLines(
  raw: unknown,
  widths: readonly number[],
  measure: (text: string) => number = measureHelvetica,
): { lines: string[]; rest: string } {
  const text = encodeText("text", raw) ?? ""
  let words = text === "" ? [] : text.split(" ")
  const lines: string[] = []
  for (const width of widths) {
    let line = ""
    while (words.length > 0) {
      const word = words[0]
      const candidate = line === "" ? word : `${line} ${word}`
      if (measure(candidate) <= width) {
        line = candidate
        words = words.slice(1)
      } else if (line === "") {
        // longer than a whole line: take the longest prefix that fits (at least one character)
        let cut = 1
        while (cut < word.length && measure(word.slice(0, cut + 1)) <= width) cut += 1
        line = word.slice(0, cut)
        words = word.length > cut ? [word.slice(cut), ...words.slice(1)] : words.slice(1)
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
  /** The printed lines, in order; their widths come from the template inventory. */
  fields: readonly string[]
  read: (reader: VisibleReader) => unknown
}

const propertyText = (index: number, key: string) => (reader: VisibleReader) => suppARow(reader, "supplements.a.home.properties", index, key)

export const WRAPPED_TEXTS: Record<string, WrappedText> = {
  "property0.owners": {
    label: "8. Name and address of person(s) on ownership papers (property 1)",
    fields: ["Name and address of persons on ownership papers_SuppA", "Name and address of persons on ownership papers_SuppA_2"],
    read: propertyText(0, "ownerNames"),
  },
  "property0.address": {
    label: "8. Description and address of property location (property 1)",
    fields: ["Description and address of property location_SuppA", "Description and address of property location_SuppA_2"],
    read: propertyText(0, "propertyAddress"),
  },
  "property1.owners": {
    label: "8. Name and address of person(s) on ownership papers (property 2)",
    fields: ["Name and address of persons on ownership papers 1_2", "Name and address of persons on ownership papers 2_2"],
    read: propertyText(1, "ownerNames"),
  },
  "property1.address": {
    label: "8. Description and address of property location (property 2)",
    fields: ["Description and address of property location 1_2", "Description and address of property location 2_2"],
    read: propertyText(1, "propertyAddress"),
  },
  dependentRelative: {
    label: "14. Relationship and the nature of the dependency",
    fields: ["Describe the relationship and the nature of the dependency 1", "Describe the relationship and the nature of the dependency 2"],
    read: (reader) => suppAAnswer(reader, "supplements.a.home.dependentRelative.relationshipDescription"),
  },
  otherRealEstate: {
    label: "16. Other real estate: description and address",
    fields: [
      "If Yes please describe the property and list its address below 1",
      "If Yes please describe the property and list its address below 2",
      "If Yes please describe the property and list its address below 3",
    ],
    read: (reader) => suppAAnswer(reader, "supplements.a.home.otherRealEstateDescription"),
  },
}

/** Usable width of each printed line: the widget's width from the template inventory minus padding. */
export function lineWidths(spec: WrappedText): number[] {
  return spec.fields.map((field) => {
    const widget = getFieldInfo(field)?.widgets[0]
    if (!widget) throw new Error(`Wrapped field "${field}" is not in the template`)
    return widget.rect[2] - widget.rect[0] - PADDING
  })
}

/** The printed lines and the text that continues on the sheet. */
export const wrapText = (spec: WrappedText, reader: VisibleReader) => wrapLines(spec.read(reader), lineWidths(spec))

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
  spec.fields.forEach((_, line) => {
    registry[`suppA.wrap.${name}.${line}`] = (reader) => {
      const value = wrapText(spec, reader).lines[line]
      return value === "" ? undefined : value
    }
  })
}

export const SUPP_A_DERIVED: DerivedRegistry = registry
