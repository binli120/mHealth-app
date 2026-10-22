/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFDocument, PDFRef } from "pdf-lib"
import { describe, expect, it, vi } from "vitest"

import { completeHomeWithAllSupplements } from "../../__tests__/complete-answers"
import { getStepContent } from "../../questions"
import type { Saca2Answers } from "../../types"
import { SUPP_B_CAPACITY, SUPP_C_PAGES, SUPP_D_PAGES, federalTaxIdDigits } from "../derived-supp-bcd"
import { FIELD_MAP, FILL_MAP } from "../field-map"
import { SUPP_BCD_COPY_ENTRIES, SUPP_BCD_ENTRIES } from "../field-map/supp-bcd"
import { getFieldInfo, getInventory } from "../inventory"
import { NEVER_FILL } from "../never-fill"
import { buildOverflowSheets } from "../overflow-plan"
import { copyFieldName } from "../page-duplication"
import { PAGE_COPIES, pagesToKeep } from "../page-selection"
import { fillSaca2Pdf } from "../pdf-fill"
import { B, C, D, GRID, coupleBoth, job, member } from "./supp-bcd-helpers"
import { readFilled, type FilledValues } from "./helpers/read-filled"

// each test fills the 1.7 MB template; the suite runs many files in parallel
vi.setConfig({ testTimeout: 120_000 })

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"
const MAPPED = new Set([...SUPP_BCD_ENTRIES, ...SUPP_BCD_COPY_ENTRIES].flatMap((e) => e.fields))
const SIGNATURE_FIELDS = ["Print name_SuppC_3", "Date_SuppC_3"]
const extraPages = (a: Saca2Answers) => pagesToKeep(a, ON).filter((i) => i >= 42)

async function fillRegion(answers: Saca2Answers): Promise<FilledValues> {
  const { text, checks } = await readFilled(await fillSaca2Pdf(answers, null, ON))
  return {
    text: Object.fromEntries(Object.entries(text).filter(([name]) => MAPPED.has(name))),
    checks: Object.fromEntries(Object.entries(checks).filter(([name, state]) => MAPPED.has(name) && state !== null)),
  }
}

const stateOf = (checks: FilledValues["checks"], name: string) => checks[name] ?? null

describe("template facts the map relies on", () => {
  it("copy entries are the template entries renamed <field>__copyN; FIELD_MAP holds the template only", () => {
    const copies = new Map(getInventory().flatMap((f) => [1, 2, 3].map((n) => [copyFieldName(f.name, n), f.name] as const)))
    for (const entry of SUPP_BCD_COPY_ENTRIES) {
      for (const name of entry.fields) {
        expect(name, name).toMatch(/^[^.]+__copy[1-3]$/) // period-free partial name
        expect(getFieldInfo(copies.get(name) ?? ""), name).toBeDefined()
        expect(getFieldInfo(name), name).toBeUndefined()
      }
    }
    // renaming "." must not merge two template names
    const all = getInventory().flatMap((f) => [1, 2, 3].map((n) => copyFieldName(f.name, n)))
    expect(new Set(all).size).toBe(all.length)
    expect(FIELD_MAP.flatMap((e) => e.fields).some((n) => n.includes("__copy"))).toBe(false)
    expect(FILL_MAP.length).toBe(FIELD_MAP.length + SUPP_BCD_COPY_ENTRIES.length)
    const count = (entries: typeof FIELD_MAP, re: RegExp) => entries.flatMap((e) => e.fields).filter((n) => re.test(n)).length
    expect(count(SUPP_BCD_COPY_ENTRIES, /AI\/AN/)).toBe(2 * count(SUPP_BCD_ENTRIES, /AI\/AN/))
    expect(count(SUPP_BCD_COPY_ENTRIES, /_SuppC|SuppC_/)).toBe(count(SUPP_BCD_ENTRIES, /_SuppC|SuppC_/))
    expect(count(SUPP_BCD_COPY_ENTRIES, /SuppD|suppD/)).toBe(3 * count(SUPP_BCD_ENTRIES, /SuppD|suppD/))
  })

  it("Yes/No groups name Yes and No, gender M is left of F, grid rows run top to bottom", () => {
    for (const name of [B(0).federal, B(1).mass, B(0).ihs, B(1).eligible, D().eligible, D().minValue14, D().minValue15, ...C().yes]) {
      const states = [...getFieldInfo(name)!.widgets].sort((x, y) => x.rect[0] - y.rect[0]).map((w) => w.onState)
      expect(states, name).toEqual(["Yes", "No"])
    }
    const gender = [...getFieldInfo(C().gender)!.widgets].sort((x, y) => x.rect[0] - y.rect[0]).map((w) => w.onState)
    expect(gender).toEqual(["M", "F"])
    const ys = C().yes.map((n) => getFieldInfo(n)!.widgets[0].rect[1])
    expect([...ys].sort((x, y) => y - x)).toEqual(ys)
  })

  it("page capacities equal the wizard's limits; Supplement C signature block is never-fill", () => {
    const repeater = (step: "suppB" | "suppD") => getStepContent(step)!.sections[0].questions[0].repeater!
    expect(repeater("suppB").maxItems).toBe(SUPP_B_CAPACITY)
    expect(repeater("suppD").maxItems).toBe(SUPP_D_PAGES)
    expect(SUPP_C_PAGES).toBe(2)
    expect(PAGE_COPIES.map((p) => p.copies)).toEqual([2, 1, 3])
    expect(NEVER_FILL["Print name_SuppC_3"].reason).toBe("signature")
    expect(NEVER_FILL["Date_SuppC_3"].reason).toBe("signature-date")
    for (const n of SIGNATURE_FIELDS) expect(NEVER_FILL[n].note).toMatch(/Supplement C/)
  })
})

