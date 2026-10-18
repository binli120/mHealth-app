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
 * about 82 points lower, sharing the SAME fields: a value written to the Cash row would also print on
 * the Options row (overlapping that row's own text) and over the Annuities text. For every text
 * field whose widgets all sit on that page and number two or more, only the topmost widget (the
 * table's own row) is kept; the others are removed from the field's kids and from the page's
 * annotations. Idempotent: afterwards no field has more than one widget there.
 */
export function removeStrayTableWidgets(doc: PDFDocument): void {
  const form = doc.getForm()
  const pages = doc.getPages()
  const pageIndexByRef = new Map(pages.map((p, i) => [p.ref.toString(), i]))
  const context = doc.context

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

    const keep = widgets.reduce((best, w) => (w.top > best.top ? w : best))
    const kids = field.acroField.dict.lookup(PDFName.of("Kids"), PDFArray)
    const annots = pages[SECURITIES_PAGE].node.Annots()
    for (const w of widgets) {
      if (w === keep) continue
      const kidAt = kids.asArray().findIndex((k) => k === w.ref)
      if (kidAt >= 0) kids.remove(kidAt)
      const annotAt = annots?.asArray().findIndex((a) => a === w.ref) ?? -1
      if (annotAt >= 0) annots?.remove(annotAt)
    }
  }
}
