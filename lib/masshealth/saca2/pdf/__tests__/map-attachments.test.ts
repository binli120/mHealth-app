/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it, vi } from "vitest"

import { completeHomeWithAllSupplements } from "../../__tests__/complete-answers"
import { getStepContent } from "../../questions"
import type { Saca2Answers } from "../../types"
import { IRS_YEAR_SLOTS } from "../derived-attachments"
import { FIELD_MAP } from "../field-map"
import { ATTACHMENTS_ENTRIES } from "../field-map/attachments"
import { getFieldInfo, getInventory } from "../inventory"
import { NEVER_FILL } from "../never-fill"
import { buildOverflowSheets } from "../overflow-plan"
import { PAGE_RANGES, pagesToKeep } from "../page-selection"
import { fillSaca2Pdf } from "../pdf-fill"
import { readFilled, type FilledValues } from "./helpers/read-filled"
import { coupleBoth } from "./supp-bcd-helpers"

// each test fills the 1.7 MB template; the suite runs many files in parallel
vi.setConfig({ testTimeout: 120_000 })

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"
const MAPPED = new Set(ATTACHMENTS_ENTRIES.flatMap((e) => e.fields))
const ATTACH_PAGES = [...PAGE_RANGES.ard, ...PAGE_RANGES.irs4506]
/** Every inventory name with a widget on an ARD / IRS page. */
const ATTACH_NAMES = getInventory()
  .filter((f) => f.pages.some((p) => ATTACH_PAGES.includes(p)))
  .map((f) => f.name)

async function fillRegion(answers: Saca2Answers): Promise<FilledValues> {
  const { text, checks } = await readFilled(await fillSaca2Pdf(answers, null, ON))
  return {
    text: Object.fromEntries(Object.entries(text).filter(([name]) => MAPPED.has(name))),
    checks: Object.fromEntries(Object.entries(checks).filter(([name, state]) => MAPPED.has(name) && state !== null)),
  }
}

// --- template field names -----------------------------------------------------------------------

const ssnBoxes = (suffix: string) => [6, 7, 8, 9].map((n) => `SSN if you have one_ARD_${n}${suffix}`)
const last4 = (suffix: string, digits: string) => Object.fromEntries(ssnBoxes(suffix).map((name, i) => [name, digits[i]]))

const S1 = {
  name: "Applicants Members Name_ARD_S1",
  dob: "Date of birth mmddyyyy_ARD_S1",
  email: "Applicants Members email address_ARD",
  repName: "Authorized representatives name_ARD",
  repPhone: "Authorized representatives phone number_ARD",
  repAddress: "Authorized representatives address mailing address city state zip_ARD",
  b1Name: "Authorized representatives printed name_ARD",
  b1Email: "Authorized representatives email address_ARD",
  staffName: "Printed name of provider staff member or volunteer completing form_ARD",
  staffEmail: "Email of provider staff member or volunteer completing form_ARD",
  org: "Authorized representative organization name_ARD",
}
const S2 = {
  name: "Applicants Members Name_ARD_S2",
  dob: "ApplicantsMembers date of birth_ARD_S2",
  repName: "Authorized representatives name first middle last_ARD_S2",
  repPhone: "Authorized representatives phone number_ARD_S2",
  repAddress: "Authorized representatives address mailing address city state zip_ARD_S2",
  repEmail: "Authorized representatives email address_ARD-S2",
  officerName: "Officers Name_ARD_S2",
  officerTitle: "Officers Title_ARD_S2",
}
const S3 = {
  name: "Applicants Members Name_ARD_S3",
  dob: "ApplicantsMembers date of birth mmddyyyy_ARD_S3",
  repName: "Authorized representatives name first middle lastApplicants Members Name_ARD_S3",
  repPhone: "Authorized representatives phone number_ARD_S3",
  repAddress: "Authorized representatives address mailing address city state zip_ARD_S3",
  repEmail: "Authorized representatives email address_ARD_S3",
}
const IRS = {
  name1: "1a  Name shown on tax return If a joint return enter the name shown first",
  id1: "1b  First social security number on tax return individual taxpayer identification number or employer identification number see instructions",
  name2: "2a  If a joint return enter spouses name shown on tax return",
  id2: "2b  Second social security number or individual taxpayer identification number if joint tax return",
  line3: "Previous address shown on the last return filed if different from line 3 see instructions",
  line4: "If the tax return is to be mailed to a third party such as a mortgage company enter the third partys name address and telephone number",
  line5: "Caution If the tax return is being sent to the third party ensure that lines 5 through 7 are completed before signing see instructions",
  form: "type of return you must complete another Form 4506",
}
/** Line 7's date boxes, [month, day, year] per date, row by row. */
const YEAR_BOXES = [
  ["Year or period requested Enter the ending date of the tax year or period using the mmddyyyy format see instructions", "undefined_102", "undefined_103"],
  ["undefined_104", "undefined_105", "undefined_106"],
  ["undefined_107", "undefined_108", "undefined_109"],
  ["undefined_110", "undefined_111", "undefined_112"],
  ["undefined_113", "undefined_114", "undefined_115"],
  ["undefined_116", "undefined_117", "undefined_118"],
  ["undefined_119", "undefined_120", "undefined_121"],
  ["undefined_122", "undefined_123", "undefined_124"],
]
const yearText = (slot: number, mm: string, dd: string, yyyy: string) => ({
  [YEAR_BOXES[slot][0]]: mm,
  [YEAR_BOXES[slot][1]]: dd,
  [YEAR_BOXES[slot][2]]: yyyy,
})

