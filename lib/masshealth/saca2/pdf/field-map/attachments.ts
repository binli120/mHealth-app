/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { IRS_YEAR_SLOTS, type ArdSection } from "../derived-attachments"
import type { Encoder, FieldEntry } from "../types"

const derived = (fields: string[], id: string, encode: Encoder = "text"): FieldEntry => ({
  fields,
  source: { kind: "derived", id },
  encode,
})

// ---------------------------------------------------------------------------------------------
// ARD-1122: one page per section (PDF indexes 35, 36, 37); only the chosen section's page is filled
// ---------------------------------------------------------------------------------------------

/** The applicant block and representative contact block of each section's page, by the template's own names. */
const ARD_PAGES: Record<
  ArdSection,
  { name: string; dob: string; ssn: string[]; repName: string; repPhone: string; repAddress: string }
> = {
  1: {
    name: "Applicants Members Name_ARD_S1",
    dob: "Date of birth mmddyyyy_ARD_S1",
    ssn: [6, 7, 8, 9].map((n) => `SSN if you have one_ARD_${n}`),
    repName: "Authorized representatives name_ARD",
    repPhone: "Authorized representatives phone number_ARD",
    repAddress: "Authorized representatives address mailing address city state zip_ARD",
  },
  2: {
    name: "Applicants Members Name_ARD_S2",
    dob: "ApplicantsMembers date of birth_ARD_S2",
    ssn: [6, 7, 8, 9].map((n) => `SSN if you have one_ARD_${n}_S2`),
    repName: "Authorized representatives name first middle last_ARD_S2",
    repPhone: "Authorized representatives phone number_ARD_S2",
    repAddress: "Authorized representatives address mailing address city state zip_ARD_S2",
  },
  3: {
    name: "Applicants Members Name_ARD_S3",
    dob: "ApplicantsMembers date of birth mmddyyyy_ARD_S3",
    ssn: [6, 7, 8, 9].map((n) => `SSN if you have one_ARD_${n}_S3`),
    repName: "Authorized representatives name first middle lastApplicants Members Name_ARD_S3",
    repPhone: "Authorized representatives phone number_ARD_S3",
    repAddress: "Authorized representatives address mailing address city state zip_ARD_S3",
  },
}

const ardPage = (section: ArdSection): FieldEntry[] => {
  const page = ARD_PAGES[section]
  const id = (rest: string) => `ard.${section}.${rest}`
  return [
    derived([page.name], id("applicant.name")),
    derived([page.dob], id("applicant.dateOfBirth"), "date"),
    // four single-digit boxes
    derived(page.ssn, id("applicant.ssnLast4"), { kind: "digits", width: 4 }),
    derived([page.repName], id("rep.name")),
    derived([page.repPhone], id("rep.phone"), "phone"),
    derived([page.repAddress], id("rep.address")),
  ]
}

export const ARD_ENTRIES: FieldEntry[] = [
  ...([1, 2, 3] as const).flatMap(ardPage),

  // Section I, Part A: the applicant's email
  derived(["Applicants Members email address_ARD"], "ard.1.applicant.email"),
  // Section I, B1 (the representative is a person)
  derived(["Authorized representatives printed name_ARD"], "ard.1.person.name"),
  derived(["Authorized representatives email address_ARD"], "ard.1.person.email"),
  // Section I, B2 (the representative is an organization)
  derived(["Printed name of provider staff member or volunteer completing form_ARD"], "ard.1.org.staffName"),
  derived(["Email of provider staff member or volunteer completing form_ARD"], "ard.1.org.staffEmail"),
  derived(["Authorized representative organization name_ARD"], "ard.1.org.name"),

  // Sections II and III: the representative's email
  derived(["Authorized representatives email address_ARD-S2"], "ard.2.rep.email"),
  derived(["Authorized representatives email address_ARD_S3"], "ard.3.rep.email"),
  // Section II: the officer who signs for an organization (the signature and date are never-fill)
  derived(["Officers Name_ARD_S2"], "ard.2.officerName"),
  derived(["Officers Title_ARD_S2"], "ard.2.officerTitle"),
]

// ---------------------------------------------------------------------------------------------
// IRS Form 4506 (PDF index 38)
// ---------------------------------------------------------------------------------------------

/**
 * The template's names on lines 3-5 are shifted one line up against what they print under: the field named
 * "Previous address ... line 3" is the line 3 CURRENT address box, the one named "... mailed to a third
 * party ..." is the line 4 PREVIOUS address box, and the "Caution ... lines 5 through 7" field is the
 * line 5 third-party box. Positions were checked against the rendered page.
 */
const IRS_LINE_3 = "Previous address shown on the last return filed if different from line 3 see instructions"
const IRS_LINE_4 =
  "If the tax return is to be mailed to a third party such as a mortgage company enter the third partys name address and telephone number"
const IRS_LINE_6 = "type of return you must complete another Form 4506"

/** Line 7's date boxes, row by row, three boxes (month, day, year) per date. */
const IRS_DATE_BOXES: string[][] = [
  ["Year or period requested Enter the ending date of the tax year or period using the mmddyyyy format see instructions", "undefined_102", "undefined_103"],
  ["undefined_104", "undefined_105", "undefined_106"],
  ["undefined_107", "undefined_108", "undefined_109"],
  ["undefined_110", "undefined_111", "undefined_112"],
  ["undefined_113", "undefined_114", "undefined_115"],
  ["undefined_116", "undefined_117", "undefined_118"],
  ["undefined_119", "undefined_120", "undefined_121"],
  ["undefined_122", "undefined_123", "undefined_124"],
]

export const IRS_ENTRIES: FieldEntry[] = [
  derived(["1a  Name shown on tax return If a joint return enter the name shown first"], "irs4506.name1"),
  derived(
    ["1b  First social security number on tax return individual taxpayer identification number or employer identification number see instructions"],
    "irs4506.id1",
  ),
  derived(["2a  If a joint return enter spouses name shown on tax return"], "irs4506.name2"),
  derived(["2b  Second social security number or individual taxpayer identification number if joint tax return"], "irs4506.id2"),
  derived([IRS_LINE_3], "irs4506.address"),
  {
    fields: [IRS_LINE_4],
    source: { kind: "answer", stepId: "irs4506", path: "attachments.irs4506.previousAddress" },
    encode: "text",
  },
  {
    fields: [IRS_LINE_6],
    source: { kind: "answer", stepId: "irs4506", path: "attachments.irs4506.formNumber" },
    encode: "text",
  },
  ...IRS_DATE_BOXES.slice(0, IRS_YEAR_SLOTS).flatMap((boxes, slot) =>
    (["month", "day", "year"] as const).map((part, i) => derived([boxes[i]], `irs4506.year.${slot}.${part}`)),
  ),
]

export const ATTACHMENTS_ENTRIES: FieldEntry[] = [...ARD_ENTRIES, ...IRS_ENTRIES]
