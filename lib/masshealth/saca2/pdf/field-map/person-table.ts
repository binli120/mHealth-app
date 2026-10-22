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
const SSN_BOXES_P2 = Array.from({ length: 9 }, (_, i) => `P2 SSN${i + 1}`)
const YES_NO_1_2 = { kind: "yesNo", yes: "1", no: "2" } as const
const CHECK = { kind: "check" } as const

/** A column for a single field. */
const one = (field: string, encode: Encoder): PersonColumn => ({ fields: [field], encode })

/**
 * Person 1 and Person 2 questions. Form pages 1-3 (Person 1: intake page through Q11d) are mapped here
 * and pages 4-6 (Q11 filer details through yearly income) in person1-b.ts. Person 2's block
 * (form pages 7-11 plus the yearly income at the top of page 12) repeats the same questions under
 * different field names, numbered 1-44; each row's `p2` column holds those names and its own
 * encoder (the on-states are read off the form per field, never assumed to match Person 1's).
 * Person 2's home address is only a "street address if not living with Person 1" line, so the
 * home address rows (street, apartment, city, state, zip, county) have no Person 2 column.
 */
export const PERSON_TABLE: PersonRow[] = [
  // Step 1 (form page 1) and Step 2 (form page 2) each repeat the name on their own line
  {
    derived: "person.fullName",
    stepId: "person1",
    p1: { fields: ["1 First name middle name last name and suffix", "1 First name middle name last name and suffix_2"], encode: "text" },
    p2: one("1 First name middle name last name and suffix_P2", "text"),
  },
  { path: "dateOfBirth", stepId: "person1", p1: one("2 Date of birth mmddyy", "date"), p2: one("2 Date of birth mmddyy_P2", "date") },
  {
    path: "sexAtBirth",
    stepId: "person1",
    p1: one("3. What was your sex assigned at birth?", { kind: "pick", states: { male: "1", female: "2" } }),
    // Person 2's Male box is the group's /On widget and Female is /2
    p2: one("3. What was this person’s sex assigned at birth?_P2", { kind: "pick", states: { male: "On", female: "2" } }),
  },
  // Person 2 only: Q4 relationship, Q5 lives with Person 1 and the street address if No
  { path: "relationshipToPerson1", stepId: "person2", p2: one("4 Relationship to Person 1_P2", "text") },
  { path: "livesWithPerson1", stepId: "person2", p2: one("5 Does this person live with Person 1?_P2", YES_NO_1_2) },
  { derived: "person.homeAddressLine", stepId: "person2", p2: one("5 Provide street address_P2", "text") },
  {
    path: "applyingForCoverage",
    stepId: "person1",
    p1: one("4 Are you applying for health or dental coverage for YOURSELF?", YES_NO_1_2),
    p2: one("14. Is this person applying for health or dental coverage?_P2", YES_NO_1_2),
  },

  // Home address (form page 1); Person 2's form has only the check box here (street line above)
  {
    path: "noHomeAddress",
    stepId: "person1",
    p1: one("Check this box if homeless", CHECK),
    p2: one("No street address Note if you check this box you must provide a mailing address_P2", CHECK),
  },
  { path: "streetAddress", stepId: "person1", p1: one("3 Street address Check this box if homeless You must provide a mailing address", "text") },
  { path: "apartment", stepId: "person1", p1: one("4 Apartment or unit number", "text") },
  { path: "city", stepId: "person1", p1: one("5 City", "text") },
  { path: "state", stepId: "person1", p1: one("6 State", "upper") },
  { path: "zip", stepId: "person1", p1: one("7 ZIP code", "text") },
  { path: "county", stepId: "person1", p1: one("8 County", "text") },

  // Institution, mailing address, contact (form page 2; Person 2: Q6-13)
  {
    path: "inInstitution",
    stepId: "person1",
    p1: one("9. Is this a hospital, nursing facility, or other institution?", YES_NO_1_2),
    p2: one("6. Is this a hospital, nursing facility, or other institution?_P2", YES_NO_1_2),
  },
  { path: "facilityName", stepId: "person1", p1: one("9. If yes facility name", "text"), p2: one("6. If Yes, facility name_P2", "text") },
  {
    path: "mailingSameAsStreet",
    stepId: "person1",
    p1: one("Check if same as street address", CHECK),
    p2: one("7 Check if same as street address_P2", CHECK),
  },
  {
    path: "mailingAddress",
    stepId: "person1",
    p1: one("10 Mailing address Check if same as street address", "text"),
    p2: one("P2.7 Mailing address Check if same as street address", "text"),
  },
  { path: "mailingApartment", stepId: "person1", p1: one("11 Apartment or unit number", "text"), p2: one("8 Apartment or unit number_P2", "text") },
  { path: "mailingCity", stepId: "person1", p1: one("12 City", "text"), p2: one("9 City_P2", "text") },
  { path: "mailingState", stepId: "person1", p1: one("13 State", "upper"), p2: one("10 State_P2", "upper") },
  { path: "mailingZip", stepId: "person1", p1: one("14 ZIP code", "text"), p2: one("11 ZIP code_P2", "text") },
  // Person 2's form has no phone or email lines (the wizard still asks them)
  { path: "mobilePhone", stepId: "person1", p1: one("16 Mobile phone number", "phone") },
  { path: "otherPhone", stepId: "person1", p1: one("17 Other phone number", "phone") },
  { path: "email", stepId: "person1", p1: one("18 Email", "text") },
  {
    path: "preferredLanguageSpoken",
    stepId: "person1",
    p1: one("20 What is your preferred language if not English Spoken", "text"),
    p2: one("13 What is this persons preferred Spoken language if not English_P2", "text"),
  },
  {
    path: "preferredLanguageWritten",
    stepId: "person1",
    p1: one("Written", "text"),
    p2: one("13 What is this persons preferred Written language if not English_P2", "text"),
  },

  // Gender identity (Q5, form page 2; Person 2: Q15)
  { path: "demographics.genderIdentity.male", stepId: "person1", p1: one("Male", CHECK), p2: one("Male_P2", CHECK) },
  { path: "demographics.genderIdentity.female", stepId: "person1", p1: one("Female ", CHECK), p2: one("Female _P2", CHECK) },
  { path: "demographics.genderIdentity.transMan", stepId: "person1", p1: one("Transgender mantrans man ", CHECK), p2: one("Transgender mantrans man_P2", CHECK) },
  {
    path: "demographics.genderIdentity.transWoman",
    stepId: "person1",
    p1: one("Transgender womantrans woman", CHECK),
    p2: one("Transgender womantrans woman_P2", CHECK),
  },
  {
    path: "demographics.genderIdentity.nonbinary",
    stepId: "person1",
    p1: one("Genderqueergender nonconformingnonbinary neither exclusively male nor female", CHECK),
    p2: one("Genderqueergender nonconformingnonbinary neither exclusively male nor female_P2", CHECK),
  },
  {
    path: "demographics.genderIdentity.notListed",
    stepId: "person1",
    p1: one("Gender identity is not listed here Please specify", CHECK),
    p2: one("Gender identity is not listed here_P2", CHECK),
  },
  {
    path: "demographics.genderIdentityOther",
    stepId: "person1",
    p1: one("Please specify if gender identity is not listed here", "text"),
    p2: one("Please specify here if gender identity is not listed_P2", "text"),
  },
  { path: "demographics.genderIdentity.dontKnow", stepId: "person1", p1: one("Dont know ", CHECK), p2: one("Dont know _P2", CHECK) },
  { path: "demographics.genderIdentity.declined", stepId: "person1", p1: one("Choose not to answer", CHECK), p2: one("Choose not to answer_P2", CHECK) },

  // Sexual orientation (Q6, form page 3; Person 2: Q16)
  {
    path: "demographics.sexualOrientation.straight",
    stepId: "person1",
    p1: one("Straight or Heterosexual ", CHECK),
    p2: one("Straight or Heterosexual_P2", CHECK),
  },
  { path: "demographics.sexualOrientation.gayOrLesbian", stepId: "person1", p1: one("Lesbian or Gay ", CHECK), p2: one("Lesbian or Gay_P2", CHECK) },
  { path: "demographics.sexualOrientation.bisexual", stepId: "person1", p1: one("Bisexual ", CHECK), p2: one("Bisexual_P2", CHECK) },
  {
    path: "demographics.sexualOrientation.queerPansexual",
    stepId: "person1",
    p1: one("Queer pansexual or questioning", CHECK),
    p2: one("Queer pansexual or questioning_P2", CHECK),
  },
  {
    path: "demographics.sexualOrientation.notListed",
    stepId: "person1",
    p1: one("Sexual Orientation is not listed Please specify", CHECK),
    p2: one("Sexual Orientation is not listed_P2", CHECK),
  },
  {
    path: "demographics.sexualOrientationOther",
    stepId: "person1",
    p1: one("Please specify if Sexual Orientation is not listed", "text"),
    p2: one("Please specify if Sexual Orientation is not listed_P2", "text"),
  },
  { path: "demographics.sexualOrientation.dontKnow", stepId: "person1", p1: one("Dont know _2", CHECK), p2: one("Dont know _P2_16", CHECK) },
  {
    path: "demographics.sexualOrientation.declined",
    stepId: "person1",
    p1: one("Choose not to answer_2", CHECK),
    p2: one("Choose not to answer_P2_16", CHECK),
  },

  // Hispanic or Latino origin (Q7), race (Q8) and ethnicity (Q9); the last two are free-text lines (Person 2: Q17-19)
  {
    path: "demographics.hispanicOrLatino",
    stepId: "person1",
    p1: one("7. Are you of Hispanic or Latino origin or descent?", {
      kind: "pick",
      states: { yes: "1", no: "2", dontKnow: "3", declined: "4" },
    }),
    p2: one("17. Is this person of Hispanic or Latino origin or descent?", {
      kind: "pick",
      states: { yes: "1", no: "2", dontKnow: "3", declined: "4" },
    }),
  },
  {
    derived: "demographics.race",
    stepId: "person1",
    p1: one("Race refers to a persons selfidentification with one or more social groups Individuals may report multiple races", "text"),
    p2: one("18 Race_P2", "text"),
  },
  {
    derived: "demographics.ethnicity",
    stepId: "person1",
    p1: one("Ethnicity  refers to your background heritage culture ancestry or the country where you or your family were born", "text"),
    p2: one("19 Ethnicity_P2", "text"),
  },

  // Social Security number (Q10; Person 2: Q20)
  {
    path: "hasSsn",
    stepId: "person1",
    p1: one("10. Do you have a social security number (SSN)?", YES_NO_1_2),
    p2: one("20. Does this person have a social security number (SSN)?_P2", YES_NO_1_2),
  },
  { path: "ssn", stepId: "person1", p1: { fields: SSN_BOXES, encode: { kind: "ssn" } }, p2: { fields: SSN_BOXES_P2, encode: { kind: "ssn" } } },
  {
    path: "noSsnReason",
    stepId: "person1",
    p1: one("10. If No, check one of the following reasons", {
      kind: "pick",
      states: { illness: "1", justApplied: "2", noncitizenException: "3", religiousException: "4" },
    }),
    p2: one("If No, check one of the following reasons_P2", {
      kind: "pick",
      states: { illness: "1", justApplied: "2", noncitizenException: "3", religiousException: "4" },
    }),
  },
  {
    path: "nameMatchesSsnCard",
    stepId: "person1",
    p1: one("is your name on this application the same as your name on your social security card?", YES_NO_1_2),
    p2: one("Is the name on this application the same as the name on their social security card?_P2", YES_NO_1_2),
  },
  {
    path: "ssnCardName",
    stepId: "person1",
    p1: one("First name middle name last name and suffix_2", "text"),
    p2: one("Is the name on this application the same as the name on their social security card ", "text"),
  },

  // Tax filing (Q11a-d; Person 2: Q21)
  {
    path: "tax.agreesToFileIfAptc",
    stepId: "person1",
    p1: one("11. do you agree to file a federal tax return for the tax year that the credits are received?", YES_NO_1_2),
    p2: one("21. If this person gets an Advance Premium Tax Credit (APTC)_P2", YES_NO_1_2),
  },
  // "If No (to Q11), skip to question d": the married question is only written when Q11 is Yes
  {
    derived: "tax.isLegallyMarried",
    stepId: "person1",
    p1: one("Are you legally married?", YES_NO_1_2),
    p2: one("21a. Is this person legally married?_P2", YES_NO_1_2),
  },
  {
    derived: "tax.spouseNameAndDob",
    stepId: "person1",
    p1: one("If Yes, list name of spouse and date of birth", "text"),
    p2: one("21a. If Yes, list name of spouse and date of birth_P2", "text"),
  },
  {
    path: "tax.plansJointReturn",
    stepId: "person1",
    p1: one("Do you plan to file a joint federal tax return with your spouse for the tax year for which you are applying?", YES_NO_1_2),
    p2: one(
      "21b. Does this person plan to file a joint federal tax return with a spouse for the tax year for which this person is applying?_P2",
      YES_NO_1_2,
    ),
  },
  {
    path: "tax.claimsDependents",
    stepId: "person1",
    p1: one("Will you claim any dependents on your federal income tax return for the year which you are applying?", YES_NO_1_2),
    p2: one(
      "21c. Will this person claim any dependents on this person’s federal income tax return for the year for which this person is applying?_P2",
      YES_NO_1_2,
    ),
  },
  {
    derived: "tax.dependentsList",
    stepId: "person1",
    p1: one("List name(s) and date(s) of birth of dependents", "text"),
    p2: one("21c. List names and dates of birth of dependents_P2", "text"),
  },
  {
    path: "tax.claimedAsDependent",
    stepId: "person1",
    p1: one("Will you be claimed as a dependent on someone else's federal income tax return?", YES_NO_1_2),
    p2: one(
      "21d. Will this person be claimed as a dependent on someone else's federal income tax return for the year for which this person is applying?_P2",
      YES_NO_1_2,
    ),
  },
  // The template names Person 1's field "How are you related to the tax filer"; its printed label (and
  // position, after "If Yes, please list the name of the tax filer.") is the tax filer's NAME.
  {
    path: "tax.taxFiler.name",
    stepId: "person1",
    p1: one("How are you related to the tax filer", "text"),
    p2: one("21d. If Yes, please list the name of the tax filer._P2", "text"),
  },

  // Form pages 4-6 (Q11e filer details through the yearly income) and Person 2's pages 8-12 (Q21d-44)
  ...PERSON1_B_ROWS,
]
