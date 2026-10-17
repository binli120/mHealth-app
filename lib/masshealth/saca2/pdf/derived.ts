/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  DEDUCTION_KEYS,
  ETHNICITY_KEYS,
  ETHNICITY_LABELS,
  RACE_KEYS,
  RACE_LABELS,
  type EthnicityKey,
  type RaceKey,
} from "../demographic-options"
import { IMMIGRATION_DOCUMENT_OPTIONS, IMMIGRATION_STATUS_OPTIONS } from "../questions/immigration-options"
import type { Saca2Option } from "../questions/types"
import { isStepVisible } from "../visibility"
import { INCOME_DERIVED } from "./derived-income"
import { encodeText } from "./encoders"
import type { DerivedRegistry, DerivedResolver } from "./pdf-fill"
import type { VisibleReader } from "./visible-reader"

type PersonIndex = 0 | 1

/** Reads one visible Person answer through the shared person content (hidden or absent -> undefined). */
function readPerson(reader: VisibleReader, person: PersonIndex, path: string): unknown {
  return reader.get({ kind: "answer", stepId: person === 1 ? "person2" : "person1", path, person })
}

function readString(reader: VisibleReader, person: PersonIndex, path: string): string {
  const value = readPerson(reader, person, path)
  return typeof value === "string" ? value.trim() : ""
}

function requirePerson(person: PersonIndex | undefined, id: string): PersonIndex {
  if (person === undefined) throw new Error(`Derived source "${id}" needs a person`)
  return person
}

/** First, middle, last name and suffix as the form's single name line: "Maria Q Testcase". */
function fullName(reader: VisibleReader, person: PersonIndex): string | undefined {
  const parts = ["firstName", "middleName", "lastName", "suffix"].map((key) => readString(reader, person, key))
  const name = parts.filter((p) => p !== "").join(" ")
  return name === "" ? undefined : name
}

function isApplying(reader: VisibleReader, person: PersonIndex): boolean {
  return readPerson(reader, person, "applyingForCoverage") === "yes"
}

const SPOUSE_RELATIONSHIP = /\b(spouse|husband|wife)\b/i

type ProgramKey = "masshealthHsn" | "longTermCare" | "hcbsWaiver" | "healthConnector"

function programChecked(reader: VisibleReader, key: ProgramKey): boolean {
  return reader.get({ kind: "answer", stepId: "intake", path: `intake.programs.${key}` }) === true
}

/**
 * The intake page's "You:" / "Spouse:" lines list who is applying under each program. The wizard
 * asks for programs once for the whole application, so a line is filled when one of the program
 * boxes it sits under is checked and that person is applying. The spouse line takes Person 2 only
 * when the relationship text says spouse, husband or wife; anyone else has no line on the form.
 */
function programLine(programs: ProgramKey[], who: "you" | "spouse") {
  return (reader: VisibleReader): string | undefined => {
    if (!programs.some((key) => programChecked(reader, key))) return undefined
    if (who === "you") return isApplying(reader, 0) ? fullName(reader, 0) : undefined
    if (!isApplying(reader, 1)) return undefined
    return SPOUSE_RELATIONSHIP.test(readString(reader, 1, "relationshipToPerson1")) ? fullName(reader, 1) : undefined
  }
}

/**
 * The form's race and ethnicity questions are free-text lines ("Write in all that apply"). Ticked
 * options are written by their label in the wizard's order; "not listed" is replaced by the
 * person's own wording.
 */
function checkedLabels<K extends string>(
  reader: VisibleReader,
  person: PersonIndex,
  group: "race" | "ethnicity",
  keys: readonly K[],
  labels: Record<K, string>,
  otherPath: string,
): string | undefined {
  const picked: string[] = []
  for (const key of keys) {
    if (readPerson(reader, person, `demographics.${group}.${key}`) !== true) continue
    const label = key === "notListed" ? readString(reader, person, otherPath) : labels[key]
    if (label !== "") picked.push(label)
  }
  return picked.length === 0 ? undefined : picked.join(", ")
}

function dateText(value: unknown): string {
  return encodeText("date", value) ?? ""
}

function optionLabel(options: readonly Saca2Option[], raw: unknown): string | undefined {
  return options.find((option) => option.value === raw)?.label
}

/** Rows of a name + date-of-birth repeater as one line: "Name MM/DD/YYYY", rows joined with "; ". */
function nameDobLine(reader: VisibleReader, person: PersonIndex, path: string): string | undefined {
  const stepId = person === 1 ? "person2" : "person1"
  const count = reader.rows(stepId, path, person)
  const rows: string[] = []
  for (let index = 0; index < count; index += 1) {
    const name = reader.get({ kind: "row", stepId, path, index, key: "name", person })
    const dob = reader.get({ kind: "row", stepId, path, index, key: "dateOfBirth", person })
    const line = [typeof name === "string" ? name.trim() : "", dateText(dob)].filter((part) => part !== "").join(" ")
    if (line !== "") rows.push(line)
  }
  return rows.length === 0 ? undefined : rows.join("; ")
}

