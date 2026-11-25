/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  PDFArray,
  PDFButton,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRef,
  PDFTextField,
} from "pdf-lib"

import type { Saca2FieldInfo } from "./inventory"
import { removeStrayTableWidgets, splitCoverageNames, splitSharedFields } from "./split-shared-fields"

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Enumerates every AcroForm field of the template. Shared by the regeneration
 * script and the inventory test so they cannot drift.
 */
export async function extractInventory(bytes: Uint8Array): Promise<Saca2FieldInfo[]> {
  const doc = await PDFDocument.load(bytes)
  splitSharedFields(doc)
  splitCoverageNames(doc) // the inventory describes the split template that is actually filled
  removeStrayTableWidgets(doc)
  const pages = doc.getPages()
  const pageIndexByRef = new Map(pages.map((p, i) => [p.ref.toString(), i]))

  // Fallback for widgets without /P: map widget ref -> page via /Annots.
  const annotPage = new Map<string, number>()
  pages.forEach((p, i) => {
    const annots = p.node.lookupMaybe(PDFName.of("Annots"), PDFArray)
    annots?.asArray().forEach((a) => {
      if (a instanceof PDFRef) annotPage.set(a.toString(), i)
    })
  })

  const entries: Array<{ info: Saca2FieldInfo; seq: number }> = []
  doc.getForm().getFields().forEach((field, seq) => {
    const type: Saca2FieldInfo["type"] | null =
      field instanceof PDFTextField ? "text"
      : field instanceof PDFCheckBox ? "checkbox"
      : field instanceof PDFButton ? "button"
      : null
    if (!type) throw new Error(`Unsupported SACA-2 field type for "${field.getName()}": ${field.constructor.name}`)

    const widgets = field.acroField.getWidgets().map((w) => {
      const pRef = w.P()
      let page = pRef ? (pageIndexByRef.get(pRef.toString()) ?? -1) : -1
      if (page < 0) {
        const ref = doc.context.getObjectRef(w.dict)
        page = ref ? (annotPage.get(ref.toString()) ?? -1) : -1
      }
      if (page < 0) throw new Error(`Cannot resolve page for a widget of "${field.getName()}"`)
      const r = w.getRectangle()
      const widget: Saca2FieldInfo["widgets"][number] = {
        page,
        rect: [round2(r.x), round2(r.y), round2(r.x + r.width), round2(r.y + r.height)],
      }
      if (type === "checkbox") {
        const ap = w.dict.lookupMaybe(PDFName.of("AP"), PDFDict)
        const n = ap?.lookupMaybe(PDFName.of("N"), PDFDict)
        const on = n?.keys().map((k) => k.decodeText()).find((k) => k !== "Off")
        if (on !== undefined) widget.onState = on
      }
      return widget
    })

    const info: Saca2FieldInfo = {
      name: field.getName(),
      type,
      pages: [...new Set(widgets.map((w) => w.page))],
      widgets,
    }
    if (field instanceof PDFTextField) {
      const maxLen = field.getMaxLength()
      if (maxLen !== undefined) info.maxLen = maxLen
    }
    entries.push({ info, seq })
  })

  const top = (e: { info: Saca2FieldInfo }) => e.info.widgets[0].rect[3]
  const left = (e: { info: Saca2FieldInfo }) => e.info.widgets[0].rect[0]
  entries.sort(
    (a, b) =>
      a.info.pages[0] - b.info.pages[0] || top(b) - top(a) || left(a) - left(b) || a.seq - b.seq,
  )
  return entries.map((e) => e.info)
}
