/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { PDFDocument, PDFName, PDFTextField } from "pdf-lib"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { completeHomeWithAllSupplements, completeRichHousehold, completeSingleSenior } from "../../__tests__/complete-answers"
import { buildOverflowSheets } from "../overflow-plan"
import { getInventory } from "../inventory"
import { PAGE_RANGES, pagesToKeep, selectPages, TEMPLATE_PAGE_COUNT } from "../page-selection"
import { collectFillValues, fillSaca2Pdf } from "../pdf-fill"
import { splitSharedFields } from "../split-shared-fields"
import { loadSaca2Template } from "../template"
import { readFilled } from "./helpers/read-filled"

// each test loads the 1.7 MB template
vi.setConfig({ testTimeout: 60_000 })

const ON = new Date("2026-10-13T12:00:00Z")
const ALL = Array.from({ length: 42 }, (_, i) => i)

let template: Uint8Array

beforeAll(async () => {
  template = await loadSaca2Template()
})

async function loadSplit(): Promise<PDFDocument> {
  const doc = await PDFDocument.load(template)
  splitSharedFields(doc)
  return doc
}

/** [field name, page indexes of its widgets] read from the document as it is now. */
function widgetPages(doc: PDFDocument): Map<string, number[]> {
  const refs = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i]))
  return new Map(
    doc.getForm().getFields().map((f) => [f.getName(), f.acroField.getWidgets().map((w) => refs.get(w.P()?.toString() ?? "") ?? -1)]),
  )
}

/** The inventory's fields whose widgets all sit on the given pages. */
const fieldsOnlyOn = (pages: number[]) =>
  getInventory().filter((f) => f.pages.length > 0 && f.pages.every((p) => pages.includes(p)))

