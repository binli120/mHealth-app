/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"

import { completeFacilityCouple, completeRichHousehold } from "../../__tests__/complete-answers"
import type { Saca2Answers } from "../../types"
import { FIELD_MAP } from "../field-map"
import { PERSON_TABLE, expandPersonTable } from "../field-map/person-table"
import { getFieldInfo } from "../inventory"
import { fillSaca2Pdf } from "../pdf-fill"
import { readFilled, type FilledValues } from "./helpers/read-filled"

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"
/** This region only: fields on form pages 1-3 (PDF indexes 2-4); later regions are tested in their own files. */
const MAPPED = new Set(FIELD_MAP.flatMap((e) => e.fields).filter((name) => getFieldInfo(name)!.pages.every((page) => page <= 4)))

const NAME_1 = "1 First name middle name last name and suffix"
const NAME_2 = "1 First name middle name last name and suffix_2"
const STREET = "3 Street address Check this box if homeless You must provide a mailing address"
const MAILING = "10 Mailing address Check if same as street address"
const SEX = "3. What was your sex assigned at birth?"
const APPLYING = "4 Are you applying for health or dental coverage for YOURSELF?"
const INSTITUTION = "9. Is this a hospital, nursing facility, or other institution?"
const HISPANIC = "7. Are you of Hispanic or Latino origin or descent?"
const RACE = "Race refers to a persons selfidentification with one or more social groups Individuals may report multiple races"
const ETHNICITY = "Ethnicity  refers to your background heritage culture ancestry or the country where you or your family were born"
const HAS_SSN = "10. Do you have a social security number (SSN)?"
const NO_SSN_REASON = "10. If No, check one of the following reasons"
const SSN_CARD_MATCH = "is your name on this application the same as your name on your social security card?"
const SSN_CARD_NAME = "First name middle name last name and suffix_2"
const AGREES = "11. do you agree to file a federal tax return for the tax year that the credits are received?"
const MARRIED = "Are you legally married?"
const SPOUSE = "If Yes, list name of spouse and date of birth"
const JOINT = "Do you plan to file a joint federal tax return with your spouse for the tax year for which you are applying?"
const CLAIMS = "Will you claim any dependents on your federal income tax return for the year which you are applying?"
const DEPENDENTS = "List name(s) and date(s) of birth of dependents"
const CLAIMED = "Will you be claimed as a dependent on someone else's federal income tax return?"
const FILER = "How are you related to the tax filer"
const SSN_BOXES = Array.from({ length: 9 }, (_, i) => `10. SSN${i + 1}`)

const ssnBoxes = (digits: string) => Object.fromEntries([...digits].map((d, i) => [SSN_BOXES[i], d]))

/** Fills with the real map and reads back only the fields mapped so far (checkboxes: only those selected). */
async function fillRegion(answers: Saca2Answers): Promise<FilledValues> {
  const { text, checks } = await readFilled(await fillSaca2Pdf(answers, null, ON))
  return {
    text: Object.fromEntries(Object.entries(text).filter(([name]) => MAPPED.has(name))),
    checks: Object.fromEntries(Object.entries(checks).filter(([name, state]) => MAPPED.has(name) && state !== null)),
  }
}

function expectNoSentinel(values: FilledValues) {
  expect(JSON.stringify(values)).not.toContain(SENTINEL)
}

describe("PERSON_TABLE", () => {
  it("expands a row into a Person 1 entry that reads Person 1, and a derived row into a derived source", () => {
    const entries = expandPersonTable(PERSON_TABLE)
    expect(entries.find((e) => e.fields[0] === "5 City")?.source).toEqual({
      kind: "answer",
      stepId: "person1",
      path: "city",
      person: 0,
    })
    expect(entries.find((e) => e.fields[0] === NAME_1)?.source).toEqual({
      kind: "derived",
      id: "person.fullName",
      person: 0,
    })
  })

  it("adds a Person 2 entry only for rows that have a p2 column", () => {
    const entries = expandPersonTable([
      { path: "city", stepId: "person1", p1: { fields: ["A"], encode: "text" }, p2: { fields: ["B"], encode: "text" } },
      { path: "county", stepId: "person1", p1: { fields: ["C"], encode: "text" } },
      { path: "email", stepId: "person2", p2: { fields: ["D"], encode: "text" } },
    ])
    expect(entries.map((e) => [e.fields[0], e.source])).toEqual([
      ["A", { kind: "answer", stepId: "person1", path: "city", person: 0 }],
      ["B", { kind: "answer", stepId: "person1", path: "city", person: 1 }],
      ["C", { kind: "answer", stepId: "person1", path: "county", person: 0 }],
      ["D", { kind: "answer", stepId: "person2", path: "email", person: 1 }],
    ])
  })
})

