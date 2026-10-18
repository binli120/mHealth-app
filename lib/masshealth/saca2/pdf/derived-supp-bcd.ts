/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PREMIUM_FREQUENCIES } from "../questions/options"
import type { Saca2StepId } from "../schema"
import { encodeText } from "./encoders"
import type { DerivedRegistry } from "./pdf-fill"
import type { VisibleReader } from "./visible-reader"

/**
 * Supplements B, C and D (form pages 29-31, PDF indexes 30-32). Each page is ONE unit of the form:
 * B holds two people side by side, C one person, D one job. The form says to attach a copy of the page
 * for more, so the generator appends real copies (page-duplication.ts) placed right after the original.
 * The capacities below are what the template pages plus their copies hold; they equal the wizard's
 * `maxItems` (pinned by a test) so nothing can fall past them.
 */
export type CopyRegion = "suppB" | "suppC" | "suppD"

/** AI/AN people per Supplement B page. */
export const SUPP_B_PER_PAGE = 2
/** Supplement B pages in all (the template page + 2 copies) and so the people they hold. */
export const SUPP_B_PAGES = 3
export const SUPP_B_CAPACITY = SUPP_B_PER_PAGE * SUPP_B_PAGES
/** Supplement C pages in all: one per qualifying person (Person 1, Person 2). */
export const SUPP_C_PAGES = 2
/** Supplement D pages in all: one per job. */
export const SUPP_D_PAGES = 4

export const SUPP_B_MEMBERS_PATH = "supplements.b.members"
export const SUPP_D_JOBS_PATH = "supplements.d.jobs"

type PersonIndex = 0 | 1

const PERSON_STEP = (person: PersonIndex): Saca2StepId => (person === 1 ? "person2" : "person1")

/**
 * The people who get their own Supplement C page, in order (Person 1 then Person 2). A person
 * qualifies when the wizard shows them the Supplement C questions: that is decided by the step content's
 * own visibility (the PCA chain answered Yes), not by a value, so a still blank page is kept too.
 */
export function suppCPersons(reader: VisibleReader): PersonIndex[] {
  return ([0, 1] as const).filter((person) =>
    reader.isVisible({ kind: "answer", stepId: "suppC", path: `supplements.c.${person}.healthProblems.0` }),
  )
}

/** Extra pages (copies of the template page) the answers need for a region; 0 when everything fits the template page. */
export function copiesNeeded(region: CopyRegion, reader: VisibleReader): number {
  switch (region) {
    case "suppB":
      return Math.max(0, Math.min(SUPP_B_PAGES, Math.ceil(reader.rows("suppB", SUPP_B_MEMBERS_PATH) / SUPP_B_PER_PAGE)) - 1)
    case "suppC":
      return Math.max(0, suppCPersons(reader).length - 1)
    case "suppD":
      return Math.max(0, Math.min(SUPP_D_PAGES, reader.rows("suppD", SUPP_D_JOBS_PATH)) - 1)
  }
}

const FREQUENCY_LABELS = new Map(PREMIUM_FREQUENCIES.map((option) => [option.value, option.label]))
const frequencyLabel = (raw: unknown): string | undefined => (typeof raw === "string" ? FREQUENCY_LABELS.get(raw) : undefined)

// ---------------------------------------------------------------------------------------------
// Supplement C: the person's header block and answers
// ---------------------------------------------------------------------------------------------

const readPerson = (reader: VisibleReader, person: PersonIndex, path: string): unknown =>
  reader.get({ kind: "answer", stepId: PERSON_STEP(person), path, person })

const readText = (reader: VisibleReader, person: PersonIndex, path: string): string => {
  const value = readPerson(reader, person, path)
  return typeof value === "string" ? value.trim() : ""
}

/** The street, city, state and ZIP printed for a person: their own home address, else a spouse's living with Person 1, else the mailing address. */
function addressOf(reader: VisibleReader, person: PersonIndex) {
  const home = (who: PersonIndex) => ({
    street: [readText(reader, who, "streetAddress"), readText(reader, who, "apartment")].filter((p) => p !== "").join(", "),
    city: readText(reader, who, "city"),
    state: readText(reader, who, "state").toUpperCase(),
    zip: readText(reader, who, "zip"),
  })
  const own = home(person)
  if (own.street !== "") return own
  if (person === 1 && readPerson(reader, 1, "livesWithPerson1") === "yes") {
    const first = home(0)
    if (first.street !== "") return first
  }
  return {
    street: [readText(reader, person, "mailingAddress"), readText(reader, person, "mailingApartment")].filter((p) => p !== "").join(", "),
    city: readText(reader, person, "mailingCity"),
    state: readText(reader, person, "mailingState").toUpperCase(),
    zip: readText(reader, person, "mailingZip"),
  }
}

const ssnLine = (raw: unknown): string | undefined => {
  const digits = typeof raw === "string" ? raw.replace(/\D/g, "") : ""
  return digits.length === 9 ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : undefined
}

const nonEmpty = (value: string): string | undefined => (value === "" ? undefined : value)

