/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { encodeText } from "./encoders"
import { householdHasSpouse } from "./derived-assets"
import { addressOf, readPerson, readText, ssnLine } from "./derived-supp-bcd"
import type { DerivedRegistry } from "./pdf-fill"
import type { VisibleReader } from "./visible-reader"

/**
 * The two attachments: the ARD-1122 (PDF indexes 34-37; fields on 35-37) and IRS Form 4506 (38-39; fields on 38).
 * Every read goes through the visible reader. The ARD step and the IRS 4506 step are gated by their own
 * visibility (a hidden step reads nothing), and the ARD's three section pages are gated by the section the
 * wizard recorded, so a page of an unchosen section stays empty even when stale answers are left behind.
 */
type PersonIndex = 0 | 1

// ---------------------------------------------------------------------------------------------
// ARD-1122
// ---------------------------------------------------------------------------------------------

/** ARD section pages: page 1 = Section I (idx 35), 2 = Section II (idx 36), 3 = Section III (idx 37). */
export const ARD_SECTIONS = { 1: "applicantDesignates", 2: "cannotDesignate", 3: "appointedByLaw" } as const
export type ArdSection = keyof typeof ARD_SECTIONS

const ardAnswer = (reader: VisibleReader, key: string): unknown =>
  reader.get({ kind: "answer", stepId: "ard", path: `attachments.ard.${key}` })

const inSection = (reader: VisibleReader, section: ArdSection): boolean => ardAnswer(reader, "section") === ARD_SECTIONS[section]

/** First, middle, last name and suffix as one line (as the Person name line elsewhere on the form). */
function personName(reader: VisibleReader, person: PersonIndex): string | undefined {
  const name = ["firstName", "middleName", "lastName", "suffix"]
    .map((key) => readText(reader, person, key))
    .filter((part) => part !== "")
    .join(" ")
  return name === "" ? undefined : name
}

/** The last four digits of a nine-digit SSN, else nothing (never a partial SSN). */
function lastFour(raw: unknown): string | undefined {
  const digits = typeof raw === "string" ? raw.replace(/\D/g, "") : ""
  return digits.length === 9 ? digits.slice(5) : undefined
}

/** "street, city, ST ZIP" on the form's single address line. */
function representativeAddress(reader: VisibleReader): string | undefined {
  const text = (key: string) => {
    const value = ardAnswer(reader, key)
    return typeof value === "string" ? value.trim() : ""
  }
  const stateZip = [text("repState").toUpperCase(), text("repZip")].filter((part) => part !== "").join(" ")
  const line = [text("repStreet"), text("repCity"), stateZip].filter((part) => part !== "").join(", ")
  return line === "" ? undefined : line
}

const registry: DerivedRegistry = {}

for (const section of [1, 2, 3] as const) {
  // the applicant is Person 1 (the form is for the application's applicant)
  registry[`ard.${section}.applicant.name`] = (reader) => (inSection(reader, section) ? personName(reader, 0) : undefined)
  registry[`ard.${section}.applicant.dateOfBirth`] = (reader) =>
    inSection(reader, section) ? readPerson(reader, 0, "dateOfBirth") : undefined
  registry[`ard.${section}.applicant.ssnLast4`] = (reader) =>
    inSection(reader, section) ? lastFour(readPerson(reader, 0, "ssn")) : undefined
  registry[`ard.${section}.rep.name`] = (reader) => (inSection(reader, section) ? ardAnswer(reader, "repName") : undefined)
  registry[`ard.${section}.rep.phone`] = (reader) => (inSection(reader, section) ? ardAnswer(reader, "repPhone") : undefined)
  registry[`ard.${section}.rep.address`] = (reader) => (inSection(reader, section) ? representativeAddress(reader) : undefined)
}
// Section I Part A has the applicant's email; Sections II and III do not
registry["ard.1.applicant.email"] = (reader) => (inSection(reader, 1) ? readPerson(reader, 0, "email") : undefined)
// Sections II and III print the representative's email in Part A's single block; Section I prints it only under B1 (a person)
for (const section of [2, 3] as const) {
  registry[`ard.${section}.rep.email`] = (reader) => (inSection(reader, section) ? ardAnswer(reader, "repEmail") : undefined)
}
// Section I: B1 is for a person, B2 for an organization
const section1Of = (kind: "person" | "organization", key: string) => (reader: VisibleReader) =>
  inSection(reader, 1) && ardAnswer(reader, "repKind") === kind ? ardAnswer(reader, key) : undefined