describe("intake and Person 1 pages: rich household", () => {
  it("writes exactly the expected text and checkbox states", async () => {
    const { text, checks } = await fillRegion(completeRichHousehold())
    expect(text).toEqual({
      You: "Maria Q Testcase",
      Spouse: "Pedro Testcase",
      [NAME_1]: "Maria Q Testcase",
      [NAME_2]: "Maria Q Testcase",
      "2 Date of birth mmddyy": "06/15/1985",
      [STREET]: "1 Example St",
      "5 City": "Testville",
      "6 State": "MA",
      "7 ZIP code": "02101",
      "16 Mobile phone number": "(617) 555-0100",
      "19. # of people listed on the application": "2",
      [RACE]: "White",
      [ETHNICITY]: "Brazilian",
      ...ssnBoxes("123456789"),
      [SSN_CARD_NAME]: "Maria Quinn Testcase",
      [SPOUSE]: "Pedro Testcase, 02/02/1983",
      [DEPENDENTS]: "Lucas Testcase 09/09/2015",
    })
    expect(checks).toEqual({
      "MassHealth or the Health Safety Net HSN": "On",
      [SEX]: "2", // Female is the second widget
      [APPLYING]: "1", // Yes is the first widget of this reversed group
      [INSTITUTION]: "2", // No
      "Check if same as street address": "On", // the blank person defaults to a mailing address that matches
      "Female ": "On",
      "Straight or Heterosexual ": "On",
      [HISPANIC]: "1",
      [HAS_SSN]: "1",
      [SSN_CARD_MATCH]: "2",
      [AGREES]: "1",
      [MARRIED]: "1",
      [JOINT]: "1",
      [CLAIMS]: "1",
      [CLAIMED]: "2",
    })
  })

  it("writes every address, contact, language and optional-demographic field when answered", async () => {
    const a = completeRichHousehold()
    const p = a.persons[0]
    Object.assign(p, {
      suffix: "Jr",
      apartment: "Apt 2",
      county: "Suffolk",
      inInstitution: "yes",
      facilityName: "Example Rehab Center",
      mailingSameAsStreet: false,
      mailingAddress: "PO Box 7",
      mailingApartment: "Box A",
      mailingCity: "Mailtown",
      mailingState: "ri",
      mailingZip: "02840",
      otherPhone: "617-555-0199",
      email: "maria@example.test",
      preferredLanguageSpoken: "Portuguese",
      preferredLanguageWritten: "Spanish",
    })
    p.demographics.genderIdentity = { ...p.demographics.genderIdentity, female: false, transWoman: true, notListed: true }
    p.demographics.genderIdentityOther = "Two-spirit"
    p.demographics.sexualOrientation = { ...p.demographics.sexualOrientation, straight: false, bisexual: true, notListed: true, dontKnow: true }
    p.demographics.sexualOrientationOther = "Fluid"
    p.demographics.hispanicOrLatino = "declined"
    p.demographics.race = { ...p.demographics.race, asian: true, notListed: true }
    p.demographics.raceOther = "Cape Verdean mix"
    p.demographics.ethnicity = { ...p.demographics.ethnicity, portuguese: true, dontKnow: true }

    const { text, checks } = await fillRegion(a)
    expect(text).toMatchObject({
      [NAME_1]: "Maria Q Testcase Jr",
      "4 Apartment or unit number": "Apt 2",
      "8 County": "Suffolk",
      "9. If yes facility name": "Example Rehab Center",
      [MAILING]: "PO Box 7",
      "11 Apartment or unit number": "Box A",
      "12 City": "Mailtown",
      "13 State": "RI",
      "14 ZIP code": "02840",
      "17 Other phone number": "(617) 555-0199",
      "18 Email": "maria@example.test",
      "20 What is your preferred language if not English Spoken": "Portuguese",
      Written: "Spanish",
      "Please specify if gender identity is not listed here": "Two-spirit",
      "Please specify if Sexual Orientation is not listed": "Fluid",
      [RACE]: "Asian, White, Cape Verdean mix",
      [ETHNICITY]: "Brazilian, Portuguese, Don't know",
    })
    expect(checks).toMatchObject({
      [INSTITUTION]: "1",
      "Transgender womantrans woman": "On",
      "Gender identity is not listed here Please specify": "On",
      "Bisexual ": "On",
      "Sexual Orientation is not listed Please specify": "On",
      "Dont know _2": "On",
      [HISPANIC]: "4",
    })
    expect(checks).not.toHaveProperty("Female ")
    expect(checks).not.toHaveProperty("Straight or Heterosexual ")
    expect(checks).not.toHaveProperty("Check if same as street address")
  })

  it("covers the remaining enum states: Hispanic options, no-SSN reasons, Male and homelessness", { timeout: 30_000 }, async () => {
    const reasons = { illness: "1", justApplied: "2", noncitizenException: "3", religiousException: "4" } as const
    for (const [reason, state] of Object.entries(reasons)) {
      const a = completeRichHousehold()
      Object.assign(a.persons[0], { sexAtBirth: "male", hasSsn: "no", noSsnReason: reason })
      const { checks } = await fillRegion(a)
      expect(checks[NO_SSN_REASON]).toBe(state)
      expect(checks[SEX]).toBe("1")
      expect(checks[HAS_SSN]).toBe("2")
    }
    for (const [answer, state] of Object.entries({ yes: "1", no: "2", dontKnow: "3", declined: "4" })) {
      const a = completeRichHousehold()
      a.persons[0].demographics.hispanicOrLatino = answer as "yes"
      expect((await fillRegion(a)).checks[HISPANIC]).toBe(state)
    }
    const a = completeRichHousehold()
    Object.assign(a.persons[0], { noHomeAddress: true, mailingAddress: "PO Box 9", mailingCity: "Mailtown", mailingState: "MA", mailingZip: "02101" })
    const { text, checks } = await fillRegion(a)
    expect(checks["Check this box if homeless"]).toBe("On")
    expect(text[MAILING]).toBe("PO Box 9")
    expect(text).not.toHaveProperty([STREET])
    expect(text).not.toHaveProperty("5 City")
  })

  it("checks the same-as-street box and leaves the mailing lines blank", async () => {
    const a = completeRichHousehold()
    a.persons[0].mailingSameAsStreet = true
    const { text, checks } = await fillRegion(a)
    expect(checks["Check if same as street address"]).toBe("On")
    expect(text).not.toHaveProperty([MAILING])
  })

  it("writes the tax filer, the claimed-as-dependent answer and several dependents", async () => {
    const a = completeRichHousehold()
    a.persons[0].tax = {
      ...a.persons[0].tax,
      dependents: [
        { name: "Lucas Testcase", dateOfBirth: "2015-09-09" },
        { name: "Ana Testcase", dateOfBirth: "2018-12-01" },
      ],
      claimedAsDependent: "yes",
      taxFiler: { ...a.persons[0].tax.taxFiler, name: "Rosa Filer", dateOfBirth: "1960-01-01", relationship: "mother" },
    }
    const { text, checks } = await fillRegion(a)
    expect(text[DEPENDENTS]).toBe("Lucas Testcase 09/09/2015; Ana Testcase 12/01/2018")
    expect(text[FILER]).toBe("Rosa Filer")
    expect(checks[CLAIMED]).toBe("1")
  })

  it("answers Q11 No on the right widgets and drops the dependent and spouse lines", async () => {
    const a = completeRichHousehold()
    a.persons[0].tax = { ...a.persons[0].tax, plansJointReturn: "no", claimsDependents: "no" }
    const { text, checks } = await fillRegion(a)
    expect(checks[JOINT]).toBe("2")
    expect(checks[CLAIMS]).toBe("2")
    expect(text).not.toHaveProperty([DEPENDENTS])
    expect(text[SPOUSE]).toBe("Pedro Testcase, 02/02/1983")
  })
})