function pageText(bytes: Uint8Array, page: number): string | null {
  if (spawnSync("pdftotext", ["-v"]).error) {
    console.warn("pdftotext is not installed; skipping the page text assertions")
    return null
  }
  const dir = mkdtempSync(path.join(tmpdir(), "saca2-pages-"))
  try {
    const file = path.join(dir, "t.pdf")
    writeFileSync(file, bytes)
    return spawnSync("pdftotext", ["-layout", "-f", String(page + 1), "-l", String(page + 1), file, "-"], { encoding: "utf8" }).stdout
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe("PAGE_RANGES", () => {
  it("lists the supplement and attachment pages of the 42-page template as 0-based indexes", () => {
    expect(TEMPLATE_PAGE_COUNT).toBe(42)
    expect(PAGE_RANGES).toEqual({
      suppA: [26, 27, 28, 29],
      suppB: [30],
      suppC: [31],
      suppD: [32],
      ard: [34, 35, 36, 37],
      irs4506: [38, 39],
    })
  })

  it("never overlaps and covers every field of the supplements and attachments", () => {
    const all = Object.values(PAGE_RANGES).flat()
    expect(new Set(all).size).toBe(all.length)
    const inRanges = new Set(all)
    const supplementFieldPages = getInventory().filter((f) => f.pages.some((p) => p >= 26 && p <= 39))
    for (const field of supplementFieldPages) {
      // the only fields outside the ranges are the form's Print / Clear buttons on pages 2, 25 and 37
      const outside = field.pages.filter((p) => !inRanges.has(p))
      if (outside.length > 0) expect(["Print", "Clear"]).toContain(field.name)
    }
    expect(getInventory().filter((f) => f.pages.some((p) => p === 33 || p === 40 || p === 41))).toEqual([])
  })

  it("matches the printed pages of the template (pdftotext)", () => {
    const text = (page: number) => pageText(template, page)
    const expectations: Array<[number, string]> = [
      [25, "Sign this application"],
      [26, "SUPPLEMENT A"],
      [29, "Long-Term-Care Insurance"],
      [30, "SUPPLEMENT B"],
      [31, "SUPPLEMENT C"],
      [32, "SUPPLEMENT D"],
      [33, "IMMIGRATION STATUSES AND DOCUMENT TYPES"],
      [34, "Authorized Representative"],
      [35, "SECTION 1"],
      [36, "SECTION 2"],
      [37, "SECTION 3"],
      [38, "Form 4506"],
      [39, "Form 4506 (Rev. 4-2025)"],
      [40, "Voter Registration Form"],
    ]
    for (const [page, expected] of expectations) {
      const found = text(page)
      if (found !== null) expect(found).toContain(expected)
    }
    for (const page of PAGE_RANGES.ard) {
      const found = text(page)
      if (found !== null) expect(found).toContain("ARD-1122")
    }
  })
})

describe("selectPages", () => {
  it("keeping every page is a no-op: 42 pages, the same 1,157 fields on the same pages", async () => {
    const doc = await loadSplit()
    const before = widgetPages(doc)
    selectPages(doc, ALL)
    expect(doc.getPageCount()).toBe(42)
    expect(doc.getForm().getFields()).toHaveLength(1157)
    expect(widgetPages(doc)).toEqual(before)
  })

  it("dropping Supplement C removes exactly its page and its fields", async () => {
    const doc = await loadSplit()
    const before = widgetPages(doc)
    const suppCFields = fieldsOnlyOn([31]).map((f) => f.name)
    expect(suppCFields).toHaveLength(41)

    selectPages(doc, ALL.filter((i) => i !== 31))
    expect(doc.getPageCount()).toBe(41)
    const after = widgetPages(doc)
    expect(after.size).toBe(1157 - 41)
    expect([...before.keys()].filter((name) => !after.has(name)).sort()).toEqual([...suppCFields].sort())
  })

  it("leaves no field without a widget and no widget on a page that is gone, after saving and reloading", async () => {
    const doc = await loadSplit()
    selectPages(doc, ALL.filter((i) => !Object.values(PAGE_RANGES).flat().includes(i)))
    expect(doc.getPageCount()).toBe(42 - 13)

    const reloaded = await PDFDocument.load(await doc.save())
    const pages = new Set(reloaded.getPages().map((p) => p.ref.toString()))
    for (const field of reloaded.getForm().getFields()) {
      const widgets = field.acroField.getWidgets()
      expect(widgets.length, `field ${field.getName()} has no widget`).toBeGreaterThan(0)
      for (const widget of widgets) expect(pages.has(widget.P()?.toString() ?? "")).toBe(true)
    }
  })

  it("keeps the remaining field names and leaves them fillable", async () => {
    const doc = await loadSplit()
    selectPages(doc, ALL.filter((i) => i !== 31))
    const kept = getInventory().filter((f) => !fieldsOnlyOn([31]).includes(f)).map((f) => f.name)
    expect(doc.getForm().getFields().map((f) => f.getName()).sort()).toEqual([...kept].sort())

    doc.getForm().getTextField("12 City").setText("Boston")
    const reloaded = await PDFDocument.load(await doc.save())
    expect(reloaded.getForm().getTextField("12 City").getText()).toBe("Boston")
  })

  it("keeps a field that straddles pages, minus the widget on the removed page", async () => {
    const doc = await loadSplit()
    expect(widgetPages(doc).get("Print")).toEqual([2, 25, 37])
    selectPages(doc, ALL.filter((i) => !PAGE_RANGES.ard.includes(i)))
    const pages = widgetPages(doc)
    // page indexes shift when four pages before... none of these precede page 37, so 2 and 25 are unchanged
    expect(pages.get("Print")).toEqual([2, 25])
    expect(pages.get("Clear")).toEqual([2, 25])
  })

  it("removes pages in any order of keepIndexes and ignores duplicates", async () => {
    const doc = await loadSplit()
    selectPages(doc, [41, 0, 0, 5, 2])
    expect(doc.getPageCount()).toBe(4)
    expect(doc.getForm().getFields().length).toBeGreaterThan(0)
  })

  it("rejects an index outside the document without naming any data", async () => {
    const doc = await loadSplit()
    expect(() => selectPages(doc, [0, 42])).toThrow(/page index/i)
    expect(() => selectPages(doc, [-1])).toThrow(/page index/i)
    expect(() => selectPages(doc, [1.5])).toThrow(/page index/i)
    expect(doc.getPageCount()).toBe(42)
  })

  it("does not carry removed fields' values: a filled value on a removed page is gone", async () => {
    const doc = await loadSplit()
    const name = fieldsOnlyOn([31]).find((f) => f.type === "text")!.name
    doc.getForm().getTextField(name).setText("REMOVED-PAGE-VALUE")
    selectPages(doc, ALL.filter((i) => i !== 31))
    const reloaded = await PDFDocument.load(await doc.save())
    expect(reloaded.getForm().getFields().some((f) => f.getName() === name)).toBe(false)
    const acro = reloaded.catalog.lookup(PDFName.of("AcroForm"))
    expect(acro).toBeDefined()
    expect(reloaded.getForm().getFields().every((f) => !(f instanceof PDFTextField) || f.getText() !== "REMOVED-PAGE-VALUE")).toBe(true)
  })
})

describe("pagesToKeep", () => {
  const rangePages = Object.values(PAGE_RANGES).flat()

  it("drops Supplements A-D, the ARD and the IRS 4506 for a single senior and keeps the other 29 pages", () => {
    const keep = pagesToKeep(completeSingleSenior(), ON)
    expect(keep).toEqual(ALL.filter((i) => !rangePages.includes(i)))
    expect(keep).toHaveLength(29)
    // the immigration list (33), the consent and voter pages (24, 25, 40, 41) stay
    for (const page of [24, 25, 33, 40, 41]) expect(keep).toContain(page)
  })

  it("keeps every page when all supplements and attachments apply", () => {
    expect(pagesToKeep(completeHomeWithAllSupplements(), ON)).toEqual(ALL)
  })

  it("drops one range when only its step is hidden", () => {
    const a = completeHomeWithAllSupplements()
    a.aian.anyMember = "no"
    expect(pagesToKeep(a, ON)).toEqual(ALL.filter((i) => !PAGE_RANGES.suppB.includes(i)))
    const b = completeHomeWithAllSupplements()
    b.signature.signedBy = "applicant"
    expect(pagesToKeep(b, ON)).toEqual(ALL.filter((i) => !PAGE_RANGES.ard.includes(i)))
  })
})

describe("fillSaca2Pdf with page selection and overflow sheets", () => {
  it("a single senior's output has no supplement, ARD or IRS pages and no overflow", async () => {
    const out = await PDFDocument.load(await fillSaca2Pdf(completeSingleSenior(), template, ON))
    expect(out.getPageCount()).toBe(29)
    const names = new Set(out.getForm().getFields().map((f) => f.getName()))
    for (const field of getInventory()) {
      const removed = field.pages.every((p) => Object.values(PAGE_RANGES).flat().includes(p))
      expect(names.has(field.name)).toBe(!removed)
    }
  })

  it("a home applicant with every supplement keeps all 42 pages and all 1,157 fields", async () => {
    const out = await PDFDocument.load(await fillSaca2Pdf(completeHomeWithAllSupplements(), template, ON))
    expect(out.getPageCount()).toBe(42)
    expect(out.getForm().getFields()).toHaveLength(1157)
  })

  it("appends the overflow sheets after the kept form pages and keeps the filled values", async () => {
    const a = completeRichHousehold()
    a.persons[0].hasIncome = "yes"
    a.persons[0].income = [
      { kind: "wages", amount: 100, frequency: "weekly", seasonal: "no" },
      { kind: "wages", amount: 200, frequency: "monthly", seasonal: "no" },
    ] as typeof a.persons[0]["income"]
    const sheets = buildOverflowSheets(a, ON)
    expect(sheets).toHaveLength(1)

    const bytes = await fillSaca2Pdf(a, template, ON)
    const out = await PDFDocument.load(bytes)
    expect(out.getPageCount()).toBe(29 + sheets.length)
    expect(out.getPage(29).getSize()).toEqual({ width: 612, height: 792 })
    expect(out.getForm().getFields()).toHaveLength(1157 - fieldsOnlyOn(Object.values(PAGE_RANGES).flat()).length)

    const text = pageText(bytes, 29)
    if (text !== null) {
      expect(text).toContain("Continuation — Person 1 additional income")
      expect(text).toContain("Maria Q Testcase")
      expect(text).toContain("123-45-6789")
    }

    // every value the fill computed for a field that survived page selection is still on it
    const filled = await readFilled(bytes)
    const kept = new Set(out.getForm().getFields().map((f) => f.getName()))
    let checked = 0
    for (const { field, value } of collectFillValues(a, ON)) {
      if (!kept.has(field)) continue
      if (typeof value === "string") expect(filled.text[field]).toBe(value)
      else expect(filled.checks[field]).toBe(value.state)
      checked += 1
    }
    expect(checked).toBeGreaterThan(100)
  })

  it("stays editable and is deterministic apart from the modification date", async () => {
    // the dates live inside a compressed object stream: pin them and re-save uncompressed to compare
    const normalise = async (bytes: Uint8Array) => {
      const doc = await PDFDocument.load(bytes, { updateMetadata: false })
      doc.setModificationDate(new Date(0))
      doc.setCreationDate(new Date(0))
      return Buffer.from(await doc.save({ useObjectStreams: false, updateFieldAppearances: false }))
    }
    const a = completeRichHousehold()
    const first = await fillSaca2Pdf(a, template, ON)
    const second = await fillSaca2Pdf(a, template, ON)
    expect((await normalise(first)).equals(await normalise(second))).toBe(true)
    expect((await PDFDocument.load(first)).getForm().getFields().length).toBeGreaterThan(700)
  })
})
