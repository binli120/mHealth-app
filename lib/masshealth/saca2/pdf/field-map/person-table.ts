/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Encoder, FieldEntry, Source } from "../types"
import { PERSON1_B_ROWS } from "./person1-b"

/** The field names and encoding of one person's copy of a question. */
export interface PersonColumn {
  fields: string[]
  encode: Encoder
}

interface PersonRowBase {
  /** Step whose question content holds the question (Person 1 and Person 2 share one content table). */
  stepId: "person1" | "person2"
  /** Person 1's form fields; omit when the form has no Person 1 copy of the question. */
  p1?: PersonColumn
  /** Person 2's form fields; omit until the form region that holds them is mapped. */
  p2?: PersonColumn
}

/** A question read straight from the answers, by the question `path` the step content writes (relative). */
interface PersonAnswerRow extends PersonRowBase {
  path: string
  derived?: undefined
  item?: undefined
}

/** A value computed in derived.ts from several answers; `derived` is its registry id. */
interface PersonDerivedRow extends PersonRowBase {
  derived: string
  path?: undefined
  item?: undefined
}

/** One field of one row of a repeater (e.g. the first rental unit's address); `path` is the repeater's. */
interface PersonItemRow extends PersonRowBase {
  item: { path: string; index: number; key: string }
  path?: undefined
  derived?: undefined
}

/**
 * One row per question; the two person columns hold the form fields for that question. Both persons
 * answer the same question, so the row's `path` (or `derived` id) is shared and only the field names
 * and encoders differ (checkbox on-states often do).
 */
export type PersonRow = PersonAnswerRow | PersonDerivedRow | PersonItemRow

function sourceFor(row: PersonRow, person: 0 | 1): Source {
  if (row.derived !== undefined) return { kind: "derived", id: row.derived, person }
  if (row.item !== undefined) return { kind: "row", stepId: row.stepId, ...row.item, person }
  return { kind: "answer", stepId: row.stepId, path: row.path, person }
}

function entryFor(row: PersonRow, column: PersonColumn, person: 0 | 1): FieldEntry {
  return { fields: column.fields, source: sourceFor(row, person), encode: column.encode }
}

/** Expands the table into plain map entries: the `p1` column reads Person 1, the `p2` column Person 2. */
export function expandPersonTable(table: PersonRow[]): FieldEntry[] {
  return table.flatMap((row) => [
    ...(row.p1 ? [entryFor(row, row.p1, 0)] : []),
    ...(row.p2 ? [entryFor(row, row.p2, 1)] : []),
  ])
}

const SSN_BOXES = Array.from({ length: 9 }, (_, i) => `10. SSN${i + 1}`)
const YES_NO_1_2 = { kind: "yesNo", yes: "1", no: "2" } as const
const CHECK = { kind: "check" } as const

/** A column for a single field. */
const one = (field: string, encode: Encoder): PersonColumn => ({ fields: [field], encode })

/**
 * Person 1 and Person 2 questions. Form pages 1-3 (Person 1: intake page through Q11d) are mapped here
 * and pages 4-6 (Q11 filer details through yearly income) in person1-b.ts; later regions add rows and
 * the `p2` columns.
 */
