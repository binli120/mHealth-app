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
  type PDFDocument,
  type PDFObject,
  type PDFPage,
} from "pdf-lib"

/**
 * Name of copy `copy` (1-based; 0 = the template field itself) of a template field: the template's full name
 * with every "." replaced by "_", then `__copy<copy>` ("AI/AN Person 1. Name" -> "AI/AN Person 1_ Name__copy1").
 * A copy is a top-level field, and ISO 32000-1 12.7.3.2 forbids a period in a partial name (readers would take
 * it for the field hierarchy). The ONE place the copy naming lives: the duplicator and the field map both use it.
 */
export function copyFieldName(name: string, copy: number): string {
  if (!Number.isInteger(copy) || copy < 0) throw new Error("Page copy number must be a whole number from 0")
  return copy === 0 ? name : `${name.replaceAll(".", "_")}__copy${copy}`
}

/** A page appended by `duplicatePage` and everything created for it. */
export interface DuplicatedPage {
  page: PDFPage
  /** Full names of the new fields, in the order of the source page's fields. */
  fieldNames: string[]
  /**
   * Objects created for this copy (the page, its widgets, its field dicts). Streams (page contents,
   * appearances) and resources are SHARED with the source page and are not listed, so deleting these
   * never touches the template.
   */
  ownedRefs: PDFRef[]
}

const NAME = (key: string) => PDFName.of(key)

/** Page entries that are copied by reference; /Parent, /Annots, /StructParents, /Thumb and /LastModified are the copy's own. */
const PAGE_KEYS_NOT_COPIED = new Set(["Parent", "Annots", "StructParents", "Thumb", "LastModified", "Type"])
/** Keys a field inherits from its ancestors when it does not carry them itself. */
const INHERITED_KEYS = ["FT", "Ff", "DA", "Q", "MaxLen", "TU", "AA"] as const
/** Keys that do not move to a copy: tree links, the page, the value, and the structure-tree link. */
const NOT_COPIED = new Set(["Parent", "P", "T", "V", "DV", "Kids", "StructParent", "StructParents"])

function lookupDict(doc: PDFDocument, value: PDFObject | undefined): PDFDict | undefined {
  const found = value === undefined ? undefined : doc.context.lookup(value)
  return found instanceof PDFDict ? found : undefined
}

/** Value of `key` on `dict` or the nearest ancestor that has it. */
function inherited(doc: PDFDocument, dict: PDFDict, key: string): PDFObject | undefined {
  let node: PDFDict | undefined = dict
  for (let depth = 0; node && depth < 32; depth += 1) {
    const value = node.get(NAME(key))
    if (value !== undefined) return value
    node = lookupDict(doc, node.get(NAME("Parent")))
  }
  return undefined
}

/** A one-level-deeper copy of an /AP dict so the copy owns its state dictionaries (the streams stay shared). */
function cloneAppearance(doc: PDFDocument, ap: PDFObject | undefined): PDFObject | undefined {
  const dict = lookupDict(doc, ap)
  if (!dict) return ap
  const out = dict.clone()
  for (const key of ["N", "R", "D"]) {
    const sub = out.get(NAME(key))
    // a dict of states (checkbox) is cloned; a single stream (text field) is not a dict and stays shared
    const subValue = sub === undefined ? undefined : doc.context.lookup(sub)
    if (subValue instanceof PDFDict) out.set(NAME(key), subValue.clone())
  }
  return out
}

/** Copies the entries of a widget or field dict that the copy keeps. */
function copyEntries(doc: PDFDocument, from: PDFDict, to: PDFDict): void {
  for (const [key, value] of from.entries()) {
    const name = key.decodeText()
    if (NOT_COPIED.has(name)) continue
    to.set(key, name === "AP" ? (cloneAppearance(doc, value) ?? value) : value)
  }
}

/**
 * Appends a copy of page `pageIndex` whose form fields are NEW, uniquely named AcroForm fields
 * (`copyFieldName(<field name>, copyNumber)`), so the copy is independently fillable and editable. The source page is
 * untouched. Each widget keeps its position, flags, appearance characteristics and appearance states;
 * field type, flags, default appearance, quadding, maximum length and tooltip are resolved through
 * the source's field hierarchy and written onto the new field, which is a top-level field of its own
 * (the template's grouped names such as "AI/AN Person 1" + ". Name" become the single period-free name
 * "AI/AN Person 1_ Name__copy1"). The copy starts blank: no values, every box Off. Page content,
 * resources and appearance streams are shared with the source (legal PDF, nothing to copy).
 *
 * Throws, naming only the field, when the page holds anything this does not model (a non-widget
 * annotation, a field with a widget on another page).
 */