/** Signature-like names on pages 35-38 (verified by position and label), each one never-filled. */
const SIGNATURE_NAMES = [
  "ApplicantsMembers signature",
  "Date_ARD",
  "Authorized representatives signature_ARD",
  "Date_ARD_2",
  "Signature of provider staff member or volunteer completing form_ARD",
  "Date_ARD_3",
  "Authorized representatives signature_ARD_S2",
  "Date_ARD_S2",
  "Officers Signature_ARD_S2",
  "Date_ARD_S2_2",
  "Authorized representatives signatureApplicants Members Name_ARD_S3",
  "Date_ARD_S3",
  "execute Form 4506 on behalf of the taxpayer Note This form must be received by IRS within 120 days of the signature date",
  "declares that heshe has the authority to sign the Form 4506 See instructions",
  "Phone number of taxpayer on line 1a or 2a",
  "Print/Type name",
  "PrintType name",
]

// --- fixtures -----------------------------------------------------------------------------------

function ard(over: Partial<Saca2Answers["attachments"]["ard"]>): Saca2Answers {
  const a = completeHomeWithAllSupplements()
  a.attachments.ard = { ...a.attachments.ard, ...over }
  return a
}

const orgDesignation = () =>
  ard({
    repKind: "organization",
    repName: "Pat Helper",
    orgName: "Example Helpers Inc",
    staffName: "Sam Staff",
    staffEmail: "sam@example.test",
    repEmail: "pat@example.test",
  })

const cannotDesignate = () =>
  ard({
    section: "cannotDesignate",
    repKind: null,
    repName: "Rae Rep",
    repEmail: "rae@example.test",
    orgName: "Care Partners Inc",
    officerName: "Olive Officer",
    officerTitle: "Director",
  })

const appointedByLaw = () =>
  ard({ section: "appointedByLaw", repKind: null, repName: "Gus Guardian", repEmail: "gus@example.test", legalDocument: "Guardianship order 2025-123" })

