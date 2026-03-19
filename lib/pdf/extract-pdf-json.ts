/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { PDFDocument } from "pdf-lib"
import _pdfParse from "pdf-parse"

// pdf-parse ships CJS. In some environments (jsdom, SSR) the module resolves to
// undefined or wraps the callable under .default — resolve whichever is callable.
type PdfParseFn = (buf: Buffer) => Promise<{ text: string }>
const _mod = _pdfParse as unknown
const pdfParse: PdfParseFn | null =
  typeof _mod === "function"
    ? (_mod as PdfParseFn)
    : typeof (_mod as { default?: unknown })?.default === "function"
    ? ((_mod as { default: PdfParseFn }).default)
    : null

interface ExtractPdfJsonInput {
  bytes: Uint8Array
  fileName?: string
  fileSize?: number
}

interface ExtractedField {
  name: string
  type: string
  value: string | string[] | boolean | null
}

function toIsoString(value?: Date): string | null {
  if (!value) {
    return null
  }

  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

function getFieldValue(field: unknown): ExtractedField {
  const candidate = field as {
    constructor?: { name?: string }
    getName?: () => string
    getText?: () => string | undefined
    isChecked?: () => boolean
    getSelected?: () => string[]
    getOptions?: () => string[]
    getImage?: () => unknown
  }

  const name = typeof candidate.getName === "function" ? candidate.getName() : "unknown"

  if (typeof candidate.getText === "function") {
    return {
      name,
      type: "text",
      value: candidate.getText() ?? "",
    }
  }

  if (typeof candidate.isChecked === "function") {
    return {
      name,
      type: "checkbox",
      value: candidate.isChecked(),
    }
  }

  if (typeof candidate.getSelected === "function") {
    return {
      name,
      type: "multi-select",
      value: candidate.getSelected(),
    }
  }

  if (typeof candidate.getOptions === "function") {
    return {
      name,
      type: "option",
      value: candidate.getOptions(),
    }
  }

  if (typeof candidate.getImage === "function") {
    return {
      name,
      type: "signature",
      value: null,
    }
  }

  return {
    name,
    type: candidate.constructor?.name || "unknown",
    value: null,
  }
}

export async function extractPdfJson({ bytes, fileName, fileSize }: ExtractPdfJsonInput) {
  const buffer = Buffer.from(bytes)
  const [pdfDoc, parsed] = await Promise.all([
    PDFDocument.load(bytes, { ignoreEncryption: true }),
    pdfParse ? pdfParse(buffer).catch(() => null) : Promise.resolve(null),
  ])

  const form = pdfDoc.getForm()
  const fields = form.getFields().map(getFieldValue)

  return {
    fileName: fileName ?? null,
    fileSize: fileSize ?? bytes.byteLength,
    pageCount: pdfDoc.getPageCount(),
    pageText: parsed?.text?.trim() ?? null,
    metadata: {
      title: pdfDoc.getTitle() ?? null,
      author: pdfDoc.getAuthor() ?? null,
      subject: pdfDoc.getSubject() ?? null,
      creator: pdfDoc.getCreator() ?? null,
      producer: pdfDoc.getProducer() ?? null,
      keywords: pdfDoc.getKeywords() ?? [],
      creationDate: toIsoString(pdfDoc.getCreationDate()),
      modificationDate: toIsoString(pdfDoc.getModificationDate()),
    },
    formFields: fields,
  }
}
