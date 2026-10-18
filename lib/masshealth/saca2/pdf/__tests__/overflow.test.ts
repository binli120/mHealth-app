/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { PDFDict, PDFDocument, PDFName, StandardFonts } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { computeColumnWidths, layoutRows, overflowSheet, TABLE_WIDTH, type TextMeasurer } from "../overflow"

/** Every character is 5 points wide, so wrapping is easy to reason about. */
const FIXED: TextMeasurer = { widthOfTextAtSize: (text) => text.length * 5 }

const COLUMNS = ["Type", "Amount ($)"]
const rowsOf = (n: number): string[][] => Array.from({ length: n }, (_, i) => [`Row ${i + 1}`, String(100 + i)])

const OPTIONS = { title: "Additional income - Person 1", headerName: "Maria Q Testcase", headerSsn: "123-45-6789", columns: COLUMNS }

function pdftotext(bytes: Uint8Array): string | null {
  if (spawnSync("pdftotext", ["-v"]).error) {
    console.warn("pdftotext is not installed; skipping the text extraction assertion")
    return null
  }
  const dir = mkdtempSync(path.join(tmpdir(), "saca2-overflow-"))
  try {
    const file = path.join(dir, "out.pdf")
    writeFileSync(file, bytes)
    // pdftotext lays columns out with runs of spaces; compare with single spaces
    return spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }).stdout.replace(/[ \t]+/g, " ")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe("layoutRows", () => {
  it("wraps cell text at spaces to the column width, one line array per cell", () => {
    // width 60 - 2 * 4 padding = 52 points = 10 characters per line
    const pages = layoutRows(["A"], [["alpha beta gamma delta"]], FIXED, [60])
    expect(pages).toHaveLength(1)
    expect(pages[0]).toEqual([[["alpha beta", "gamma", "delta"]]])
  })

  it("breaks a word longer than the column instead of overflowing it", () => {
    const pages = layoutRows(["A"], [["x".repeat(25)]], FIXED, [60])
    expect(pages[0][0][0]).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)])
  })

  it("pads short rows, ignores extra cells and keeps an empty cell as one empty line", () => {
    const pages = layoutRows(["A", "B"], [["only"], ["a", "b", "c"]], FIXED, [100, 100])
    expect(pages[0]).toEqual([
      [["only"], [""]],
      [["a"], ["b"]],
    ])
  })

  it("paginates: every row appears once, in order, and pages are never empty", () => {
    const pages = layoutRows(COLUMNS, rowsOf(80), FIXED, [200, 200])
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every((p) => p.length > 0)).toBe(true)
    expect(pages.flat().map((row) => row[0][0])).toEqual(rowsOf(80).map((r) => r[0]))
  })

  it("returns no pages for no rows", () => {
    expect(layoutRows(COLUMNS, [], FIXED, [200, 200])).toEqual([])
  })

  it("splits one row taller than a page across pages without losing text", () => {
    const long = Array.from({ length: 900 }, (_, i) => `w${i}`).join(" ")
    const pages = layoutRows(["Text"], [[long]], FIXED, [200])
    expect(pages.length).toBeGreaterThan(1)
    const text = pages.flatMap((p) => p.flatMap((row) => row[0])).join(" ")
    expect(text).toBe(long)
  })
})

describe("computeColumnWidths", () => {
  it("fills the table width exactly and gives wide content more room", () => {
    const widths = computeColumnWidths(["Short", "Description"], [["a", "x".repeat(200)]], FIXED)
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(TABLE_WIDTH, 5)
    expect(widths[1]).toBeGreaterThan(widths[0])
  })
})

describe("computeColumnWidths: short values", () => {
  it("never leaves a column narrower than its longest word, so 'Weekly' does not break mid-word", () => {
    const widths = computeColumnWidths(["Amount ($)", "Notes", "How often"], [["101", "long ".repeat(80), "Weekly"]], FIXED)
    expect(widths[0]).toBeGreaterThanOrEqual("Amount".length * 5 + 8)
    expect(widths[2]).toBeGreaterThanOrEqual("Weekly".length * 5 + 8)
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(TABLE_WIDTH, 5)
    expect(layoutRows(["Amount ($)", "Notes", "How often"], [["101", "x", "Weekly"]], FIXED, widths)[0][0][2]).toEqual(["Weekly"])
  })
})