/** A married couple filing jointly: both applying with SSNs, four years requested. */
function jointCouple(): Saca2Answers {
  const a = coupleBoth()
  a.signature.signedBy = "authorizedRepresentative"
  a.attachments.ard = { ...a.attachments.ard, section: "applicantDesignates", repKind: "person", repName: "Quinn Rep", repPhone: "6175550101", repStreet: "3 Example St", repCity: "Testville", repState: "MA", repZip: "02101" }
  a.supplements.a.taxReturnsFiled = "bothYears"
  a.supplements.a.hasCopiesOfTaxReturns = "no"
  a.persons[0].hasSsn = "yes"
  a.persons[0].ssn = "123-45-6789"
  a.persons[1].lastName = "Testcase"
  a.persons[1].applyingForCoverage = "yes"
  a.persons[1].hasSsn = "yes"
  a.persons[1].ssn = "987-65-4321"
  a.attachments.irs4506.jointReturn = "yes"
  a.attachments.irs4506.previousAddress = "77 Old Rd, Elsewhere, NH 03301"
  a.attachments.irs4506.yearsRequested = [
    { periodEnd: "2022-12-31" },
    { periodEnd: "2023-12-31" },
    { periodEnd: "2024-12-31" },
    { periodEnd: "2025-12-31" },
  ]
  return a
}

describe("template facts the map relies on", () => {
  it("every ARD / IRS field is mapped or never-filled (none left unmapped), the only multi-widget names are the buttons", () => {
    for (const name of ATTACH_NAMES) {
      expect(MAPPED.has(name) || name in NEVER_FILL, name).toBe(true)
      expect(MAPPED.has(name) && name in NEVER_FILL, name).toBe(false)
    }
    expect(ATTACH_NAMES.filter((n) => getFieldInfo(n)!.widgets.length > 1).sort()).toEqual(["Clear", "Print"])
    expect(ATTACH_NAMES).toHaveLength(128)
  })

  it("the ARD SSN boxes are four single-digit boxes in x order; MassHealth ID boxes (12 per page) are never-fill WIZARD GAPs", () => {
    for (const suffix of ["", "_S2", "_S3"]) {
      const boxes = ssnBoxes(suffix).map((n) => getFieldInfo(n)!)
      expect(boxes.every((b) => b.type === "text")).toBe(true)
      const xs = boxes.map((b) => b.widgets[0].rect[0])
      expect([...xs].sort((a, b) => a - b)).toEqual(xs)
      for (let n = 1; n <= 12; n += 1) {
        expect(NEVER_FILL[`ID_ARD_${n}${suffix}`]?.reason, `ID box ${n}${suffix}`).toBe("other")
        expect(NEVER_FILL[`ID_ARD_${n}${suffix}`].note).toMatch(/WIZARD GAP/)
      }
    }
  })

  it("IRS lines 3, 4, 5 sit top to bottom under their labels (the template names are shifted a line up); line 7 boxes run row by row, left to right", () => {
    const top = (name: string) => getFieldInfo(name)!.widgets[0].rect[3]
    expect(top(IRS.name1)).toBeGreaterThan(top(IRS.name2))
    expect(top(IRS.name2)).toBeGreaterThan(top(IRS.line3))
    expect(top(IRS.line3)).toBeGreaterThan(top(IRS.line4))
    expect(top(IRS.line4)).toBeGreaterThan(top(IRS.line5))
    expect(top(IRS.line5)).toBeGreaterThan(top(IRS.form))
    const rect = (name: string) => getFieldInfo(name)!.widgets[0].rect
    YEAR_BOXES.forEach((boxes, slot) => {
      const [m, d, y] = boxes.map(rect)
      expect(m[0] < d[0] && d[0] < y[0], `slot ${slot} month, day, year left to right`).toBe(true)
      expect(m[3]).toBe(d[3])
      if (slot % 4 > 0) expect(rect(YEAR_BOXES[slot - 1][2])[0]).toBeLessThan(m[0])
      if (slot >= 4) expect(m[3]).toBeLessThan(rect(YEAR_BOXES[slot - 4][0])[3])
    })
  })

  it("capacities: the wizard's four years fit the form's eight date boxes; the ARD page entries sit on pages 35-37", () => {
    const repeater = getStepContent("irs4506")!.sections[0].questions.find((q) => q.repeater)!.repeater!
    expect(repeater.maxItems).toBeLessThanOrEqual(IRS_YEAR_SLOTS)
    expect(IRS_YEAR_SLOTS).toBe(YEAR_BOXES.length)
    for (const entry of ATTACHMENTS_ENTRIES) {
      for (const name of entry.fields) expect(getFieldInfo(name)!.pages.every((p) => [35, 36, 37, 38].includes(p)), name).toBe(true)
    }
  })

  it("every signature-like field has a specific never-fill reason and note, and none is mapped", () => {
    for (const name of SIGNATURE_NAMES) {
      const entry = NEVER_FILL[name]
      expect(entry, name).toBeDefined()
      expect(["signature", "signature-date", "consent"]).toContain(entry.reason)
      expect(entry.note ?? "", name).toMatch(/ARD-1122|IRS 4506/)
      expect(MAPPED.has(name), name).toBe(false)
    }
    const dates = SIGNATURE_NAMES.filter((n) => /^Date_|declares/.test(n))
    for (const n of dates) expect(NEVER_FILL[n].reason).toBe("signature-date")
    expect(NEVER_FILL["execute Form 4506 on behalf of the taxpayer Note This form must be received by IRS within 120 days of the signature date"].reason).toBe("consent")
    // the garbled-label widgets really sit where the notes say (Section III signature row above the representative's name row)
    const y = (n: string) => getFieldInfo(n)!.widgets[0].rect[1]
    expect(y("Authorized representatives signatureApplicants Members Name_ARD_S3")).toBeGreaterThan(y(S3.repName))
    expect(y("declares that heshe has the authority to sign the Form 4506 See instructions")).toBe(y("Phone number of taxpayer on line 1a or 2a"))
  })
})