describe("intake and Person 1 pages: program boxes and name lines", () => {
  it("checks the Long-Term Care box and names only the applying person (facility couple)", async () => {
    const { text, checks } = await fillRegion(completeFacilityCouple())
    expect(checks["LongTerm Care andor"]).toBe("On")
    expect(checks).not.toHaveProperty("MassHealth or the Health Safety Net HSN")
    expect(text.You_3).toBe("Walter Testcase")
    // Dorothy is not applying for coverage, so there is no Spouse line
    expect(text).not.toHaveProperty("Spouse_3")
    expect(text).not.toHaveProperty("You")
    expect(text).not.toHaveProperty("You_2")
    expect(text["19. # of people listed on the application"]).toBe("2")
    expect(checks[INSTITUTION]).toBe("1")
    expect(text["9. If yes facility name"]).toBe("Example Nursing Home")
  })

  it("fills every program box, the SNAP opt-in and the name line under each program", async () => {
    const a = completeRichHousehold()
    a.intake.programs = { masshealthHsn: true, longTermCare: true, hcbsWaiver: true, healthConnector: true }
    a.intake.applyForSnap = true
    const { text, checks } = await fillRegion(a)
    for (const box of [
      "MassHealth or the Health Safety Net HSN",
      "Health Connector Programs",
      "LongTerm Care andor",
      "Home and CommunityBased Services Waiver",
      "Check this box if you want this application to be sent to the Department of Transitional Assistance to serve as an application for",
    ]) {
      expect(checks[box]).toBe("On")
    }
    for (const [line, who] of [
      ["You", "Maria Q Testcase"],
      ["Spouse", "Pedro Testcase"],
      ["You_2", "Maria Q Testcase"],
      ["Spouse_2", "Pedro Testcase"],
      ["You_3", "Maria Q Testcase"],
      ["Spouse_3", "Pedro Testcase"],
    ]) {
      expect(text[line]).toBe(who)
    }
  })

  it("lists HCBS Waiver applicants on the Long-Term Care lines even without the Long-Term Care box", async () => {
    const a = completeRichHousehold()
    a.intake.programs = { masshealthHsn: false, longTermCare: false, hcbsWaiver: true, healthConnector: false }
    const { text, checks } = await fillRegion(a)
    expect(checks["Home and CommunityBased Services Waiver"]).toBe("On")
    expect(checks).not.toHaveProperty("LongTerm Care andor")
    expect(text.You_3).toBe("Maria Q Testcase")
    expect(text).not.toHaveProperty("You")
  })

  it("leaves the Spouse line empty when Person 2 is not a spouse", async () => {
    const a = completeRichHousehold()
    a.persons[1].relationshipToPerson1 = "daughter"
    const { text } = await fillRegion(a)
    expect(text.You).toBe("Maria Q Testcase")
    expect(text).not.toHaveProperty("Spouse")
  })

  it("does not name Person 1 when Person 1 is not applying", async () => {
    const a = completeRichHousehold()
    a.persons[0].applyingForCoverage = "no"
    const { text } = await fillRegion(a)
    expect(text).not.toHaveProperty("You")
    expect(text.Spouse).toBe("Pedro Testcase")
    expect(text[NAME_1]).toBe("Maria Q Testcase")
  })
})