describe("base fixture (one member, one person, one job)", () => {
  it("reads back exactly and adds no copy page", async () => {
    const a = completeHomeWithAllSupplements()
    expect(extraPages(a)).toEqual([])
    const out = await fillRegion(a)
    const b = B(0)
    const c0 = C()
    const d = D()
    expect(out.text).toEqual({
      [b.name]: "Edna Testcase",
      [b.federalTribe]: "Example Tribe",
      [c0.last]: "Testcase",
      [c0.first]: "Edna",
      [c0.phone]: "(617) 555-0100",
      [c0.ssn]: "123-45-6789",
      [c0.dob]: "04/02/1950",
      [c0.street]: "1 Example St",
      [c0.city]: "Testville",
      [c0.state]: "MA",
      [c0.zip]: "02101",
      [c0.health[0]]: "Arthritis",
      [c0.times[2]]: "1",
      [c0.days[2]]: "7",
      [c0.cgName[0]]: "Test Child",
      [c0.cgRel[0]]: "daughter",
      [d.name]: "Edna Testcase",
      [d.employer]: "Acme",
      [d.address]: "9 Work Rd",
      [d.phone]: "(617) 555-0100",
      [d.city]: "Testville",
      [d.state]: "MA",
      [d.zip]: "02101",
      [d.contact]: "HR",
      [d.premium14]: "120",
      [d.often14]: "Monthly",
    })
    expect(out.checks).toEqual({
      [b.federal]: "Yes",
      [b.mass]: "No",
      [b.ihs]: "Yes",
      [c0.gender]: "F",
      ...Object.fromEntries(GRID.map((k, i) => [c0.yes[i], k === "bathing" ? "Yes" : "No"])),
      [d.eligible]: "Yes",
      [d.minValue14]: "Yes",
    })
  })

  it("puts the 14a plan name (the template has no field for it) on one continuation sheet", () => {
    const sheets = buildOverflowSheets(completeHomeWithAllSupplements(), ON).filter((s) => s.title.startsWith("Supplement D"))
    expect(sheets).toEqual([
      {
        title: "Supplement D: additional information",
        columns: ["Job (employee / employer)", "Item", "Answer"],
        rows: [["Job 1 - Edna Testcase / Acme", "14a. Name of the lowest-cost individual health plan offered to the employee", "Gold Individual"]],
      },
    ])
  })
})

