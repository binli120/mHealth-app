/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFCheckBox, PDFName, type PDFForm } from "pdf-lib"

const OFF = PDFName.of("Off")
const V = PDFName.of("V")
const AS = PDFName.of("AS")

/**
 * Selects one on-state of a checkbox field, or clears it with `null`.
 *
 * SACA-2 mixes single /On boxes with groups (/Yes /No, /1 /2 in either widget order, /1../4) that
 * one field owns across several widgets, each widget carrying its own on-state. pdf-lib's
 * `check()` only knows the first on-state, so this writes the field's /V and every widget's /AS
 * directly: the matching widget gets the state, all others get /Off. The appearance dictionaries
 * are left alone. Throws (field name and allowed states only) for a state the field lacks.
 */
export function setCheckboxState(form: PDFForm, fieldName: string, onState: string | null): void {
  applyCheckboxState(lookupCheckBox(form, fieldName), fieldName, onState)
}

/** Same as {@link setCheckboxState} for a field the caller already holds (avoids a name lookup). */
export function applyCheckboxState(field: PDFCheckBox, fieldName: string, onState: string | null): void {
  const widgets = field.acroField.getWidgets()
  const widgetStates = widgets.map((w) => w.getOnValue()?.decodeText())

  if (onState !== null && !widgetStates.includes(onState)) {
    const allowed = [...new Set(widgetStates.filter((s): s is string => s !== undefined))]
    throw new Error(`Checkbox "${fieldName}" has no such state; allowed states: ${allowed.join(", ")}`)
  }

  field.acroField.dict.set(V, onState === null ? OFF : PDFName.of(onState))
  widgets.forEach((widget, i) => {
    widget.dict.set(AS, onState !== null && widgetStates[i] === onState ? PDFName.of(onState) : OFF)
  })
}

function lookupCheckBox(form: PDFForm, fieldName: string): PDFCheckBox {
  const field = form.getFieldMaybe(fieldName)
  if (!field) throw new Error(`Checkbox "${fieldName}" does not exist in the template`)
  if (!(field instanceof PDFCheckBox)) throw new Error(`Field "${fieldName}" is not a checkbox`)
  return field
}
