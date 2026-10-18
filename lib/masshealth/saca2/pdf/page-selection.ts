/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFArray, PDFDict, PDFName, PDFRef, type PDFDocument, type PDFObject } from "pdf-lib"

import type { Saca2StepId } from "../schema"
import type { Saca2Answers } from "../types"
import { isStepVisible } from "../visibility"
import { copiesNeeded, type CopyRegion } from "./derived-supp-bcd"
import { createVisibleReader } from "./visible-reader"

/** Page count of the pinned template. */
export const TEMPLATE_PAGE_COUNT = 42

export type PageRangeKey = Extract<Saca2StepId, "suppA" | "suppB" | "suppC" | "suppD" | "ard" | "irs4506">

/**
 * 0-based PDF page indexes of every supplement and attachment (the schema's `formPages` plus one,
 * because the PDF has the cover page before the form's page 1; confirmed against `pdftotext -layout`
 * of the pinned template and the field inventory):
 *
 * - suppA   26-29  Supplement A, form pages 25-28 (long-term care)
 * - suppB   30     Supplement B, form page 29 (American Indian / Alaska Native)
 * - suppC   31     Supplement C, form page 30 (personal-care attendant)
 * - suppD   32     Supplement D, form page 31 (health coverage from jobs)
 * - ard     34-37  ARD-1122, its pages 1-4 = form pages 33-36. Index 34 is the instruction page
 *                  ("Authorized Representative Designation Form", no fields); 35-37 are Sections 1-3
 * - irs4506 38-39  IRS Form 4506, form pages 37-38. Index 39 is the instruction page (no fields)
 *
 * Index 33 (form page 32, the immigration status and document lists), the consent / signature pages
 * and the voter registration form (40-41) belong to no step and are always kept.
 */
export const PAGE_RANGES: Record<PageRangeKey, readonly number[]> = {
  suppA: [26, 27, 28, 29],
  suppB: [30],
  suppC: [31],
  suppD: [32],
  ard: [34, 35, 36, 37],
  irs4506: [38, 39],
}

const RANGE_KEYS = Object.keys(PAGE_RANGES) as PageRangeKey[]

/**
 * Pages the form asks to be copied ("make a copy of this page" / "attach a copy of this page for each job"):
 * Supplement B (two people per page), C (one person) and D (one job). The fill appends `copies` copies of
 * the `source` page to the document, in this order, so the copies have the page indexes
 * TEMPLATE_PAGE_COUNT, TEMPLATE_PAGE_COUNT + 1, ... Copy `n` of a region (1-based) is placed right after
 * its source page (and after copy `n - 1`) in the output; copies nobody needs are removed again.
 */
export const PAGE_COPIES: ReadonlyArray<{ region: CopyRegion; source: number; copies: number }> = [
  { region: "suppB", source: 30, copies: 2 },
  { region: "suppC", source: 31, copies: 1 },
  { region: "suppD", source: 32, copies: 3 },
]

/** Document page index of copy `copy` (1-based) of `region` before pages are selected. */
export function copyPageIndex(region: CopyRegion, copy: number): number {
  let index = TEMPLATE_PAGE_COUNT
  for (const spec of PAGE_COPIES) {
    if (spec.region === region) {
      if (copy < 1 || copy > spec.copies) throw new Error(`Region "${region}" has no copy ${copy}`)
      return index + copy - 1
    }
    index += spec.copies
  }
  throw new Error(`Unknown copy region "${region}"`)
}

/**
 * Every page of the template except those of a supplement or attachment whose step is hidden, plus
 * the copy pages (indexes from TEMPLATE_PAGE_COUNT) the visible records need. Never reads a hidden
 * step's records: its pages are dropped and the reader sees no rows there.
 */
export function pagesToKeep(answers: Saca2Answers, on: Date): number[] {
  const dropped = new Set(RANGE_KEYS.filter((key) => !isStepVisible(key, answers, on)).flatMap((key) => PAGE_RANGES[key]))
  const template = Array.from({ length: TEMPLATE_PAGE_COUNT }, (_, i) => i).filter((i) => !dropped.has(i))
  const reader = createVisibleReader(answers, on)
  const copies = PAGE_COPIES.flatMap(({ region, copies: max }) => {
    const needed = Math.min(max, copiesNeeded(region, reader))
    return Array.from({ length: needed }, (_, i) => copyPageIndex(region, i + 1))
  })
  return [...template, ...copies]
}

