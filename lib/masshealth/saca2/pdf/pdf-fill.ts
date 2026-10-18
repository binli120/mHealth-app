/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFCheckBox, PDFDocument, PDFName, PDFTextField, type PDFField } from "pdf-lib"

import type { Saca2Answers } from "../types"
import { applyCheckboxState } from "./checkbox-writer"
import { DERIVED } from "./derived"
import { encodeCheckbox, encodeToParts, isCheckboxEncoder } from "./encoders"
import { FILL_MAP } from "./field-map"
import { overflowSheet } from "./overflow"
import { buildOverflowSheets, overflowHeader } from "./overflow-plan"
import { createPageCopies, placePageCopies } from "./page-copies"
import { fieldsOnDroppedPages, pagesToKeep, selectPages } from "./page-selection"
import { removeStrayTableWidgets, splitCoverageNames, splitSharedFields } from "./split-shared-fields"
import { loadSaca2Template } from "./template"
import type { FieldEntry, FillItem } from "./types"
import { createVisibleReader, type VisibleReader } from "./visible-reader"

/**
 * Computes the value of a `derived` source (e.g. a person's full name). `person` is the entry's
 * `person` (0 = Person 1, 1 = Person 2) or `undefined` for non-person values.
 */
export type DerivedResolver = (reader: VisibleReader, answers: Saca2Answers, on: Date, person: 0 | 1 | undefined) => unknown
export type DerivedRegistry = Record<string, DerivedResolver>

function assertNoDuplicateFields(map: FieldEntry[]): void {
  const seen = new Set<string>()
  for (const entry of map) {
    for (const field of entry.fields) {
      if (seen.has(field)) throw new Error(`Field "${field}" is mapped more than once`)
      seen.add(field)
    }
  }
}

/**
 * The pure half of the fill: resolves every map entry through the visibility-aware reader and
 * encodes it. Entries whose value is absent or hidden produce nothing, so the template's blank
 * field stays untouched. Values never reach logs or error messages.
 */
export function collectFillValues(
  answers: Saca2Answers,
  on: Date,
  map: FieldEntry[] = FILL_MAP,
  derived: DerivedRegistry = DERIVED,
): FillItem[] {
  assertNoDuplicateFields(map)
  const reader = createVisibleReader(answers, on)
  const items: FillItem[] = []

  for (const entry of map) {
    const { source, encode, fields } = entry
    let raw: unknown
    if (source.kind === "derived") {
      const resolve = derived[source.id]
      if (!resolve) throw new Error(`Unknown derived source "${source.id}"`)
      raw = resolve(reader, answers, on, source.person)
    } else {
      raw = reader.get(source)
    }

    if (isCheckboxEncoder(encode)) {
      if (fields.length !== 1) throw new Error(`Checkbox entry for "${fields[0]}" must list exactly one field`)
      const state = encodeCheckbox(encode, raw)
      if (state !== undefined) items.push({ field: fields[0], value: { state } })
      continue
    }
    const parts = encodeToParts(encode, raw, fields.length)
    if (parts) parts.forEach((value, i) => items.push({ field: fields[i], value }))
  }
  return items
}

function indexFields(doc: PDFDocument): Map<string, PDFField> {
  return new Map(doc.getForm().getFields().map((f) => [f.getName(), f]))
}

/**
 * The template ships one checkbox whose /V names a state none of its widgets has (so it renders
 * unchecked but reports a value to form readers). Normalise every such field to Off so the output
 * never carries a phantom selection.
 */
function clearInvalidCheckboxValues(fields: Map<string, PDFField>): void {
  for (const [name, field] of fields) {
    if (!(field instanceof PDFCheckBox)) continue
    const v = field.acroField.dict.lookup(PDFName.of("V"))
    if (v === undefined || v === PDFName.of("Off")) continue
    if (!field.acroField.getWidgets().some((w) => w.getOnValue() === v)) applyCheckboxState(field, name, null)
  }
}

/**
 * Fills the SACA-2 template from the wizard answers. `templateBytes` of `null` loads the pinned
 * template. Only visible answers are written; unmapped fields are untouched; pages of supplements and
 * attachments whose step is hidden are removed with their fields; Supplement B, C and D pages are copied for the
 * records that do not fit one page and placed right after the page they copy; rows that do not fit the form go on
 * appended continuation sheets headed with Person 1's name and SSN; the result stays an
 * editable form (not flattened). A mapped field that is missing from the template, of the wrong
 * type, or too short for its value is a mapping bug and throws with the field name only.
 */
export async function fillSaca2Pdf(
  answers: Saca2Answers,
  templateBytes: Uint8Array | null,
  on: Date,
  map: FieldEntry[] = FILL_MAP,
  derived: DerivedRegistry = DERIVED,
): Promise<Uint8Array> {
  const items = collectFillValues(answers, on, map, derived)
  const doc = await PDFDocument.load(templateBytes ?? (await loadSaca2Template()))
  splitSharedFields(doc)
  splitCoverageNames(doc)
  removeStrayTableWidgets(doc)
  // the form's "attach a copy of this page" pages (Supplements B, C, D) exist as fillable pages up front, so
  // the map can address their fields; the ones the answers do not need are removed again below
  const pageCopies = createPageCopies(doc)
  const form = doc.getForm()
  const fields = indexFields(doc)

  // Validate the whole map against the template first, so a bad entry fails even when its value is blank.
  for (const entry of map) {
    for (const name of entry.fields) {
      const field = fields.get(name)
      if (!field) throw new Error(`Mapped field "${name}" does not exist in the template`)
      const wantsCheckbox = isCheckboxEncoder(entry.encode)
      if (wantsCheckbox ? !(field instanceof PDFCheckBox) : !(field instanceof PDFTextField)) {
        throw new Error(`Mapped field "${name}" is not a ${wantsCheckbox ? "checkbox" : "text field"}`)
      }
    }
  }

  // pdf-lib keeps the objects of removed pages in the saved file, so a value written to a field whose
  // pages are all dropped would stay in the bytes. The reader hides such fields; a map entry that
  // still targets one is a mapping bug (field name only in the message, never the value).
  const keep = pagesToKeep(answers, on)
  const dropped = fieldsOnDroppedPages(doc, keep)
  for (const { field } of items) {
    if (dropped.has(field)) throw new Error(`Field "${field}" is on a page that is not kept; refusing to write it`)
  }

  clearInvalidCheckboxValues(fields)

  for (const { field: name, value } of items) {
    const field = fields.get(name)!
    if (typeof value === "string") {
      const text = field as PDFTextField
      const max = text.getMaxLength()
      if (max !== undefined && value.length > max) {
        throw new Error(`Value for field "${name}" exceeds its maximum length of ${max}`)
      }
      text.setText(value)
    } else {
      applyCheckboxState(field as PDFCheckBox, name, value.state)
    }
  }

  form.updateFieldAppearances()

  // Hidden supplements and attachments leave with their fields; then the continuation sheets (rows
  // the form's blocks cannot hold) are appended after the kept form pages.
  selectPages(doc, keep)
  placePageCopies(doc, pageCopies)
  const header = overflowHeader(answers, on)
  for (const spec of buildOverflowSheets(answers, on)) await overflowSheet(doc, { ...header, ...spec })

  return doc.save({ updateFieldAppearances: true })
}