export function duplicatePage(doc: PDFDocument, pageIndex: number, copyNumber: number): DuplicatedPage {
  const pages = doc.getPages()
  const source = pages[pageIndex]
  if (!source) throw new Error(`Invalid page index: expected a whole number from 0 to ${pages.length - 1}`)
  const context = doc.context
  const form = doc.getForm()
  const sourceRef = source.ref

  const copy = doc.addPage()
  for (const [key, value] of source.node.entries()) {
    if (!PAGE_KEYS_NOT_COPIED.has(key.decodeText())) copy.node.set(key, value)
  }
  const ownedRefs: PDFRef[] = [copy.ref]

  // every annotation must be a widget of a form field
  const widgetRefs = new Set<string>()
  const annots = source.node.Annots()?.asArray() ?? []
  const widgetFields = new Map<string, { name: string; terminal: PDFDict }>()
  for (const field of form.getFields()) {
    for (const widget of field.acroField.getWidgets()) {
      if (widget.P()?.toString() !== sourceRef.toString()) continue
      const ref = context.getObjectRef(widget.dict)
      if (ref) widgetFields.set(ref.toString(), { name: field.getName(), terminal: field.acroField.dict })
    }
  }
  for (const annot of annots) {
    if (!(annot instanceof PDFRef) || !widgetFields.has(annot.toString())) {
      throw new Error("Page duplication found an annotation that is not a form widget")
    }
    widgetRefs.add(annot.toString())
  }

  const newAnnots: PDFRef[] = []
  const fieldNames: string[] = []
  const done = new Set<PDFDict>()
  for (const annot of annots as PDFRef[]) {
    const { name, terminal } = widgetFields.get(annot.toString())!
    if (done.has(terminal)) continue
    done.add(terminal)

    const newName = copyFieldName(name, copyNumber)
    const field = context.obj({}) as PDFDict
    const widgetDict = lookupDict(doc, annot)!
    const merged = terminal === widgetDict
    copyEntries(doc, terminal, field)
    for (const key of INHERITED_KEYS) {
      if (field.get(NAME(key)) === undefined) {
        const value = inherited(doc, terminal, key)
        if (value !== undefined) field.set(NAME(key), value)
      }
    }
    field.set(NAME("T"), PDFHexString.fromText(newName))
    const fieldRef = context.register(field)
    ownedRefs.push(fieldRef)
    fieldNames.push(newName)

    const toAdd: Array<{ ref: PDFRef; dict: PDFDict }> = []
    if (merged) {
      field.set(NAME("P"), copy.ref)
      toAdd.push({ ref: fieldRef, dict: field })
    } else {
      const kids = terminal.lookupMaybe(NAME("Kids"), PDFArray)
      if (!kids) throw new Error(`Field "${name}" has no widget`)
      const newKids = context.obj([]) as PDFArray
      for (const kid of kids.asArray()) {
        if (!(kid instanceof PDFRef) || !widgetRefs.has(kid.toString())) {
          throw new Error(`Field "${name}" has a widget that is not on the duplicated page`)
        }
        const kidDict = lookupDict(doc, kid)!
        const widget = context.obj({}) as PDFDict
        copyEntries(doc, kidDict, widget)
        widget.set(NAME("Parent"), fieldRef)
        widget.set(NAME("P"), copy.ref)
        const widgetRef = context.register(widget)
        ownedRefs.push(widgetRef)
        newKids.push(widgetRef)
        toAdd.push({ ref: widgetRef, dict: widget })
      }
      field.set(NAME("Kids"), newKids)
    }
    for (const { ref, dict } of toAdd) {
      // a blank copy: every checkbox / radio widget starts Off
      if (dict.get(NAME("AS")) !== undefined) dict.set(NAME("AS"), NAME("Off"))
      newAnnots.push(ref)
    }
    form.acroForm.addField(fieldRef)
  }
  copy.node.set(NAME("Annots"), context.obj(newAnnots))
  return { page: copy, fieldNames, ownedRefs }
}