describe("base fixture (Section I, a person, IRS 4506 one year)", () => {
  it("reads back exactly and the signature, date and officer-signature fields stay empty", async () => {
    const a = completeHomeWithAllSupplements()
    a.persons[0].email = "edna@example.test"
    const out = await fillRegion(a)
    expect(out.text).toEqual({
      [S1.name]: "Edna Testcase",
      [S1.dob]: "04/02/1950",
      ...last4("", "6789"),
      [S1.email]: "edna@example.test",
      [S1.repName]: "Quinn Rep",
      [S1.repPhone]: "(617) 555-0101",
      [S1.repAddress]: "3 Example St, Testville, MA 02101",
      [S1.b1Name]: "Quinn Rep",
      [IRS.name1]: "Edna Testcase",
      [IRS.id1]: "123-45-6789",
      [IRS.line3]: "1 Example St, Testville, MA 02101",
      [IRS.form]: "1040",
      ...yearText(0, "12", "31", "2025"),
    })
    expect(out.checks).toEqual({})
    const all = await readFilled(await fillSaca2Pdf(a, null, ON))
    for (const name of [...SIGNATURE_NAMES, ...ATTACH_NAMES.filter((n) => /^ID_ARD_/.test(n))]) {
      expect(all.text[name], name).toBeUndefined()
      expect(all.checks[name] ?? null, name).toBeNull()
    }
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Authorized"))).toEqual([])
  })
})