describe("Supplement B with six members", () => {
  it("fills three pages (2 + 2 + 2) in order, each member exactly once", async () => {
    const a = completeHomeWithAllSupplements()
    a.supplements.b.members = [1, 2, 3, 4, 5, 6].map((n) => member(n, n === 4 ? { receivedIhsService: "yes", eligibleForIhs: null } : {}))
    expect(extraPages(a)).toEqual([42, 43])
    const out = await fillRegion(a)
    for (let page = 0; page < 3; page += 1) {
      for (const side of [0, 1] as const) {
        const n = page * 2 + side + 1
        const f = B(side, page)
        expect(out.text[f.name]).toBe(`Member ${n}`)
        expect(out.text[f.federalTribe]).toBe(`Tribe ${n}`)
        expect(out.text[f.massTribe]).toBe(`Mass Tribe ${n}`)
        expect(out.text[f.amount]).toBe(String(100 + n))
        expect(out.text[f.often]).toBe("Monthly")
        expect(stateOf(out.checks, f.federal)).toBe("Yes")
        expect(stateOf(out.checks, f.ihs)).toBe(n === 4 ? "Yes" : "No")
        expect(stateOf(out.checks, f.eligible)).toBe(n === 4 ? null : "Yes")
      }
    }
    const names = Object.entries(out.text).filter(([k]) => /Name first middle last/.test(k)).map(([, v]) => v)
    expect(names.sort()).toEqual([1, 2, 3, 4, 5, 6].map((n) => `Member ${n}`))
  })

  it("places the copies right after the template page, in order, and leaves an empty column empty", async () => {
    const a = completeHomeWithAllSupplements()
    a.supplements.b.members = [1, 2, 3, 4, 5].map((n) => member(n))
    const doc = await PDFDocument.load(await fillSaca2Pdf(a, null, ON))
    const form = doc.getForm()
    const refToName = new Map<string, string>()
    for (const f of form.getFields()) for (const w of f.acroField.getWidgets()) refToName.set(doc.context.getObjectRef(w.dict)!.toString(), f.getName())
    const firstNames = doc.getPages().map((p) => {
      const refs = (p.node.Annots()?.asArray() ?? []).filter((x): x is PDFRef => x instanceof PDFRef)
      return refs.map((r) => refToName.get(r.toString())!).find((n) => /^AI\/AN Person 1[._] Name first middle last/.test(n))
    })
    const at = firstNames.findIndex((n) => n === B(0).name)
    expect(firstNames.slice(at, at + 3)).toEqual([B(0).name, B(0, 1).name, B(0, 2).name])
    expect(form.getTextField(B(0, 2).name).getText()).toBe("Member 5")
    expect(form.getTextField(B(1, 2).name).getText()).toBeUndefined()
  })
})

describe("Supplement C for both spouses", () => {
  it("writes Person 1 on the template page and Person 2 on the copy", async () => {
    const a = coupleBoth()
    expect(extraPages(a)).toEqual([44])
    const out = await fillRegion(a)
    const p1 = C(0)
    const p2 = C(1)
    expect(out.text[p1.first]).toBe("Walter")
    expect(out.text[p2.first]).toBe("Dorothy")
    expect(out.text[p1.health[0]]).toBe("Problem 1a")
    expect(out.text[p2.health[1]]).toBe("Problem 2b")
    expect(out.text[p1.times[5]]).toBe("1")
    expect(out.text[p2.times[5]]).toBe("2")
    expect(out.text[p2.days[5]]).toBe("3")
    expect(out.text[p2.cgName[1]]).toBe("Helper 2b")
    expect(out.text[p2.phone]).toBe("(617) 555-0199")
    expect(stateOf(out.checks, p1.gender)).toBe("M")
    expect(stateOf(out.checks, p2.gender)).toBe("F")
    expect(stateOf(out.checks, p2.yes[5])).toBe("Yes")
    expect(stateOf(out.checks, p2.yes[0])).toBe("No")
  })

  it("when only Person 2 qualifies her answers fill the template page and there is no copy", async () => {
    const a = coupleBoth()
    a.pca.byPerson[0] = { permanentDisability: "no", disabilityBlocksAdls: null, willContactPcmAgency: null } as never
    a.supplements.c[0].healthProblems = [SENTINEL, "", ""]
    expect(extraPages(a)).toEqual([])
    const out = await fillRegion(a)
    expect(out.text[C(0).first]).toBe("Dorothy")
    expect(out.text[C(0).health[0]]).toBe("Problem 2a")
    expect(Object.values(out.text)).not.toContain(SENTINEL)
  })

  it("Person 2 gets no page when she does not qualify, whatever is stored", async () => {
    const a = coupleBoth()
    a.pca.byPerson[1] = { permanentDisability: "no", disabilityBlocksAdls: null, willContactPcmAgency: null } as never
    a.supplements.c[1].healthProblems = [SENTINEL, "", ""]
    expect(extraPages(a)).toEqual([])
    const out = await fillRegion(a)
    expect(out.text[C(0).first]).toBe("Walter")
    expect(Object.values(out.text)).not.toContain(SENTINEL)
  })
})