describe("overflowSheet", () => {
  it("adds nothing for zero rows", async () => {
    const doc = await PDFDocument.create()
    expect(await overflowSheet(doc, { ...OPTIONS, rows: [] })).toBe(0)
    expect(doc.getPageCount()).toBe(0)
  })

  it("puts 12 rows on one letter-size page with the heading, name and SSN", async () => {
    const doc = await PDFDocument.create()
    const added = await overflowSheet(doc, { ...OPTIONS, rows: rowsOf(12) })
    expect(added).toBe(1)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 })

    const text = pdftotext(await doc.save())
    if (text !== null) {
      expect(text).toContain("Continuation — Additional income - Person 1")
      expect(text).toContain("Applicant: Maria Q Testcase SSN: 123-45-6789")
      expect(text).toContain("Page 1 of 1")
      expect(text).toContain("Attachment to SACA-2 application")
      expect(text).toContain("Row 12")
    }
  })

  it("paginates 80 rows, repeating the headings on every page, and returns the page count", async () => {
    const doc = await PDFDocument.create()
    const added = await overflowSheet(doc, { ...OPTIONS, rows: rowsOf(80) })
    expect(added).toBeGreaterThan(1)
    expect(doc.getPageCount()).toBe(added)

    const text = pdftotext(await doc.save())
    if (text !== null) {
      expect(text.match(/Applicant: Maria Q Testcase SSN: 123-45-6789/g)).toHaveLength(added)
      expect(text.match(/Attachment to SACA-2 application/g)).toHaveLength(added)
      expect(text).toContain(`Page ${added} of ${added}`)
      expect(text).toContain("Row 80")
    }
  })

  it("appends after the pages already in the document", async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    doc.addPage()
    expect(await overflowSheet(doc, { ...OPTIONS, rows: rowsOf(3) })).toBe(1)
    expect(doc.getPageCount()).toBe(3)
    expect(doc.getPage(2).getSize()).toEqual({ width: 612, height: 792 })
  })

  it("wraps a very long cell without throwing", async () => {
    const doc = await PDFDocument.create()
    const long = "unbroken".repeat(2000)
    const spaced = Array.from({ length: 3000 }, (_, i) => `word${i}`).join(" ")
    const added = await overflowSheet(doc, { ...OPTIONS, rows: [["short", long], [spaced, "1"]] })
    expect(added).toBeGreaterThan(1)
    expect(doc.getPageCount()).toBe(added)
    await expect(doc.save()).resolves.toBeInstanceOf(Uint8Array)
  })

  it("turns characters Helvetica cannot draw into '?' instead of throwing, in cells and headings", async () => {
    const doc = await PDFDocument.create()
    const added = await overflowSheet(doc, {
      title: "日本語",
      headerName: "Zoë 😀 Müller",
      headerSsn: "123-45-6789",
      columns: ["Тип"],
      rows: [["日本語 😀 ok"]],
    })
    expect(added).toBe(1)

    const text = pdftotext(await doc.save())
    if (text !== null) {
      expect(text).toContain("Continuation — ???")
      expect(text).toContain("Applicant: Zoë ? Müller")
      expect(text).toContain("??? ? ok")
    }
  })

  it("is deterministic: the same input gives the same bytes", async () => {
    const make = async () => {
      const doc = await PDFDocument.create({ updateMetadata: false })
      await overflowSheet(doc, { ...OPTIONS, rows: rowsOf(30) })
      return doc.save()
    }
    expect(Buffer.from(await make()).equals(Buffer.from(await make()))).toBe(true)
  })

  it("embeds the two fonts once per document, however many sheets are appended", async () => {
    const doc = await PDFDocument.create()
    await overflowSheet(doc, { ...OPTIONS, rows: rowsOf(3) })
    await overflowSheet(doc, { ...OPTIONS, title: "Second", rows: rowsOf(3) })
    // pdf-lib writes embedded standard fonts when saving
    const saved = await PDFDocument.load(await doc.save())
    const fonts = [...saved.context.enumerateIndirectObjects()].filter(
      ([, o]) => o instanceof PDFDict && o.get(PDFName.of("Type")) === PDFName.of("Font"),
    )
    expect(fonts).toHaveLength(2)
  })

  it("wraps the header with the bold font it is drawn in", async () => {
    const doc = await PDFDocument.create()
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const regular = await doc.embedFont(StandardFonts.Helvetica)
    const title = "Amount before taxes"
    const width = regular.widthOfTextAtSize(title, 9) + 8 + 1 // fits in regular, not in bold
    expect(bold.widthOfTextAtSize(title, 9)).toBeGreaterThan(regular.widthOfTextAtSize(title, 9) + 1)
    expect(layoutRows([title], [["x"]], regular, [width])[0]).toBeDefined()
    // header height uses the bold measure: more header lines leave less room, so fewer rows fit
    const rows = Array.from({ length: 200 }, () => ["x"])
    const withRegular = layoutRows([title], rows, regular, [width])[0].length
    const withBold = layoutRows([title], rows, regular, [width], undefined, bold)[0].length
    expect(withBold).toBeLessThanOrEqual(withRegular)
  })

  it("measures with the same Helvetica the sheet draws with", async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const pages = layoutRows(["A"], [["The quick brown fox jumps over the lazy dog"]], font, [90])
    for (const line of pages[0][0][0]) expect(font.widthOfTextAtSize(line, 9)).toBeLessThanOrEqual(90 - 8)
  })
})