registry["ard.1.person.name"] = section1Of("person", "repName")
registry["ard.1.person.email"] = section1Of("person", "repEmail")
registry["ard.1.org.staffName"] = section1Of("organization", "staffName")
registry["ard.1.org.staffEmail"] = section1Of("organization", "staffEmail")
registry["ard.1.org.name"] = section1Of("organization", "orgName")
// Section II: the officer who signs for an organization
registry["ard.2.officerName"] = (reader) => (inSection(reader, 2) ? ardAnswer(reader, "officerName") : undefined)
registry["ard.2.officerTitle"] = (reader) => (inSection(reader, 2) ? ardAnswer(reader, "officerTitle") : undefined)

// ---------------------------------------------------------------------------------------------
// IRS Form 4506
// ---------------------------------------------------------------------------------------------

/** The form's line 7 has two rows of four dates, written mm / dd / yyyy in three boxes each. */
export const IRS_YEARS_PATH = "attachments.irs4506.yearsRequested"
export const IRS_YEAR_SLOTS = 8

const irsAnswer = (reader: VisibleReader, key: string): unknown =>
  reader.get({ kind: "answer", stepId: "irs4506", path: `attachments.irs4506.${key}` })

/** Whether the wizard shows the IRS 4506 step at all (its pages are kept). */
const irsShown = (reader: VisibleReader): boolean =>
  reader.isVisible({ kind: "answer", stepId: "irs4506", path: "attachments.irs4506.jointReturn" })

/** An ITIN or EIN the applicant typed on the IRS step: nine digits as "123-45-6789", anything else as typed. */
const taxpayerIdNumber = (raw: unknown): string | undefined => ssnLine(raw) ?? encodeText("text", raw)

const irsJoint = (reader: VisibleReader, answers: Parameters<typeof householdHasSpouse>[1], on: Date): boolean =>
  irsAnswer(reader, "jointReturn") === "yes" && householdHasSpouse(reader, answers, on)

export const IRS_DERIVED: DerivedRegistry = {
  /** Line 1a: the applicant (Person 1) is the taxpayer. */
  "irs4506.name1": (reader) => (irsShown(reader) ? personName(reader, 0) : undefined),
  /** Line 1b: Person 1's SSN (only when complete: a partial SSN is never printed), else the ITIN the wizard asks for when Person 1 has no SSN. */
  "irs4506.id1": (reader) =>
    irsShown(reader) ? (ssnLine(readPerson(reader, 0, "ssn")) ?? taxpayerIdNumber(irsAnswer(reader, "taxpayerId"))) : undefined,
  /** Lines 2a and 2b: the spouse of a joint return, only when the household really has a spouse. */
  "irs4506.name2": (reader, answers, on) => (irsShown(reader) && irsJoint(reader, answers, on) ? personName(reader, 1) : undefined),
  "irs4506.id2": (reader, answers, on) =>
    irsShown(reader) && irsJoint(reader, answers, on) ? ssnLine(readPerson(reader, 1, "ssn")) : undefined,
  /** Line 3: Person 1's current address on one line. */
  "irs4506.address": (reader) => {
    if (!irsShown(reader)) return undefined
    const { street, city, state, zip } = addressOf(reader, 0)
    const line = [street, city, [state, zip].filter((part) => part !== "").join(" ")].filter((part) => part !== "").join(", ")
    return line === "" ? undefined : line
  },
}

for (let slot = 0; slot < IRS_YEAR_SLOTS; slot += 1) {
  const part = (index: number) => (reader: VisibleReader) => {
    const raw = reader.get({ kind: "row", stepId: "irs4506", path: IRS_YEARS_PATH, index: slot, key: "periodEnd" })
    return encodeText("date", raw)?.split("/")[index]
  }
  IRS_DERIVED[`irs4506.year.${slot}.month`] = part(0)
  IRS_DERIVED[`irs4506.year.${slot}.day`] = part(1)
  IRS_DERIVED[`irs4506.year.${slot}.year`] = part(2)
}

export const ATTACHMENTS_DERIVED: DerivedRegistry = { ...registry, ...IRS_DERIVED }