describe("ARD sections", () => {
  it("Section I with an organization: B2 staff and organization, no B1; the representative's email goes on the sheet", async () => {
    const a = orgDesignation()
    const out = await fillRegion(a)
    expect(Object.fromEntries(Object.entries(out.text).filter(([n]) => /ARD/.test(n)))).toEqual({
      [S1.name]: "Edna Testcase",
      [S1.dob]: "04/02/1950",
      ...last4("", "6789"),
      [S1.repName]: "Pat Helper",
      [S1.repPhone]: "(617) 555-0101",
      [S1.repAddress]: "3 Example St, Testville, MA 02101",
      [S1.staffName]: "Sam Staff",
      [S1.staffEmail]: "sam@example.test",
      [S1.org]: "Example Helpers Inc",
    })
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Authorized"))).toEqual([
      {
        title: "Authorized representative: additional information",
        columns: ["Item", "Answer"],
        rows: [["Section 1: authorized representative's email address (Part A has no email line)", "pat@example.test"]],
      },
    ])
  })

  it("Section II fills only its own page: representative, email and the officer (no signature); the organization goes on the sheet", async () => {
    const a = cannotDesignate()
    const out = await fillRegion(a)
    expect(Object.fromEntries(Object.entries(out.text).filter(([n]) => /ARD/.test(n)))).toEqual({
      [S2.name]: "Edna Testcase",
      [S2.dob]: "04/02/1950",
      ...last4("_S2", "6789"),
      [S2.repName]: "Rae Rep",
      [S2.repPhone]: "(617) 555-0101",
      [S2.repAddress]: "3 Example St, Testville, MA 02101",
      [S2.repEmail]: "rae@example.test",
      [S2.officerName]: "Olive Officer",
      [S2.officerTitle]: "Director",
    })
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Authorized"))).toEqual([
      {
        title: "Authorized representative: additional information",
        columns: ["Item", "Answer"],
        rows: [["Section 2: organization the authorized representative is affiliated with (the form has no line for it)", "Care Partners Inc"]],
      },
    ])
  })

  it("Section II without an organization: no officer and no sheet", async () => {
    const a = cannotDesignate()
    a.attachments.ard.orgName = ""
    a.attachments.ard.officerName = SENTINEL
    a.attachments.ard.officerTitle = SENTINEL
    const out = await fillRegion(a)
    expect(out.text[S2.officerName]).toBeUndefined()
    expect(out.text[S2.officerTitle]).toBeUndefined()
    expect(Object.values(out.text)).not.toContain(SENTINEL)
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Authorized"))).toEqual([])
  })

  it("Section III fills only its own page; the legal document goes on the sheet", async () => {
    const a = appointedByLaw()
    const out = await fillRegion(a)
    expect(Object.fromEntries(Object.entries(out.text).filter(([n]) => /ARD/.test(n)))).toEqual({
      [S3.name]: "Edna Testcase",
      [S3.dob]: "04/02/1950",
      ...last4("_S3", "6789"),
      [S3.repName]: "Gus Guardian",
      [S3.repPhone]: "(617) 555-0101",
      [S3.repAddress]: "3 Example St, Testville, MA 02101",
      [S3.repEmail]: "gus@example.test",
    })
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Authorized"))).toEqual([
      {
        title: "Authorized representative: additional information",
        columns: ["Item", "Answer"],
        rows: [["Section 3: legal document that gives the authorized representative authority (send a copy with the form)", "Guardianship order 2025-123"]],
      },
    ])
  })

  it("the last four SSN digits need a nine-digit SSN: Person 1 without an SSN leaves the boxes empty", async () => {
    const a = completeHomeWithAllSupplements()
    a.persons[0].hasSsn = "no"
    a.persons[0].ssn = ""
    const out = await fillRegion(a)
    for (const name of ssnBoxes("")) expect(out.text[name], name).toBeUndefined()
    a.persons[0].hasSsn = "yes"
    a.persons[0].ssn = "12-345"
    expect((await fillRegion(a)).text[ssnBoxes("")[0]]).toBeUndefined()
  })
})