describe("Supplement D with four jobs", () => {
  it("fills one page per job in order; each change option writes only its own fields", async () => {
    const a = completeHomeWithAllSupplements()
    a.supplements.d.jobs = [
      job(1),
      job(2, { upcomingChange: "employerWillNotOffer", changeEndDate: "2027-01-31", changePremium: 999, changeDate: "2027-02-01" }),
      job(3, { upcomingChange: "personWillDrop", changeEndDate: "2027-03-31", changePremium: 998, changeDate: "2027-04-01" }),
      job(4, { upcomingChange: "employerWillChange", changeEndDate: "2027-05-31", changePremium: 77.25, changePremiumFrequency: "quarterly", changeDate: "2027-06-01" }),
    ]
    expect(extraPages(a)).toEqual([45, 46, 47])
    const out = await fillRegion(a)
    for (let page = 0; page < 4; page += 1) {
      const n = page + 1
      const d = D(page)
      expect(out.text[d.name]).toBe(`Employee ${n}`)
      expect(d.ssn.map((f) => out.text[f]).join("")).toBe(`12345678${n}`)
      expect(d.ein.map((f) => out.text[f]).join("")).toBe(`98765432${n}`)
      expect(out.text[d.employer]).toBe(`Employer ${n}`)
      expect(out.text[d.premium14]).toBe(String(10 * n))
      expect(out.text[d.often14]).toBe("Weekly")
      expect(out.text[d.plan15]).toBe(`Family ${n}`)
      expect(out.text[d.premium15]).toBe(`${20 * n}.50`)
      expect(out.text[d.often15]).toBe("Yearly")
      expect(stateOf(out.checks, d.minValue15)).toBe("No")
    }
    const sixteen = (p: number) => [out.text[D(p).end16a], out.text[D(p).end16b], out.text[D(p).premium16], out.text[D(p).often16], out.text[D(p).date16]]
    expect(sixteen(0)).toEqual([undefined, undefined, undefined, undefined, undefined])
    expect(sixteen(1)).toEqual(["01/31/2027", undefined, undefined, undefined, undefined])
    expect(sixteen(2)).toEqual([undefined, "03/31/2027", undefined, undefined, undefined])
    expect(sixteen(3)).toEqual([undefined, undefined, "77.25", "Quarterly", "06/01/2027"])
    expect(Object.values(out.text)).not.toContain("999")
  })

  it("lists each job's 14a name and a Federal Tax ID that is not nine digits on the sheet; hidden answers never", () => {
    const a = completeHomeWithAllSupplements()
    a.supplements.d.jobs = [job(1), job(2, { employerFederalTaxId: "12-345" }), job(3, { eligibleWithinThreeMonths: "no", individualPlanName: SENTINEL })]
    const sheet = buildOverflowSheets(a, ON).find((s) => s.title === "Supplement D: additional information")!
    const item14a = "14a. Name of the lowest-cost individual health plan offered to the employee"
    expect(sheet.rows).toEqual([
      ["Job 1 - Employee 1 / Employer 1", item14a, "Plan 1"],
      ["Job 2 - Employee 2 / Employer 2", item14a, "Plan 2"],
      ["Job 2 - Employee 2 / Employer 2", "5. Federal Tax ID (not nine digits, so it does not fit the form's boxes)", "12-345"],
    ])
    expect(federalTaxIdDigits("98-7654321")).toBe("987654321")
    expect(federalTaxIdDigits("12-345")).toBeUndefined()
  })

  it("a job that is not eligible shows only its employee and the No answer", async () => {
    const a = completeHomeWithAllSupplements()
    a.supplements.d.jobs = [job(1, { eligibleWithinThreeMonths: "no", employerName: SENTINEL })]
    const out = await fillRegion(a)
    expect(out.text[D().name]).toBe("Employee 1")
    expect(stateOf(out.checks, D().eligible)).toBe("No")
    expect(Object.values(out.text)).not.toContain(SENTINEL)
  })

  it("upcomingChange none with stale dates and premium writes none of the 16 fields", async () => {
    const a = completeHomeWithAllSupplements()
    a.supplements.d.jobs = [job(1, { upcomingChange: "none", changeEndDate: "2027-01-31", changePremium: 555, changePremiumFrequency: "monthly", changeDate: "2027-02-01" })]
    const out = await fillRegion(a)
    for (const f of [D().end16a, D().end16b, D().premium16, D().often16, D().date16]) expect(out.text[f]).toBeUndefined()
  })
})