/**
 * Removes every page not in `keepIndexes` and keeps the AcroForm consistent: widgets that sat on a
 * removed page leave their field's /Kids, and a field left with no widget leaves the form (and its
 * parent's /Kids), recursively. pdf-lib's `removePage` does none of this, so a removed page's fields
 * would otherwise stay in /Fields without a page. Fails (without data in the message) when the
 * result still has a field without a widget or a widget on a removed page.
 */
export function selectPages(doc: PDFDocument, keepIndexes: number[]): void {
  const pages = doc.getPages()
  const keep = new Set<number>()
  for (const index of keepIndexes) {
    if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
      throw new Error(`Invalid page index: expected a whole number from 0 to ${pages.length - 1}`)
    }
    keep.add(index)
  }
  const removed = pages.map((_, i) => i).filter((i) => !keep.has(i))
  if (removed.length === 0) return

  const removedPages = new Set(removed.map((i) => pages[i].ref.toString()))
  // widgets are matched by their /P page and by the removed pages' own /Annots (either may be absent)
  const removedWidgets = new Set<string>()
  for (const i of removed) {
    for (const annot of pages[i].node.Annots()?.asArray() ?? []) {
      if (annot instanceof PDFRef) removedWidgets.add(annot.toString())
    }
  }

  const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict)
  const fields = acroForm?.lookupMaybe(PDFName.of("Fields"), PDFArray)
  if (fields) pruneFields(doc, fields, removedPages, removedWidgets)

  // from the end, so the indexes still to remove do not shift
  for (const i of [...removed].reverse()) doc.removePage(i)

  assertConsistent(doc, removedPages, removedWidgets)
}

function isOnRemovedPage(node: PDFDict, ref: PDFObject | undefined, removedPages: Set<string>, removedWidgets: Set<string>): boolean {
  const page = node.get(PDFName.of("P"))
  if (page instanceof PDFRef && removedPages.has(page.toString())) return true
  return ref instanceof PDFRef && removedWidgets.has(ref.toString())
}

/** Filters a /Fields or /Kids array in place; a node stays when it keeps at least one widget. */
function pruneFields(doc: PDFDocument, array: PDFArray, removedPages: Set<string>, removedWidgets: Set<string>): void {
  for (let i = array.size() - 1; i >= 0; i -= 1) {
    const entry = array.get(i)
    const node = doc.context.lookupMaybe(entry, PDFDict)
    if (!node) continue
    const kids = node.lookupMaybe(PDFName.of("Kids"), PDFArray)
    if (kids) {
      pruneFields(doc, kids, removedPages, removedWidgets)
      if (kids.size() === 0) array.remove(i)
    } else if (isOnRemovedPage(node, entry, removedPages, removedWidgets)) {
      array.remove(i)
    }
  }
}

function assertConsistent(doc: PDFDocument, removedPages: Set<string>, removedWidgets: Set<string>): void {
  for (const field of doc.getForm().getFields()) {
    const widgets = field.acroField.getWidgets()
    if (widgets.length === 0) throw new Error(`Page selection left field "${field.getName()}" without a widget`)
    for (const widget of widgets) {
      if (isOnRemovedPage(widget.dict, doc.context.getObjectRef(widget.dict), removedPages, removedWidgets)) {
        throw new Error(`Page selection left a widget of field "${field.getName()}" on a removed page`)
      }
    }
  }
}

/**
 * Names of the fields whose widgets ALL sit on pages outside `keepIndexes` (a field that also has a
 * widget on a kept page stays in the output and is not listed).
 */
export function fieldsOnDroppedPages(doc: PDFDocument, keepIndexes: number[]): Set<string> {
  const keep = new Set(keepIndexes)
  const pageIndex = new Map(doc.getPages().map((page, i) => [page.ref.toString(), i]))
  const dropped = new Set<string>()
  for (const field of doc.getForm().getFields()) {
    const widgets = field.acroField.getWidgets()
    const pages = widgets.map((w) => pageIndex.get(w.P()?.toString() ?? ""))
    if (widgets.length > 0 && pages.every((p) => p !== undefined && !keep.has(p))) dropped.add(field.getName())
  }
  return dropped
}