describe("IRS 4506", () => {
  it("a joint return of a married couple: spouse lines, previous address, four years in the first row", async () => {
    const out = await fillRegion(jointCouple())
    expect(Object.fromEntries(Object.entries(out.text).filter(([n]) => ATTACH_NAMES.includes(n) && getFieldInfo(n)!.pages.includes(38)))).toEqual({
      [IRS.name1]: "Walter Testcase",
      [IRS.id1]: "123-45-6789",
      [IRS.name2]: "Dorothy Testcase",
      [IRS.id2]: "987-65-4321",
      [IRS.line3]: "1 Example St, Testville, MA 02101",
      [IRS.line4]: "77 Old Rd, Elsewhere, NH 03301",
      [IRS.form]: "1040",
      ...yearText(0, "12", "31", "2022"),
      ...yearText(1, "12", "31", "2023"),
      ...yearText(2, "12", "31", "2024"),
      ...yearText(3, "12", "31", "2025"),
    })
    expect(out.checks).toEqual({})
  })

  it("Person 1 without an SSN: line 1b shows the ITIN; a joint 'yes' without a spouse leaves 2a/2b empty", async () => {
    const a = jointCouple()
    a.persons[0].hasSsn = "no"
    a.persons[0].ssn = SENTINEL
    a.attachments.irs4506.taxpayerId = "912-70-1234"
    let out = await fillRegion(a)
    expect(out.text[IRS.id1]).toBe("912-70-1234")
    expect(out.text[IRS.name2]).toBe("Dorothy Testcase")
    a.persons[0].isLegallyMarried = "no"
    out = await fillRegion(a)
    expect(out.text[IRS.id1]).toBe("912-70-1234")
    expect(out.text[IRS.name2]).toBeUndefined()
    expect(out.text[IRS.id2]).toBeUndefined()
    expect(Object.values(out.text)).not.toContain(SENTINEL)
  })

  it("a stale ITIN is ignored when Person 1 has an SSN; joint 'no' leaves the spouse lines empty", async () => {
    const a = jointCouple()
    a.attachments.irs4506.taxpayerId = SENTINEL
    a.attachments.irs4506.jointReturn = "no"
    const out = await fillRegion(a)
    expect(out.text[IRS.id1]).toBe("123-45-6789")
    expect(out.text[IRS.name2]).toBeUndefined()
    expect(out.text[IRS.id2]).toBeUndefined()
    expect(Object.values(out.text)).not.toContain(SENTINEL)
  })

  it("an invalid or missing year leaves its boxes empty; line 5, fee, signature block stay empty", async () => {
    const a = jointCouple()
    a.attachments.irs4506.yearsRequested = [{ periodEnd: null }, { periodEnd: "2023-02-30" }, { periodEnd: "2024-12-31" }]
    const out = await readFilled(await fillSaca2Pdf(a, null, ON))
    expect(Object.keys(out.text).filter((n) => YEAR_BOXES.flat().includes(n)).sort()).toEqual(YEAR_BOXES[2].slice().sort())
    for (const name of ATTACH_NAMES.filter((n) => getFieldInfo(n)!.pages.includes(38) && !MAPPED.has(n))) {
      expect(out.text[name], name).toBeUndefined()
      expect(out.checks[name] ?? null, name).toBeNull()
    }
  })

  it("more years than the form's eight date lines throws without data", () => {
    const a = jointCouple()
    a.attachments.irs4506.yearsRequested = Array.from({ length: 9 }, (_, i) => ({ periodEnd: `20${10 + i}-12-31` }))
    expect(() => buildOverflowSheets(a, ON)).toThrow(/more years than the 8/)
  })
})