const PERSON_HEADER: Record<string, (reader: VisibleReader, person: PersonIndex) => unknown> = {
  lastName: (reader, person) => nonEmpty([readText(reader, person, "lastName"), readText(reader, person, "suffix")].filter((p) => p !== "").join(" ")),
  firstName: (reader, person) => nonEmpty(readText(reader, person, "firstName")),
  /** The form's MI box holds the initial of the middle name. */
  middleInitial: (reader, person) => nonEmpty(readText(reader, person, "middleName").charAt(0).toUpperCase()),
  phone: (reader, person) => readPerson(reader, person, "mobilePhone") ?? readPerson(reader, person, "otherPhone"),
  /** The form's Social Security number is one text line, dashed. */
  ssn: (reader, person) => ssnLine(readPerson(reader, person, "ssn")),
  dateOfBirth: (reader, person) => readPerson(reader, person, "dateOfBirth"),
  sex: (reader, person) => readPerson(reader, person, "sexAtBirth"),
  street: (reader, person) => nonEmpty(addressOf(reader, person).street),
  city: (reader, person) => nonEmpty(addressOf(reader, person).city),
  state: (reader, person) => nonEmpty(addressOf(reader, person).state),
  zip: (reader, person) => nonEmpty(addressOf(reader, person).zip),
}

export const SUPP_C_HEADER_KEYS = Object.keys(PERSON_HEADER)
export const SUPP_C_ACTIVITIES = ["mobility", "medications", "bathing", "dressing", "rangeOfMotion", "eating", "toileting"] as const
export const SUPP_C_HEALTH_LINES = 3
export const SUPP_C_CAREGIVER_LINES = 2

const registry: DerivedRegistry = {}

for (let page = 0; page < SUPP_C_PAGES; page += 1) {
  /** The person on this page: the `page`-th qualifying person (a hidden step has none, so nothing is written). */
  const personOf = (reader: VisibleReader): PersonIndex | undefined => suppCPersons(reader)[page]
  const c = (person: PersonIndex, path: string) => `supplements.c.${person}.${path}`

  for (const [key, read] of Object.entries(PERSON_HEADER)) {
    registry[`suppC.${page}.person.${key}`] = (reader) => {
      const person = personOf(reader)
      return person === undefined ? undefined : read(reader, person)
    }
  }
  for (let line = 0; line < SUPP_C_HEALTH_LINES; line += 1) {
    registry[`suppC.${page}.health.${line}`] = (reader) => {
      const person = personOf(reader)
      return person === undefined ? undefined : reader.get({ kind: "answer", stepId: "suppC", path: c(person, `healthProblems.${line}`) })
    }
  }
  for (const activity of SUPP_C_ACTIVITIES) {
    for (const part of ["needsHandsOnHelp", "timesPerDay", "daysPerWeek"] as const) {
      registry[`suppC.${page}.activity.${activity}.${part}`] = (reader) => {
        const person = personOf(reader)
        return person === undefined ? undefined : reader.get({ kind: "answer", stepId: "suppC", path: c(person, `activities.${activity}.${part}`) })
      }
    }
  }
  for (let line = 0; line < SUPP_C_CAREGIVER_LINES; line += 1) {
    for (const key of ["name", "relationship"] as const) {
      registry[`suppC.${page}.caregiver.${line}.${key}`] = (reader) => {
        const person = personOf(reader)
        return person === undefined
          ? undefined
          : reader.get({ kind: "row", stepId: "suppC", path: c(person, "caregivers"), index: line, key })
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Supplement B: "How often?" is a text line; the wizard's value is written as its label
// ---------------------------------------------------------------------------------------------

for (let member = 0; member < SUPP_B_CAPACITY; member += 1) {
  registry[`suppB.${member}.excludedIncomeFrequency`] = (reader) =>
    frequencyLabel(reader.get({ kind: "row", stepId: "suppB", path: SUPP_B_MEMBERS_PATH, index: member, key: "excludedIncomeFrequency" }))
}

// ---------------------------------------------------------------------------------------------
// Supplement D: frequencies as text, and the one coverage end date that has two lines
// ---------------------------------------------------------------------------------------------

const jobRow = (reader: VisibleReader, job: number, key: string): unknown =>
  reader.get({ kind: "row", stepId: "suppD", path: SUPP_D_JOBS_PATH, index: job, key })

for (let job = 0; job < SUPP_D_PAGES; job += 1) {
  for (const [name, key] of [
    ["individual", "individualPremiumFrequency"],
    ["family", "familyPremiumFrequency"],
    ["change", "changePremiumFrequency"],
  ] as const) {
    registry[`suppD.${job}.frequency.${name}`] = (reader) => frequencyLabel(jobRow(reader, job, key))
  }
  // 16a and 16b share the wizard's one "coverage end date"; the chosen change decides the line
  for (const [name, kind] of [
    ["employerWillNotOffer", "employerWillNotOffer"],
    ["personWillDrop", "personWillDrop"],
  ] as const) {
    registry[`suppD.${job}.endDate.${name}`] = (reader) =>
      jobRow(reader, job, "upcomingChange") === kind ? jobRow(reader, job, "changeEndDate") : undefined
  }
}

export const SUPP_BCD_DERIVED: DerivedRegistry = registry

/** The Federal Tax ID as the form's nine boxes need it: nine digits, else it cannot be written there. */
export const federalTaxIdDigits = (raw: unknown): string | undefined => {
  const digits = encodeText("text", raw)?.replace(/\D/g, "") ?? ""
  return digits.length === 9 ? digits : undefined
}
