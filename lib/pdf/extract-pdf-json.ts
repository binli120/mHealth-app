/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { PDFDocument } from "pdf-lib"

// pdf-parse ships CJS only, and pdfjs-dist (a pdf-parse dependency) accesses
// DOMMatrix / process.getBuiltinModule at module-eval time — importing it at
// module scope crashes the Turbopack build worker on Node < 22. Load it
// lazily inside the exported function via a dynamic import() with a literal
// specifier: it's still lazy (not evaluated until called, same as the old
// createRequire trick), but — unlike createRequire(...).require(name), which
// routes through a renamed variable Next's static output-file tracer can't
// recognize as a require call — a literal `import("pdf-parse")` IS
// statically traceable, so the standalone build correctly discovers and
// copies pdf-parse's full runtime dependency tree (pdf-parse + pdfjs-dist;
// see outputFileTracingIncludes in next.config.mjs for why pdf-parse still
// needs a manual assist there despite this).
// Do NOT switch this to a static top-level import or a dynamic import with a
// non-literal/templated specifier — both defeat one of the two properties above.
type PdfParseFn = (buf: Buffer) => Promise<{ text: string }>

// pdf-parse's CJS entry loads @napi-rs/canvas to polyfill DOMMatrix/ImageData/
// Path2D for pdfjs-dist (needed outside a browser) — but that inner require is
// itself not traceable by Next's output tracer (same blind spot as above, one
// level deeper, inside a package we don't control), so the native binary
// silently never reaches the standalone build and pdfjs-dist throws
// `ReferenceError: DOMMatrix is not defined` in prod. Chasing @napi-rs/canvas's
// per-platform native binary through manual tracing globs turned out to be a
// combinatorial dead end (see PR discussion) — we only need pdfjs-dist to not
// throw while it reads text content, not real canvas rendering, so a minimal
// self-contained stub is the more robust fix. Idempotent — safe to call
// per-request; does nothing once the globals already exist.
function ensurePdfjsNodePolyfills(): void {
  const g = globalThis as Record<string, unknown>
  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = class DOMMatrix {
      a = 1
      b = 0
      c = 0
      d = 1
      e = 0
      f = 0
      constructor(_init?: unknown) {}
      multiplySelf(): DOMMatrix {
        return this
      }
      translateSelf(): DOMMatrix {
        return this
      }
      scaleSelf(): DOMMatrix {
        return this
      }
      invertSelf(): DOMMatrix {
        return this
      }
    }
  }
  if (typeof g.ImageData === "undefined") {
    g.ImageData = class ImageData {
      width: number
      height: number
      constructor(width: number, height: number) {
        this.width = width
        this.height = height
      }
    }
  }
  if (typeof g.Path2D === "undefined") {
    g.Path2D = class Path2D {}
  }
}

async function loadPdfParse(): Promise<PdfParseFn | null> {
  try {
    ensurePdfjsNodePolyfills()
    const mod = (await import("pdf-parse")) as Record<string, unknown> & { default?: unknown }
    const defaultExport = mod.default

    // pdf-parse < v2: default export is a function
    if (typeof defaultExport === "function") return defaultExport as PdfParseFn

    // pdf-parse v2.x: exports { PDFParse } class
    // new PDFParse({ data: Uint8Array, verbosity: 0 }).getText() → { text: string }
    // Node's CJS/ESM interop may surface named exports on the namespace itself
    // or nested under .default depending on how cjs-module-lexer parsed it —
    // check both.
    type PDFParseV2Ctor = new (opts: { data: Uint8Array; verbosity: number }) => {
      getText(): Promise<{ text: string }>
    }
    const PDFParseClass = (mod.PDFParse ??
      (defaultExport as Record<string, unknown> | undefined)?.PDFParse) as PDFParseV2Ctor | undefined
    if (typeof PDFParseClass === "function") {
      return async (buf: Buffer) => {
        const parser = new PDFParseClass({ data: new Uint8Array(buf), verbosity: 0 })
        return parser.getText()
      }
    }

    return null
  } catch {
    return null
  }
}

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
  const [pdfDoc, pdfParse] = await Promise.all([
    PDFDocument.load(bytes, { ignoreEncryption: true }),
    loadPdfParse(),
  ])
  const parsed = pdfParse ? await pdfParse(buffer).catch(() => null) : null

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