describe("stale answers", () => {
  it("signedBy changed away from the authorized representative: no ARD pages, no ARD values anywhere, no throw", async () => {
    const a = orgDesignation()
    Object.assign(a.attachments.ard, {
      repName: "STALE-NAME",
      repPhone: "6175550177",
      repStreet: "STALE-STREET",
      repCity: "STALE-CITY",
      repZip: "99999",
      repEmail: "stale@example.test",
      orgName: "STALE-ORG",
      staffName: "STALE-STAFF",
      staffEmail: "stale-staff@example.test",
      officerName: "STALE-OFFICER",
      officerTitle: "STALE-TITLE",
      legalDocument: "STALE-DOC",
    })
    a.signature.signedBy = "applicant"
    expect(pagesToKeep(a, ON).filter((p) => PAGE_RANGES.ard.includes(p))).toEqual([])
    const out = await readFilled(await fillSaca2Pdf(a, null, ON))
    for (const name of ATTACH_NAMES.filter((n) => getFieldInfo(n)!.pages.some((p) => PAGE_RANGES.ard.includes(p)))) {
      expect(out.text[name], name).toBeUndefined()
    }
    const values = Object.values(out.text).join("\n")
    for (const stale of ["STALE", "(617) 555-0177", "stale@example.test", "99999"]) expect(values).not.toContain(stale)
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Authorized"))).toEqual([])
    // the IRS 4506 pages (a different step) are still there
    expect(out.text[IRS.name1]).toBe("Edna Testcase")
  })

  it("taxReturnsFiled bothYears with copies yes: no IRS 4506 pages and no values", async () => {
    const a = jointCouple()
    a.supplements.a.hasCopiesOfTaxReturns = "yes"
    expect(pagesToKeep(a, ON).filter((p) => PAGE_RANGES.irs4506.includes(p))).toEqual([])
    const out = await readFilled(await fillSaca2Pdf(a, null, ON))
    for (const name of ATTACH_NAMES.filter((n) => getFieldInfo(n)!.pages.includes(38))) expect(out.text[name], name).toBeUndefined()
    expect(Object.values(out.text)).not.toContain("77 Old Rd, Elsewhere, NH 03301")
  })

  it("IRS 4506 hidden by no tax returns filed, with stale data: absent", async () => {
    const a = jointCouple()
    a.supplements.a.taxReturnsFiled = "none" as never
    expect(pagesToKeep(a, ON).filter((p) => PAGE_RANGES.irs4506.includes(p))).toEqual([])
    const out = await readFilled(await fillSaca2Pdf(a, null, ON))
    for (const name of ATTACH_NAMES.filter((n) => getFieldInfo(n)!.pages.includes(38))) expect(out.text[name], name).toBeUndefined()
  })

  it("the ARD section switched from applicantDesignates to cannotDesignate: only Section II's fields, stale org fields never appear", async () => {
    const a = orgDesignation()
    a.attachments.ard.section = "cannotDesignate"
    a.attachments.ard.repKind = "organization" // stale
    a.attachments.ard.staffName = SENTINEL
    a.attachments.ard.staffEmail = SENTINEL
    a.attachments.ard.legalDocument = SENTINEL
    a.attachments.ard.orgName = "" // Section II then names no organization
    const out = await fillRegion(a)
    expect(Object.fromEntries(Object.entries(out.text).filter(([n]) => /ARD/.test(n)))).toEqual({
      [S2.name]: "Edna Testcase",
      [S2.dob]: "04/02/1950",
      ...last4("_S2", "6789"),
      [S2.repName]: "Pat Helper",
      [S2.repPhone]: "(617) 555-0101",
      [S2.repAddress]: "3 Example St, Testville, MA 02101",
      [S2.repEmail]: "pat@example.test",
    })
    expect(Object.values(out.text)).not.toContain(SENTINEL)
    expect(buildOverflowSheets(a, ON).filter((s) => s.title.startsWith("Authorized"))).toEqual([])
  })

  it("the ARD section switched to Section III: Section I and II pages stay empty with stale officer and org data", async () => {
    const a = appointedByLaw()
    Object.assign(a.attachments.ard, { orgName: SENTINEL, officerName: SENTINEL, officerTitle: SENTINEL, staffName: SENTINEL, repKind: "organization" })
    const out = await fillRegion(a)
    expect(Object.keys(out.text).filter((n) => /ARD/.test(n)).every((n) => /_S3$/.test(n))).toBe(true)
    expect(Object.values(out.text)).not.toContain(SENTINEL)
  })
})

describe("never-fill sweep", () => {
  it("never writes any signature-like field on pages 34-39, in any variant", async () => {
    for (const a of [completeHomeWithAllSupplements(), orgDesignation(), cannotDesignate(), appointedByLaw(), jointCouple()]) {
      const out = await readFilled(await fillSaca2Pdf(a, null, ON))
      for (const name of [...SIGNATURE_NAMES, ...Object.keys(NEVER_FILL).filter((n) => ATTACH_NAMES.includes(n))]) {
        expect(out.text[name], name).toBeUndefined()
        expect(out.checks[name] ?? null, name).toBeNull()
      }
    }
    for (const name of SIGNATURE_NAMES) expect(FIELD_MAP.flatMap((e) => e.fields)).not.toContain(name)
  })
})
