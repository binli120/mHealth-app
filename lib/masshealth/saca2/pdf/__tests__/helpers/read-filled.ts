/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFCheckBox, PDFDocument, PDFName, PDFTextField } from "pdf-lib"

export interface FilledValues {
  /** Text fields that hold a non-empty value, by field name. Empty fields are absent. */
  text: Record<string, string>
  /** Every checkbox field by name: the selected on-state name (e.g. "On", "No", "2") or `null`. A /V naming no widget on-state counts as `null`. */
  checks: Record<string, string | null>
}

/** Reads a filled SACA-2 back with pdf-lib. Shared by every fill test. */
export async function readFilled(bytes: Uint8Array): Promise<FilledValues> {
  const doc = await PDFDocument.load(bytes)
  const out: FilledValues = { text: {}, checks: {} }
  for (const field of doc.getForm().getFields()) {
    if (field instanceof PDFTextField) {
      const value = field.getText()
      if (value !== undefined && value !== "") out.text[field.getName()] = value
    } else if (field instanceof PDFCheckBox) {
      const v = field.acroField.dict.lookup(PDFName.of("V"))
      // a /V that names no widget on-state selects nothing (the template ships one such field)
      const valid = v instanceof PDFName && field.acroField.getWidgets().some((w) => w.getOnValue() === v)
      out.checks[field.getName()] = valid ? (v as PDFName).decodeText() : null
    }
  }
  return out
}