export const PERSON_TABLE: PersonRow[] = [
  // Step 1 (form page 1) and Step 2 (form page 2) each repeat the name on their own line
  {
    derived: "person.fullName",
    stepId: "person1",
    p1: { fields: ["1 First name middle name last name and suffix", "1 First name middle name last name and suffix_2"], encode: "text" },
  },
  { path: "dateOfBirth", stepId: "person1", p1: one("2 Date of birth mmddyy", "date") },
  { path: "sexAtBirth", stepId: "person1", p1: one("3. What was your sex assigned at birth?", { kind: "pick", states: { male: "1", female: "2" } }) },
  { path: "applyingForCoverage", stepId: "person1", p1: one("4 Are you applying for health or dental coverage for YOURSELF?", YES_NO_1_2) },

  // Home address (form page 1)
  { path: "noHomeAddress", stepId: "person1", p1: one("Check this box if homeless", CHECK) },
  { path: "streetAddress", stepId: "person1", p1: one("3 Street address Check this box if homeless You must provide a mailing address", "text") },
  { path: "apartment", stepId: "person1", p1: one("4 Apartment or unit number", "text") },
  { path: "city", stepId: "person1", p1: one("5 City", "text") },
  { path: "state", stepId: "person1", p1: one("6 State", "upper") },
  { path: "zip", stepId: "person1", p1: one("7 ZIP code", "text") },
  { path: "county", stepId: "person1", p1: one("8 County", "text") },

  // Institution, mailing address, contact (form page 2)
  { path: "inInstitution", stepId: "person1", p1: one("9. Is this a hospital, nursing facility, or other institution?", YES_NO_1_2) },
  { path: "facilityName", stepId: "person1", p1: one("9. If yes facility name", "text") },
  { path: "mailingSameAsStreet", stepId: "person1", p1: one("Check if same as street address", CHECK) },
  { path: "mailingAddress", stepId: "person1", p1: one("10 Mailing address Check if same as street address", "text") },
  { path: "mailingApartment", stepId: "person1", p1: one("11 Apartment or unit number", "text") },
  { path: "mailingCity", stepId: "person1", p1: one("12 City", "text") },
  { path: "mailingState", stepId: "person1", p1: one("13 State", "upper") },
  { path: "mailingZip", stepId: "person1", p1: one("14 ZIP code", "text") },
  { path: "mobilePhone", stepId: "person1", p1: one("16 Mobile phone number", "phone") },
  { path: "otherPhone", stepId: "person1", p1: one("17 Other phone number", "phone") },
  { path: "email", stepId: "person1", p1: one("18 Email", "text") },
  { path: "preferredLanguageSpoken", stepId: "person1", p1: one("20 What is your preferred language if not English Spoken", "text") },
  { path: "preferredLanguageWritten", stepId: "person1", p1: one("Written", "text") },

  // Gender identity (Q5, form page 2)
  { path: "demographics.genderIdentity.male", stepId: "person1", p1: one("Male", CHECK) },
  { path: "demographics.genderIdentity.female", stepId: "person1", p1: one("Female ", CHECK) },
  { path: "demographics.genderIdentity.transMan", stepId: "person1", p1: one("Transgender mantrans man ", CHECK) },
  { path: "demographics.genderIdentity.transWoman", stepId: "person1", p1: one("Transgender womantrans woman", CHECK) },
  {
    path: "demographics.genderIdentity.nonbinary",
    stepId: "person1",
    p1: one("Genderqueergender nonconformingnonbinary neither exclusively male nor female", CHECK),
  },
  { path: "demographics.genderIdentity.notListed", stepId: "person1", p1: one("Gender identity is not listed here Please specify", CHECK) },
  { path: "demographics.genderIdentityOther", stepId: "person1", p1: one("Please specify if gender identity is not listed here", "text") },
  { path: "demographics.genderIdentity.dontKnow", stepId: "person1", p1: one("Dont know ", CHECK) },
  { path: "demographics.genderIdentity.declined", stepId: "person1", p1: one("Choose not to answer", CHECK) },

  // Sexual orientation (Q6, form page 3)
  { path: "demographics.sexualOrientation.straight", stepId: "person1", p1: one("Straight or Heterosexual ", CHECK) },
  { path: "demographics.sexualOrientation.gayOrLesbian", stepId: "person1", p1: one("Lesbian or Gay ", CHECK) },
  { path: "demographics.sexualOrientation.bisexual", stepId: "person1", p1: one("Bisexual ", CHECK) },
  { path: "demographics.sexualOrientation.queerPansexual", stepId: "person1", p1: one("Queer pansexual or questioning", CHECK) },
  { path: "demographics.sexualOrientation.notListed", stepId: "person1", p1: one("Sexual Orientation is not listed Please specify", CHECK) },
  { path: "demographics.sexualOrientationOther", stepId: "person1", p1: one("Please specify if Sexual Orientation is not listed", "text") },
  { path: "demographics.sexualOrientation.dontKnow", stepId: "person1", p1: one("Dont know _2", CHECK) },
  { path: "demographics.sexualOrientation.declined", stepId: "person1", p1: one("Choose not to answer_2", CHECK) },

  // Hispanic or Latino origin (Q7), race (Q8) and ethnicity (Q9); the last two are free-text lines
  {
    path: "demographics.hispanicOrLatino",
    stepId: "person1",
    p1: one("7. Are you of Hispanic or Latino origin or descent?", {
      kind: "pick",
      states: { yes: "1", no: "2", dontKnow: "3", declined: "4" },
    }),
  },
  {
    derived: "demographics.race",
    stepId: "person1",
    p1: one("Race refers to a persons selfidentification with one or more social groups Individuals may report multiple races", "text"),
  },
  {
    derived: "demographics.ethnicity",
    stepId: "person1",
    p1: one("Ethnicity  refers to your background heritage culture ancestry or the country where you or your family were born", "text"),
  },

  // Social Security number (Q10)
  { path: "hasSsn", stepId: "person1", p1: one("10. Do you have a social security number (SSN)?", YES_NO_1_2) },
  { path: "ssn", stepId: "person1", p1: { fields: SSN_BOXES, encode: { kind: "ssn" } } },
  {
    path: "noSsnReason",
    stepId: "person1",
    p1: one("10. If No, check one of the following reasons", {
      kind: "pick",
      states: { illness: "1", justApplied: "2", noncitizenException: "3", religiousException: "4" },
    }),
  },
  {
    path: "nameMatchesSsnCard",
    stepId: "person1",
    p1: one("is your name on this application the same as your name on your social security card?", YES_NO_1_2),
  },
  { path: "ssnCardName", stepId: "person1", p1: one("First name middle name last name and suffix_2", "text") },

  // Tax filing (Q11a-d)
  {
    path: "tax.agreesToFileIfAptc",
    stepId: "person1",
    p1: one("11. do you agree to file a federal tax return for the tax year that the credits are received?", YES_NO_1_2),
  },
  // "If No (to Q11), skip to question d": the married question is only written when Q11 is Yes
  { derived: "tax.isLegallyMarried", stepId: "person1", p1: one("Are you legally married?", YES_NO_1_2) },
  { derived: "tax.spouseNameAndDob", stepId: "person1", p1: one("If Yes, list name of spouse and date of birth", "text") },
  {
    path: "tax.plansJointReturn",
    stepId: "person1",
    p1: one("Do you plan to file a joint federal tax return with your spouse for the tax year for which you are applying?", YES_NO_1_2),
  },
  {
    path: "tax.claimsDependents",
    stepId: "person1",
    p1: one("Will you claim any dependents on your federal income tax return for the year which you are applying?", YES_NO_1_2),
  },
  { derived: "tax.dependentsList", stepId: "person1", p1: one("List name(s) and date(s) of birth of dependents", "text") },
  {
    path: "tax.claimedAsDependent",
    stepId: "person1",
    p1: one("Will you be claimed as a dependent on someone else's federal income tax return?", YES_NO_1_2),
  },
  // The template names this field "How are you related to the tax filer"; its printed label (and
  // position, after "If Yes, please list the name of the tax filer.") is the tax filer's NAME.
  { path: "tax.taxFiler.name", stepId: "person1", p1: one("How are you related to the tax filer", "text") },

  // Form pages 4-6 (Q11e filer details through the yearly income)
  ...PERSON1_B_ROWS,
]
