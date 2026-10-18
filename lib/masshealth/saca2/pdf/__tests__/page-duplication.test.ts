/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { PDFArray, PDFCheckBox, PDFDict, PDFDocument, PDFName, PDFRef, PDFTextField } from "pdf-lib"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { completeHomeWithAllSupplements } from "../../__tests__/complete-answers"
import { getInventory } from "../inventory"
import { copyFieldName, duplicatePage } from "../page-duplication"
import { fillSaca2Pdf } from "../pdf-fill"
import { splitCoverageNames, splitSharedFields, removeStrayTableWidgets } from "../split-shared-fields"
import { loadSaca2Template } from "../template"
import { B, job, member } from "./supp-bcd-helpers"

vi.setConfig({ testTimeout: 120_000 })

const ON = new Date("2026-10-13T12:00:00Z")
let template: Uint8Array

beforeAll(async () => {
  template = await loadSaca2Template()
})

async function loadSplit(): Promise<PDFDocument> {
  const doc = await PDFDocument.load(template)
  splitSharedFields(doc)
  splitCoverageNames(doc)
  removeStrayTableWidgets(doc)
  return doc
}

describe("duplicatePage", () => {
  it("copies pages 30-32 as new, uniquely named, blank, fillable fields", async () => {
    const doc = await loadSplit()
    const before = doc.getForm().getFields().length
    const expected = getInventory().filter((f) => [30, 31, 32].some((p) => f.pages.includes(p)))
    for (const index of [30, 31, 32]) {
      const copy = duplicatePage(doc, index, "__copy1")
      expect(copy.page.ref.toString()).toBe(doc.getPages().at(-1)!.ref.toString())
    }
    const fields = doc.getForm().getFields()
    expect(fields.length).toBe(before + expected.length)
    const names = fields.map((f) => f.getName())
    expect(new Set(names).size).toBe(names.length)
    for (const f of expected) {
      const copy = doc.getForm().getField(copyFieldName(f.name, 1))
      expect(copy.constructor).toBe(doc.getForm().getField(f.name).constructor)
      expect(copy.acroField.getWidgets().length).toBe(f.widgets.length)
      if (copy instanceof PDFTextField) expect(copy.getText()).toBeUndefined()
      if (copy instanceof PDFCheckBox) expect(copy.isChecked()).toBe(false)
    }
    // the source page is untouched: same fields, same widgets
    expect(doc.getForm().getField("Last name_SuppC").acroField.getWidgets()).toHaveLength(1)
  })

  it("keeps the template's field properties (maxLength, type) on the copy and rejects a bad page", async () => {
    const doc = await loadSplit()
    duplicatePage(doc, 31, "__copy1")
    expect((doc.getForm().getField("MI_SuppC__copy1") as PDFTextField).getMaxLength()).toBe(2)
    expect(() => duplicatePage(doc, 999, "__copy2")).toThrow(/page index/i)
  })

  it("every widget of a copy sits on the copy page, with a parent that lists it, and no ref dangles", async () => {
    const doc = await PDFDocument.load(await fillSaca2Pdf(withCopies(), template, ON))
    const pageRefs = new Set(doc.getPages().map((p) => p.ref.toString()))
    for (const field of doc.getForm().getFields()) {
      if (!field.getName().includes("__copy")) continue
      for (const widget of field.acroField.getWidgets()) {
        expect(pageRefs.has(widget.P()!.toString()), field.getName()).toBe(true)
        const ref = doc.context.getObjectRef(widget.dict)!
        const page = doc.getPages().find((p) => p.ref.toString() === widget.P()!.toString())!
        expect(page.node.Annots()!.asArray().some((a) => a.toString() === ref.toString())).toBe(true)
        const parent = widget.dict.get(PDFName.of("Parent"))
        if (parent) {
          const kids = doc.context.lookup(parent, PDFDict).lookup(PDFName.of("Kids"), PDFArray)
          expect(kids.asArray().some((k) => k.toString() === ref.toString())).toBe(true)
        }
      }
    }
    // every ref reachable from an annotation or the AcroForm resolves
    const fields = doc.catalog.lookup(PDFName.of("AcroForm"), PDFDict).lookup(PDFName.of("Fields"), PDFArray)
    for (const ref of fields.asArray()) expect(doc.context.lookup(ref as PDFRef)).toBeDefined()
  })
})

function withCopies() {
  const a = completeHomeWithAllSupplements()
  a.supplements.b.members = [1, 2, 3, 4, 5, 6].map((n) => member(n))
  a.supplements.d.jobs = [1, 2, 3, 4].map((n) => job(n))
  return a
}

describe("filled output with page copies", () => {
  it("has 42 + 2 + 3 pages (plus sheets), unique field names, copies fillable and editable after reload", async () => {
    const a = withCopies()
    const bytes = await fillSaca2Pdf(a, template, ON)
    const doc = await PDFDocument.load(bytes)
    const names = doc.getForm().getFields().map((f) => f.getName())
    expect(new Set(names).size).toBe(names.length)
    // 1,158 template fields + B copies 2 x 18 + D copies 3 x 42 (Supplement C has one person: its copy is dropped)
    expect(names).toHaveLength(1158 + 36 + 126)
    expect(names.some((n) => n.startsWith("Last name_SuppC__copy"))).toBe(false)
    const form = doc.getForm()
    form.getTextField(B(0, 2).name).setText("Edited")
    const again = await PDFDocument.load(await doc.save())
    expect(again.getForm().getTextField(B(0, 2).name).getText()).toBe("Edited")
    expect(again.getForm().getCheckBox(B(0, 1).federal).isChecked()).toBe(true)
  })

  it("renders with poppler and ghostscript without warnings", async () => {
    const bytes = await fillSaca2Pdf(withCopies(), template, ON)
    const dir = mkdtempSync(path.join(tmpdir(), "saca2-dup-"))
    try {
      const file = path.join(dir, "out.pdf")
      writeFileSync(file, bytes)
      const gs = spawnSync("gs", ["-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=nullpage", file], { encoding: "utf8" })
      if (gs.error) return // ghostscript not installed here
      expect(`${gs.stdout}${gs.stderr}`.trim()).toBe("")
      const pp = spawnSync("pdftoppm", ["-r", "20", "-png", file, path.join(dir, "p")], { encoding: "utf8" })
      if (!pp.error) expect(pp.stderr.trim()).toBe("")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("unused copies leave no field behind: the base fixture has exactly the template's 1,158 fields", async () => {
    const doc = await PDFDocument.load(await fillSaca2Pdf(completeHomeWithAllSupplements(), template, ON))
    expect(doc.getForm().getFields()).toHaveLength(1158)
    expect(doc.getForm().getFields().some((f) => f.getName().includes("__copy"))).toBe(false)
  })
})
