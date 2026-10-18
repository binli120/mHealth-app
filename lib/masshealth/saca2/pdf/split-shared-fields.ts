/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFTextField,
  type PDFDocument,
} from "pdf-lib"

/** Name suffix of the Person 2 copy of a field the template shares between the two people's pages. */
export const SHARED_FIELD_SUFFIX = "__p2"

/** Person 1's block runs through PDF index 8; Person 2's own pages are 9-12 (index 8 holds both people's fields). */
const LAST_PERSON1_PAGE = 8
const FIRST_PERSON2_ONLY_PAGE = 9
const LAST_PERSON2_PAGE = 12

const COPIED_KEYS = ["DA", "Ff", "MaxLen", "Q"].map((k) => PDFName.of(k))

/**
 * The template reuses one text field for Person 1's and Person 2's copy of eight deduction amounts
 * (Q32 / Q42), so a single value would print on both pages. This gives Person 2 a field of her own:
 * for every text field with widgets both on Person 1's pages (up to index 8) and on Person 2's own
 * pages (9-12), the later widgets move to a new terminal field `<name>__p2` that copies /FT, /DA,
 * /Ff, /MaxLen and /Q. The original keeps its name and Person 1's widgets. Idempotent: once split,
 * nothing straddles and a second call changes nothing. Call right after loading, before reading fields.
 */
export function splitSharedFields(doc: PDFDocument): void {
  const form = doc.getForm()
  const pageIndexByRef = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i]))
  const context = doc.context
  const acroFields = doc.catalog.lookup(PDFName.of("AcroForm"), PDFDict).lookup(PDFName.of("Fields"), PDFArray)

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue
    const widgets = field.acroField.getWidgets().map((widget) => {
      const page = pageIndexByRef.get(widget.P()?.toString() ?? "") ?? -1
      return { widget, page, ref: context.getObjectRef(widget.dict) }
    })
    const moving = widgets.filter((w) => w.page >= FIRST_PERSON2_ONLY_PAGE && w.page <= LAST_PERSON2_PAGE)
    if (moving.length === 0 || moving.length === widgets.length) continue
    if (!widgets.some((w) => w.page >= 0 && w.page <= LAST_PERSON1_PAGE)) continue
    if (moving.some((w) => w.ref === undefined)) throw new Error(`Cannot split a widget of "${field.getName()}"`)

    const original = field.acroField.dict
    const kids = original.lookup(PDFName.of("Kids"), PDFArray)
    const copy = context.obj({
      FT: PDFName.of("Tx"),
      T: PDFHexString.fromText(`${field.getName()}${SHARED_FIELD_SUFFIX}`),
    }) as PDFDict
    for (const key of COPIED_KEYS) {
      const value = original.get(key)
      if (value !== undefined) copy.set(key, value)
    }
    const copyRef = context.register(copy)
    const moved = context.obj(moving.map((w) => w.ref as PDFRef))
    copy.set(PDFName.of("Kids"), moved)

    for (const w of moving) {
      w.widget.dict.set(PDFName.of("Parent"), copyRef)
      const at = kids.asArray().findIndex((k) => k === w.ref)
      if (at >= 0) kids.remove(at)
    }
    acroFields.push(copyRef)
  }
}

/** The securities table of Step 5 (form page 14). */
const SECURITIES_PAGE = 15

/**
 * The template's securities table on PDF index 15 carries a second, stray copy of its text widgets
 * about 82 points lower, sharing the SAME fields (39 extra widgets). The strays are listed in no
 * page's /Annots, so viewers such as poppler and Ghostscript do not draw them, but tools that place
 * widgets by their /P entry (pdf-lib `flatten()`) would print a Cash value on the Options row, and an
 * orphan appearance stream would carry the value. For every text field whose widgets all sit on that
 * page and number two or more, one widget is kept (the one listed in the page's /Annots, topmost
 * if several or none) and the others leave the field's /Kids. Idempotent.
 */
export function removeStrayTableWidgets(doc: PDFDocument): void {
  const form = doc.getForm()
  const pages = doc.getPages()
  const pageIndexByRef = new Map(pages.map((p, i) => [p.ref.toString(), i]))
  const context = doc.context
  const listed = new Set((pages[SECURITIES_PAGE].node.Annots()?.asArray() ?? []).map((a) => a.toString()))

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue
    const widgets = field.acroField.getWidgets().map((widget) => ({
      widget,
      page: pageIndexByRef.get(widget.P()?.toString() ?? "") ?? -1,
      top: widget.getRectangle().y + widget.getRectangle().height,
      ref: context.getObjectRef(widget.dict),
    }))
    if (widgets.length < 2 || !widgets.every((w) => w.page === SECURITIES_PAGE)) continue
    if (widgets.some((w) => w.ref === undefined)) throw new Error(`Cannot remove a widget of "${field.getName()}"`)

    const inAnnots = widgets.filter((w) => listed.has(String(w.ref)))
    const candidates = inAnnots.length > 0 ? inAnnots : widgets
    const keep = candidates.reduce((best, w) => (w.top > best.top ? w : best))
    const kids = field.acroField.dict.lookup(PDFName.of("Kids"), PDFArray)
    for (const w of widgets) {
      if (w === keep) continue
      const kidAt = kids.asArray().findIndex((k) => k === w.ref)
      if (kidAt >= 0) kids.remove(kidAt)
    }
  }
}