describe("hidden supplements leave nothing behind", () => {
  async function absent(a: Saca2Answers, re: RegExp) {
    const out = await readFilled(await fillSaca2Pdf(a, null, ON))
    expect(Object.keys({ ...out.text, ...out.checks }).filter((n) => re.test(n))).toEqual([])
    expect(Object.values(out.text)).not.toContain(SENTINEL)
  }

  it("Supplement B hidden (no AI/AN member) with stale members", async () => {
    const a = completeHomeWithAllSupplements()
    a.aian.anyMember = "no"
    a.supplements.b.members = [1, 2, 3, 4, 5].map((n) => member(n, { name: SENTINEL }))
    expect(extraPages(a).filter((i) => i <= 43)).toEqual([])
    await absent(a, /^AI\/AN/)
  })

  it("Supplement C hidden with stale data", async () => {
    const a = completeHomeWithAllSupplements()
    a.pca.needsPca = "no"
    a.supplements.c[0].healthProblems = [SENTINEL, "", ""]
    a.supplements.c[1].healthProblems = [SENTINEL, "", ""]
    await absent(a, /_SuppC|SuppC_/)
  })

  it("Supplement D hidden (no employer coverage) with stale jobs", async () => {
    const a = completeHomeWithAllSupplements()
    a.health.employerOfferedCoverage = "no"
    a.health.hasOtherCoverage = "no"
    a.supplements.d.jobs = [1, 2, 3, 4].map((n) => job(n, { employeeName: SENTINEL }))
    expect(extraPages(a).filter((i) => i >= 45)).toEqual([])
    await absent(a, /SuppD|suppD/)
    expect(buildOverflowSheets(a, ON).some((s) => s.title.startsWith("Supplement D"))).toBe(false)
  })
})

describe("never-fill sweep", () => {
  it("never writes the signature fields, in any variant", async () => {
    const full = completeHomeWithAllSupplements()
    full.supplements.b.members = [1, 2, 3, 4, 5, 6].map((n) => member(n))
    full.supplements.d.jobs = [1, 2, 3, 4].map((n) => job(n))
    for (const a of [completeHomeWithAllSupplements(), coupleBoth(), full]) {
      const out = await readFilled(await fillSaca2Pdf(a, null, ON))
      for (const n of SIGNATURE_FIELDS) {
        expect(out.text[n]).toBeUndefined()
        expect(out.text[copyFieldName(n, 1)]).toBeUndefined()
      }
    }
    for (const n of SIGNATURE_FIELDS) expect(MAPPED.has(n)).toBe(false)
  })
})