export const DERIVED: DerivedRegistry = {
  ...INCOME_DERIVED,

  "person.fullName": (reader, _answers, _on, person) => fullName(reader, requirePerson(person, "person.fullName")),

  /** "# of people listed on the application": everyone with a Person block on this application. */
  "application.peopleListed": (_reader, answers, on) =>
    1 + (isStepVisible("person2", answers, on) && answers.persons[1] !== undefined ? 1 : 0),

  /**
   * Person 2's Q5 "If No, provide street address": one line, only when "Does this person live with
   * Person 1?" is No. The wizard asks the address in parts, so the line joins them; the state is
   * upper-cased like Person 1's State field.
   */
  "person.homeAddressLine": (reader, _answers, _on, person) => {
    const p = requirePerson(person, "person.homeAddressLine")
    if (readPerson(reader, p, "livesWithPerson1") !== "no") return undefined
    const stateZip = [readString(reader, p, "state").toUpperCase(), readString(reader, p, "zip")].filter((part) => part !== "").join(" ")
    const parts = [readString(reader, p, "streetAddress"), readString(reader, p, "apartment"), readString(reader, p, "city"), stateZip]
    return parts.filter((part) => part !== "").join(", ") || undefined
  },

  "intake.names.masshealth.you": programLine(["masshealthHsn"], "you"),
  "intake.names.masshealth.spouse": programLine(["masshealthHsn"], "spouse"),
  "intake.names.healthConnector.you": programLine(["healthConnector"], "you"),
  "intake.names.healthConnector.spouse": programLine(["healthConnector"], "spouse"),
  "intake.names.longTermCare.you": programLine(["longTermCare", "hcbsWaiver"], "you"),
  "intake.names.longTermCare.spouse": programLine(["longTermCare", "hcbsWaiver"], "spouse"),

  "demographics.race": (reader, _answers, _on, person) =>
    checkedLabels<RaceKey>(reader, requirePerson(person, "demographics.race"), "race", RACE_KEYS, RACE_LABELS, "demographics.raceOther"),
  "demographics.ethnicity": (reader, _answers, _on, person) =>
    checkedLabels<EthnicityKey>(
      reader,
      requirePerson(person, "demographics.ethnicity"),
      "ethnicity",
      ETHNICITY_KEYS,
      ETHNICITY_LABELS,
      "demographics.ethnicityOther",
    ),

  /** Q11a: the form has one line for "spouse's name and date of birth". */
  "tax.spouseNameAndDob": (reader, _answers, _on, person) => {
    const p = requirePerson(person, "tax.spouseNameAndDob")
    const name = readString(reader, p, "tax.spouseName")
    const dob = dateText(readPerson(reader, p, "tax.spouseDateOfBirth"))
    return [name, dob].filter((part) => part !== "").join(", ") || undefined
  },

  /** Q11c: the form has one line for all dependents; rows read "Name MM/DD/YYYY", separated by "; ". */
  "tax.dependentsList": (reader, _answers, _on, person) =>
    nameDobLine(reader, requirePerson(person, "tax.dependentsList"), "tax.dependents"),

  /** Q11a "Are you legally married?": the form says "If No, skip to question d" when Q11 is No. */
  "tax.isLegallyMarried": (reader, _answers, _on, person) => {
    const p = requirePerson(person, "tax.isLegallyMarried")
    return readPerson(reader, p, "tax.agreesToFileIfAptc") === "yes" ? readPerson(reader, p, "isLegallyMarried") : undefined
  },

  /** Q11e tax filer: the form has one line for "the spouse's name and date of birth". */
  "tax.filerSpouseNameAndDob": (reader, _answers, _on, person) => {
    const p = requirePerson(person, "tax.filerSpouseNameAndDob")
    const name = readString(reader, p, "tax.taxFiler.spouseName")
    const dob = dateText(readPerson(reader, p, "tax.taxFiler.spouseDateOfBirth"))
    return [name, dob].filter((part) => part !== "").join(", ") || undefined
  },

  /** Q13b: the form's immigration status and document type are written as the names on its page-32 list. */
  "immigration.statusLabel": (reader, _answers, _on, person) =>
    optionLabel(IMMIGRATION_STATUS_OPTIONS, readPerson(reader, requirePerson(person, "immigration.statusLabel"), "immigrationStatus")),
  "immigration.documentTypeLabel": (reader, _answers, _on, person) =>
    optionLabel(
      IMMIGRATION_DOCUMENT_OPTIONS,
      readPerson(reader, requirePerson(person, "immigration.documentTypeLabel"), "immigrationDocumentType"),
    ),
  /** Q13b "Do you have an immigration document?": Yes once a document type is on file (the wizard requires one). */
  "immigration.hasDocument": (reader, _answers, _on, person) => {
    const type = readString(reader, requirePerson(person, "immigration.hasDocument"), "immigrationDocumentType")
    return type === "" ? undefined : "yes"
  },

  /** Q15: the form has one line for the children's names and dates of birth. */
  "household.caregiverChildren": (reader, _answers, _on, person) =>
    nameDobLine(reader, requirePerson(person, "household.caregiverChildren"), "caregiverChildren"),

  /** Q32: a deduction box is ticked when its yearly amount is filled (amounts are hidden under "None"). */
  ...Object.fromEntries(
    DEDUCTION_KEYS.map((key) => [
      `deductions.${key}.checked`,
      ((reader, _answers, _on, person) =>
        typeof readPerson(reader, requirePerson(person, `deductions.${key}.checked`), `deductions.amounts.${key}`) === "number"
          ? true
          : undefined) as DerivedResolver,
    ]),
  ),
}
