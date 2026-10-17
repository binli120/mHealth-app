/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { rgb, StandardFonts, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib"

import { sanitizeText } from "./encoders"

/** The only thing layout needs from a font; a pdf-lib `PDFFont` satisfies it. */
export interface TextMeasurer {
  widthOfTextAtSize(text: string, size: number): number
}

export interface OverflowSheetOptions {
  /** Shown as "Continuation — {title}". */
  title: string
  /** Person 1's name, printed on every page as the form tells applicants to do on added pages. */
  headerName: string
  /** Person 1's SSN as it should print (the caller decides the "not provided" wording). */
  headerSsn: string
  columns: string[]
  rows: string[][]
}

export const PAGE_WIDTH = 612
export const PAGE_HEIGHT = 792
const MARGIN = 54
export const TABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN

const FONT_SIZE = 9
const LINE_HEIGHT = 11.5
const CELL_PAD_X = 4
const CELL_PAD_Y = 4
const HEADING_SIZE = 14
const APPLICANT_SIZE = 10
const FOOTER_SIZE = 8

const HEADING_Y = PAGE_HEIGHT - MARGIN - HEADING_SIZE
const APPLICANT_Y = HEADING_Y - 18
const TABLE_TOP = APPLICANT_Y - 14
const TABLE_BOTTOM = MARGIN + 8
const FOOTER_Y = MARGIN - 14
const TABLE_HEIGHT = TABLE_TOP - TABLE_BOTTOM

const MIN_COLUMN_WIDTH = 40
const MAX_NATURAL_WIDTH = 300

const lineBlockHeight = (lines: number) => lines * LINE_HEIGHT + 2 * CELL_PAD_Y

/** One cell wrapped to its column; always at least one (possibly empty) line. */
type CellLines = string[]

function breakWord(word: string, maxWidth: number, font: TextMeasurer): string[] {
  const parts: string[] = []
  let current = ""
  for (const ch of word) {
    if (current !== "" && font.widthOfTextAtSize(current + ch, FONT_SIZE) > maxWidth) {
      parts.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  if (current !== "") parts.push(current)
  return parts
}

/** Wraps at spaces to `maxWidth` points; a word wider than the column is broken by character. */
function wrapText(text: string, maxWidth: number, font: TextMeasurer): CellLines {
  const lines: string[] = []
  let current = ""
  for (const word of text.split(" ")) {
    if (word === "") continue
    const candidate = current === "" ? word : `${current} ${word}`
    if (font.widthOfTextAtSize(candidate, FONT_SIZE) <= maxWidth) {
      current = candidate
      continue
    }
    if (current !== "") lines.push(current)
    if (font.widthOfTextAtSize(word, FONT_SIZE) <= maxWidth) {
      current = word
    } else {
      const parts = breakWord(word, maxWidth, font)
      current = parts.pop() ?? ""
      lines.push(...parts)
    }
  }
  if (current !== "" || lines.length === 0) lines.push(current)
  return lines
}

function wrapRow(cells: string[], widths: number[], font: TextMeasurer): CellLines[] {
  return widths.map((width, i) => wrapText(sanitizeText(cells[i] ?? ""), Math.max(width - 2 * CELL_PAD_X, 1), font))
}

const MAX_MIN_WIDTH = 120

/**
 * Column widths in points, summing to the table width. Every column first gets room for its longest
 * word (capped, so one huge token cannot starve the rest) so short values like "Weekly" never break
 * mid-word; what is left is shared in proportion to how much more room each column's text wants.
 */
export function computeColumnWidths(columns: string[], rows: string[][], font: TextMeasurer): number[] {
  const measure = (value: string) => font.widthOfTextAtSize(value, FONT_SIZE)
  const stats = columns.map((column, i) => {
    const cells = [sanitizeText(column), ...rows.map((row) => sanitizeText(row[i] ?? ""))]
    let widest = 0
    let longestWord = 0
    for (const cell of cells) {
      widest = Math.max(widest, measure(cell))
      for (const word of cell.split(" ")) longestWord = Math.max(longestWord, measure(word))
    }
    const min = Math.min(Math.max(longestWord + 2 * CELL_PAD_X, MIN_COLUMN_WIDTH), MAX_MIN_WIDTH)
    const natural = Math.min(Math.max(widest + 2 * CELL_PAD_X, min), MAX_NATURAL_WIDTH)
    return { min, natural }
  })
  const minTotal = stats.reduce((sum, c) => sum + c.min, 0)
  if (minTotal >= TABLE_WIDTH) return stats.map((c) => (c.min / minTotal) * TABLE_WIDTH)
  const wanted = stats.reduce((sum, c) => sum + (c.natural - c.min), 0)
  const spare = TABLE_WIDTH - minTotal
  return stats.map((c) => c.min + (wanted === 0 ? spare / stats.length : (spare * (c.natural - c.min)) / wanted))
}

/**
 * The pure half of the sheet: wraps every cell to its column and packs rows onto pages. The result
 * is pages -> rows -> cells -> lines. A row taller than a page is split by lines across pages, so no
 * text is ever lost or clipped. `columns` only sizes the repeated header row.
 */
export function layoutRows(
  columns: string[],
  rows: string[][],
  font: TextMeasurer,
  widths: number[],
  tableHeight: number = TABLE_HEIGHT,
): CellLines[][][] {
  if (rows.length === 0) return []
  const headerLines = Math.max(...wrapRow(columns, widths, font).map((cell) => cell.length))
  const area = tableHeight - lineBlockHeight(headerLines)
  const maxLines = Math.max(Math.floor((area - 2 * CELL_PAD_Y) / LINE_HEIGHT), 1)

  const pages: CellLines[][][] = []
  let page: CellLines[][] = []
  let used = 0
  for (const cells of rows) {
    const wrapped = wrapRow(cells, widths, font)
    const total = Math.max(...wrapped.map((cell) => cell.length))
    for (let start = 0; start < total; start += maxLines) {
      const chunk = wrapped.map((cell) => {
        const slice = cell.slice(start, start + maxLines)
        return slice.length === 0 ? [""] : slice
      })
      const height = lineBlockHeight(Math.min(total - start, maxLines))
      if (page.length > 0 && used + height > area) {
        pages.push(page)
        page = []
        used = 0
      }
      page.push(chunk)
      used += height
    }
  }
  if (page.length > 0) pages.push(page)
  return pages
}

/** Cuts a single line to `maxWidth` with "..." so a very long name never runs off the page. */
function fitLine(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > maxWidth) cut = cut.slice(0, -1)
  return `${cut}...`
}

function drawPage(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  frame: { title: string; applicant: string; number: number; count: number },
  columns: string[],
  widths: number[],
  rows: CellLines[][],
): void {
  const { regular, bold } = fonts
  const black = rgb(0, 0, 0)
  const grey = rgb(0.45, 0.45, 0.45)
  page.drawText(fitLine(frame.title, bold, HEADING_SIZE, TABLE_WIDTH), { x: MARGIN, y: HEADING_Y, size: HEADING_SIZE, font: bold, color: black })
  page.drawText(fitLine(frame.applicant, regular, APPLICANT_SIZE, TABLE_WIDTH), {
    x: MARGIN,
    y: APPLICANT_Y,
    size: APPLICANT_SIZE,
    font: regular,
    color: black,
  })

  const xs = widths.reduce<number[]>((acc, w) => [...acc, acc[acc.length - 1] + w], [MARGIN])
  const drawCells = (cells: CellLines[], top: number, font: PDFFont) => {
    cells.forEach((lines, c) =>
      lines.forEach((line, j) => {
        if (line === "") return
        page.drawText(line, {
          x: xs[c] + CELL_PAD_X,
          y: top - CELL_PAD_Y - FONT_SIZE - j * LINE_HEIGHT,
          size: FONT_SIZE,
          font,
          color: black,
        })
      }),
    )
  }
  const rule = (y: number) =>
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + TABLE_WIDTH, y }, thickness: 0.5, color: grey })

  const headerCells = wrapRow(columns, widths, regular)
  const headerHeight = lineBlockHeight(Math.max(...headerCells.map((cell) => cell.length)))
  page.drawRectangle({ x: MARGIN, y: TABLE_TOP - headerHeight, width: TABLE_WIDTH, height: headerHeight, color: rgb(0.92, 0.92, 0.92) })
  drawCells(headerCells, TABLE_TOP, bold)
  rule(TABLE_TOP)
  rule(TABLE_TOP - headerHeight)

  let top = TABLE_TOP - headerHeight
  for (const cells of rows) {
    const height = lineBlockHeight(Math.max(...cells.map((cell) => cell.length)))
    drawCells(cells, top, regular)
    top -= height
    rule(top)
  }

  page.drawText("Attachment to SACA-2 application", { x: MARGIN, y: FOOTER_Y, size: FOOTER_SIZE, font: regular, color: grey })
  const label = `Page ${frame.number} of ${frame.count}`
  page.drawText(label, {
    x: MARGIN + TABLE_WIDTH - regular.widthOfTextAtSize(label, FOOTER_SIZE),
    y: FOOTER_Y,
    size: FOOTER_SIZE,
    font: regular,
    color: grey,
  })
}

/**
 * Appends continuation pages (US letter) with a table of `rows` to `doc`: heading
 * "Continuation — {title}", "Applicant: {name}   SSN: {ssn}" on every page (the form asks for the
 * name and SSN on any added page), wrapped cells, row separators, "page k of n" and the footer
 * "Attachment to SACA-2 application". Text goes through the form's sanitizer, so characters
 * Helvetica cannot draw print as "?" and nothing throws. Returns the number of pages added; no rows
 * adds nothing. The content is PHI: it is never put in errors or logs.
 */
export async function overflowSheet(doc: PDFDocument, options: OverflowSheetOptions): Promise<number> {
  if (options.rows.length === 0) return 0
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const columns = options.columns.map(sanitizeText)
  const widths = computeColumnWidths(columns, options.rows, regular)
  const pages = layoutRows(columns, options.rows, regular, widths)
  const title = `Continuation — ${sanitizeText(options.title)}`
  const applicant = `Applicant: ${sanitizeText(options.headerName)}   SSN: ${sanitizeText(options.headerSsn)}`

  pages.forEach((rows, i) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    drawPage(page, { regular, bold }, { title, applicant, number: i + 1, count: pages.length }, columns, widths, rows)
  })
  return pages.length
}