describe("stale answers never reach the intake and Person 1 pages", () => {
  it("applyingForCoverage 'no' leaves the SSN, tax and demographic answers off the form", async () => {
    const a = completeRichHousehold()
    const p = a.persons[0]
    p.applyingForCoverage = "no"
    p.hasSsn = "yes"
    p.ssn = "999-88-7777"
    p.nameMatchesSsnCard = "no"
    p.ssnCardName = SENTINEL
    p.tax = { ...p.tax, spouseName: SENTINEL, claimsDependents: "yes", dependents: [{ name: SENTINEL, dateOfBirth: "2015-09-09" }] }
    p.demographics.race.white = true
    p.demographics.raceOther = SENTINEL
    const values = await fillRegion(a)
    for (const box of SSN_BOXES) expect(values.text).not.toHaveProperty(box)
    for (const field of [SSN_CARD_NAME, SPOUSE, DEPENDENTS, RACE, ETHNICITY]) expect(values.text).not.toHaveProperty(field)
    for (const field of [HAS_SSN, SSN_CARD_MATCH, AGREES, MARRIED, CLAIMS, "Female ", HISPANIC]) {
      expect(values.checks).not.toHaveProperty(field)
    }
    expectNoSentinel(values)
    // answers that are still visible are still written
    expect(values.text[NAME_1]).toBe("Maria Q Testcase")
    expect(values.checks[APPLYING]).toBe("2")
  })

  it("isLegallyMarried 'no' leaves the spouse line and the joint-return answer empty", async () => {
    const a = completeRichHousehold()
    a.persons[0].isLegallyMarried = "no"
    a.persons[0].tax = { ...a.persons[0].tax, spouseName: SENTINEL, plansJointReturn: "yes" }
    const values = await fillRegion(a)
    expect(values.text).not.toHaveProperty([SPOUSE])
    expect(values.checks).not.toHaveProperty([JOINT])
    expect(values.checks[MARRIED]).toBe("2")
    expectNoSentinel(values)
  })

  it("Q11 'no' skips Q11a: the married answer stays off the form, even though it is still answered", async () => {
    const a = completeRichHousehold()
    expect(a.persons[0].isLegallyMarried).toBe("yes")
    a.persons[0].tax = { ...a.persons[0].tax, agreesToFileIfAptc: "no", spouseName: SENTINEL }
    const values = await fillRegion(a)
    expect(values.checks[AGREES]).toBe("2")
    expect(values.checks).not.toHaveProperty([MARRIED])
    expect(values.checks).not.toHaveProperty([JOINT])
    expectNoSentinel(values)

    a.persons[0].tax = { ...a.persons[0].tax, agreesToFileIfAptc: "yes" }
    expect((await fillRegion(a)).checks[MARRIED]).toBe("1")
  })

  it("hasSsn 'no' leaves the SSN boxes and the card-name answers empty", async () => {
    const a = completeRichHousehold()
    a.persons[0].hasSsn = "no"
    a.persons[0].noSsnReason = "religiousException"
    a.persons[0].ssn = "999-88-7777"
    a.persons[0].nameMatchesSsnCard = "no"
    a.persons[0].ssnCardName = SENTINEL
    const values = await fillRegion(a)
    for (const box of SSN_BOXES) expect(values.text).not.toHaveProperty(box)
    expect(values.text).not.toHaveProperty([SSN_CARD_NAME])
    expect(values.checks).not.toHaveProperty([SSN_CARD_MATCH])
    expect(values.checks[HAS_SSN]).toBe("2")
    expect(values.checks[NO_SSN_REASON]).toBe("4")
    expectNoSentinel(values)
  })

  it("hasSsn 'yes' leaves a stale no-SSN reason off the form", async () => {
    const a = completeRichHousehold()
    a.persons[0].noSsnReason = "illness"
    expect((await fillRegion(a)).checks).not.toHaveProperty([NO_SSN_REASON])
  })

  it("closed address, institution, tax and dependent gates leave stale text off the form", async () => {
    const a = completeRichHousehold()
    const p = a.persons[0]
    Object.assign(p, {
      noHomeAddress: true,
      streetAddress: SENTINEL,
      city: SENTINEL,
      mailingAddress: "PO Box 9",
      mailingCity: "Mailtown",
      mailingState: "MA",
      mailingZip: "02101",
      inInstitution: "no",
      facilityName: SENTINEL,
    })
    p.tax = {
      ...p.tax,
      claimedAsDependent: "no",
      taxFiler: { ...p.tax.taxFiler, name: SENTINEL },
      agreesToFileIfAptc: "no",
      spouseName: SENTINEL,
      dependents: [{ name: SENTINEL, dateOfBirth: "2015-09-09" }],
    }
    const values = await fillRegion(a)
    expectNoSentinel(values)
    for (const field of [STREET, "5 City", "9. If yes facility name", SPOUSE, DEPENDENTS, FILER, JOINT, CLAIMS]) {
      expect(values.text).not.toHaveProperty([field])
      expect(values.checks).not.toHaveProperty([field])
    }
    expect(values.checks[AGREES]).toBe("2")
  })

  it("a program box that is unchecked leaves its name lines empty, even with applicants", async () => {
    const a = completeRichHousehold()
    a.intake.programs = { masshealthHsn: false, longTermCare: false, hcbsWaiver: false, healthConnector: true }
    const { text } = await fillRegion(a)
    expect(text.You_2).toBe("Maria Q Testcase")
    for (const line of ["You", "Spouse", "You_3", "Spouse_3"]) expect(text).not.toHaveProperty(line)
  })
})
