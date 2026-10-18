/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFPageLeaf, type PDFDocument, type PDFPage } from "pdf-lib"

import { copyFieldName, duplicatePage, type DuplicatedPage } from "./page-duplication"
import { PAGE_COPIES, copyPageIndex } from "./page-selection"
import type { CopyRegion } from "./derived-supp-bcd"

/** One appended copy page: which region and copy number it is, and the page it follows in the output. */
export interface PageCopy extends DuplicatedPage {
  region: CopyRegion
  /** 1-based copy number: the suffix of its fields is `__copy<copy>`. */
  copy: number
  source: PDFPage
}

/**
 * Appends every copy page of PAGE_COPIES to the document (in the order that gives them the indexes of
 * `copyPageIndex`). Call it on a freshly loaded and split template, before fields are indexed.
 */
export function createPageCopies(doc: PDFDocument): PageCopy[] {
  const sources = new Map(PAGE_COPIES.map((spec) => [spec.region, doc.getPages()[spec.source]]))
  const made: PageCopy[] = []
  for (const { region, source, copies } of PAGE_COPIES) {
    for (let copy = 1; copy <= copies; copy += 1) {
      const duplicate = duplicatePage(doc, source, copyFieldName("", copy))
      if (doc.getPages().indexOf(duplicate.page) !== copyPageIndex(region, copy)) {
        throw new Error(`Copy ${copy} of region "${region}" is not at its expected page index`)
      }
      made.push({ ...duplicate, region, copy, source: sources.get(region)! })
    }
  }
  return made
}

/**
 * Page refs in document order, read from the page tree itself: pdf-lib's `getPages()` keeps a cache that
 * `removePage` does not refresh, so after `selectPages` it still lists the removed pages.
 */
function livePageRefs(doc: PDFDocument): string[] {
  const refs: string[] = []
  doc.catalog.Pages().traverse((node, ref) => {
    if (node instanceof PDFPageLeaf) refs.push(ref.toString())
  })
  return refs
}

/**
 * After `selectPages` (which removed the copies nobody needs): deletes the objects of those removed
 * copies from the file (only objects created for the copy; shared streams stay) and moves each kept copy
 * to sit right after its source page and the earlier copies of the same region.
 */
export function placePageCopies(doc: PDFDocument, copies: PageCopy[]): void {
  const present = new Set(livePageRefs(doc))
  for (const copy of copies) {
    if (!present.has(copy.page.ref.toString())) for (const ref of copy.ownedRefs) doc.context.delete(ref)
  }
  const placedAfter = new Map<string, PDFPage>()
  for (const copy of copies.filter((c) => present.has(c.page.ref.toString()))) {
    const after = placedAfter.get(copy.region) ?? copy.source
    const indexOf = (page: PDFPage) => livePageRefs(doc).indexOf(page.ref.toString())
    if (indexOf(after) < 0) throw new Error(`Source page of region "${copy.region}" is not in the document`)
    doc.removePage(indexOf(copy.page))
    // the removal may have shifted the source page, so its index is read again
    doc.insertPage(indexOf(after) + 1, copy.page)
    placedAfter.set(copy.region, copy.page)
  }
}
