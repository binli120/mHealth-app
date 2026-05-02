/**
 * Unit tests for lib/uploads/validate.ts
 * @author Bin Lee
 */

import { describe, it, expect } from "vitest"
import { validateUpload, type UploadCategory } from "@/lib/uploads/validate"

// ── Helpers ───────────────────────────────────────────────────────────────────

const MB = 1024 * 1024

/** Build a File with exactly the given bytes as content. */
function makeFile(bytes: number[], mimeType: string, name = "test"): File {
  const buf = Buffer.alloc(16, 0)
  bytes.forEach((b, i) => { buf[i] = b })
  return new File([buf], name, { type: mimeType })
}

/** Make a File of exactly `sizeBytes` (body is zeros, first bytes set to `header`). */
function makeFileOfSize(sizeBytes: number, mimeType: string, header: number[]): File {
  const buf = Buffer.alloc(sizeBytes, 0)
  header.forEach((b, i) => { buf[i] = b })
  return new File([buf], "file", { type: mimeType })
}

// ── Magic-byte helpers ────────────────────────────────────────────────────────

const JPEG   = [0xFF, 0xD8, 0xFF, 0xE0]
const PNG    = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
const WEBP   = [0x52, 0x49, 0x46, 0x46, 0,0,0,0, 0x57, 0x45, 0x42, 0x50]
const GIF    = [0x47, 0x49, 0x46, 0x38]       // GIF8
const HEIC   = [0,0,0,0, 0x66,0x74,0x79,0x70, 0x68,0x65,0x69,0x63] // ....ftyp heic
const PDF    = [0x25, 0x50, 0x44, 0x46]        // %PDF
const WEBM   = [0x1A, 0x45, 0xDF, 0xA3]
const OGG    = [0x4F, 0x67, 0x67, 0x53]        // OggS
const MP3    = [0x49, 0x44, 0x33]              // ID3
const MP3_SYNC = [0xFF, 0xFB]                  // MPEG sync
const M4A    = [0,0,0,0, 0x66,0x74,0x79,0x70, 0x4D,0x34,0x41,0x20] // ....ftypM4A
const WAV    = [0x52,0x49,0x46,0x46, 0,0,0,0, 0x57,0x41,0x56,0x45]  // RIFF....WAVE
const AAC_ADTS = [0xFF, 0xF1]                  // ADTS sync
const OLE2   = [0xD0, 0xCF, 0x11, 0xE0]
const ZIP_PK = [0x50, 0x4B, 0x03, 0x04]

// ── Basic validation ──────────────────────────────────────────────────────────

describe("validateUpload — basic checks", () => {
  it("rejects an empty file", async () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" })
    const result = await validateUpload(file, "avatar")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it("rejects a file that exceeds the size limit", async () => {
    const file = makeFileOfSize(6 * MB, "image/jpeg", JPEG)
    const result = await validateUpload(file, "avatar") // 5 MB limit
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(413)
      expect(result.error).toMatch(/exceeds/)
    }
  })

  it("rejects a MIME type not in the category allowlist", async () => {
    const file = makeFile(JPEG, "image/tiff")
    const result = await validateUpload(file, "avatar")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(415)
  })

  it("rejects a file whose magic bytes do not match the declared MIME type", async () => {
    // PNG bytes but claims to be JPEG
    const file = makeFile(PNG, "image/jpeg")
    const result = await validateUpload(file, "avatar")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(415)
      expect(result.error).toMatch(/does not match/)
    }
  })

  it("strips charset parameters from the declared MIME type", async () => {
    const buf = Buffer.alloc(16, 0x61) // all 'a' bytes
    const file = new File([buf], "a.txt", { type: "text/plain; charset=utf-8" })
    const result = await validateUpload(file, "dm-file")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.mimeType).toBe("text/plain")
  })
})

// ── Image formats ─────────────────────────────────────────────────────────────

describe("validateUpload — image/jpeg", () => {
  it("accepts a valid JPEG", async () => {
    const result = await validateUpload(makeFile(JPEG, "image/jpeg"), "avatar")
    expect(result.ok).toBe(true)
  })
  it("rejects JPEG magic bytes under wrong MIME", async () => {
    const result = await validateUpload(makeFile(JPEG, "image/png"), "document")
    expect(result.ok).toBe(false)
  })
})

describe("validateUpload — image/png", () => {
  it("accepts a valid PNG", async () => {
    const result = await validateUpload(makeFile(PNG, "image/png"), "avatar")
    expect(result.ok).toBe(true)
  })
})

describe("validateUpload — image/webp", () => {
  it("accepts a valid WebP", async () => {
    const result = await validateUpload(makeFile(WEBP, "image/webp"), "avatar")
    expect(result.ok).toBe(true)
  })
})

describe("validateUpload — image/gif", () => {
  it("accepts a valid GIF", async () => {
    const result = await validateUpload(makeFile(GIF, "image/gif"), "avatar")
    expect(result.ok).toBe(true)
  })
  it("rejects GIF for the document category (not in allowlist)", async () => {
    const result = await validateUpload(makeFile(GIF, "image/gif"), "document")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(415)
  })
})

describe("validateUpload — image/heic", () => {
  it("accepts a valid HEIC", async () => {
    const result = await validateUpload(makeFile(HEIC, "image/heic"), "document")
    expect(result.ok).toBe(true)
  })
  it("rejects HEIC for the vision category (not in allowlist)", async () => {
    const result = await validateUpload(makeFile(HEIC, "image/heic"), "vision")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(415)
  })
})

// ── PDF ───────────────────────────────────────────────────────────────────────

describe("validateUpload — application/pdf", () => {
  it("accepts a valid PDF", async () => {
    const result = await validateUpload(makeFile(PDF, "application/pdf"), "document")
    expect(result.ok).toBe(true)
  })
  it("accepts PDF in the pdf-only category", async () => {
    const result = await validateUpload(makeFile(PDF, "application/pdf"), "pdf")
    expect(result.ok).toBe(true)
  })
  it("rejects non-PDF under pdf category", async () => {
    const result = await validateUpload(makeFile(JPEG, "image/jpeg"), "pdf")
    expect(result.ok).toBe(false)
  })
  it("rejects PDF magic bytes declared as image/jpeg", async () => {
    const result = await validateUpload(makeFile(PDF, "image/jpeg"), "document")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/does not match/)
  })
})

// ── Audio ─────────────────────────────────────────────────────────────────────

describe("validateUpload — audio", () => {
  it("accepts audio/webm (EBML)", async () => {
    const result = await validateUpload(makeFile(WEBM, "audio/webm"), "dm-voice")
    expect(result.ok).toBe(true)
  })
  it("accepts audio/ogg (OggS)", async () => {
    const result = await validateUpload(makeFile(OGG, "audio/ogg"), "dm-voice")
    expect(result.ok).toBe(true)
  })
  it("accepts audio/mpeg with ID3 header", async () => {
    const result = await validateUpload(makeFile(MP3, "audio/mpeg"), "dm-voice")
    expect(result.ok).toBe(true)
  })
  it("accepts audio/mpeg with MPEG sync word", async () => {
    const result = await validateUpload(makeFile(MP3_SYNC, "audio/mpeg"), "dm-voice")
    expect(result.ok).toBe(true)
  })
  it("accepts audio/mp4 (M4A ftyp brand)", async () => {
    const result = await validateUpload(makeFile(M4A, "audio/mp4"), "dm-voice")
    expect(result.ok).toBe(true)
  })
  it("accepts audio/wav (RIFF/WAVE)", async () => {
    const result = await validateUpload(makeFile(WAV, "audio/wav"), "dm-voice")
    expect(result.ok).toBe(true)
  })
  it("accepts audio/wav aliased as audio/x-wav", async () => {
    const result = await validateUpload(makeFile(WAV, "audio/x-wav"), "dm-voice")
    expect(result.ok).toBe(true)
  })
  it("accepts audio/aac (ADTS sync word)", async () => {
    const result = await validateUpload(makeFile(AAC_ADTS, "audio/aac"), "dm-voice")
    expect(result.ok).toBe(true)
  })
  it("rejects audio in a non-audio category", async () => {
    const result = await validateUpload(makeFile(WEBM, "audio/webm"), "document")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(415)
  })
})

// ── Office documents ──────────────────────────────────────────────────────────

describe("validateUpload — office files (dm-file)", () => {
  it("accepts application/msword (OLE2)", async () => {
    const result = await validateUpload(makeFile(OLE2, "application/msword"), "dm-file")
    expect(result.ok).toBe(true)
  })
  it("accepts .docx (ZIP/PK header)", async () => {
    const result = await validateUpload(
      makeFile(ZIP_PK, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      "dm-file",
    )
    expect(result.ok).toBe(true)
  })
  it("accepts .xlsx (ZIP/PK header)", async () => {
    const result = await validateUpload(
      makeFile(ZIP_PK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      "dm-file",
    )
    expect(result.ok).toBe(true)
  })
  it("rejects an image file as a dm-file", async () => {
    const result = await validateUpload(makeFile(JPEG, "image/jpeg"), "dm-file")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(415)
  })
})

// ── Spoofing scenarios ────────────────────────────────────────────────────────

describe("validateUpload — MIME spoofing", () => {
  it("rejects a PDF disguised as image/jpeg", async () => {
    const result = await validateUpload(makeFile(PDF, "image/jpeg"), "avatar")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/does not match/)
  })

  it("rejects a ZIP archive disguised as application/pdf", async () => {
    const result = await validateUpload(makeFile(ZIP_PK, "application/pdf"), "document")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/does not match/)
  })

  it("rejects audio/webm bytes disguised as image/png", async () => {
    const result = await validateUpload(makeFile(WEBM, "image/png"), "dm-image")
    expect(result.ok).toBe(false)
  })

  it("rejects JPEG bytes declared as application/pdf (even if size / type pass)", async () => {
    const result = await validateUpload(makeFile(JPEG, "application/pdf"), "document")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/does not match/)
  })
})

// ── Category size limits ──────────────────────────────────────────────────────

describe("validateUpload — size limits by category", () => {
  const cases: Array<[UploadCategory, number, number[], string]> = [
    ["document",      10 * MB, JPEG,  "image/jpeg"],
    ["avatar",         5 * MB, JPEG,  "image/jpeg"],
    ["vision",        10 * MB, JPEG,  "image/jpeg"],
    ["pdf",           10 * MB, PDF,   "application/pdf"],
    ["dm-voice",      10 * MB, WEBM,  "audio/webm"],
    ["dm-image",      20 * MB, JPEG,  "image/jpeg"],
    ["dm-file",       25 * MB, PDF,   "application/pdf"],
    ["session-voice", 10 * MB, WEBM,  "audio/webm"],
  ]

  for (const [category, limit, header, mime] of cases) {
    it(`${category}: accepts a file exactly at the limit (${limit / MB} MB)`, async () => {
      const file = makeFileOfSize(limit, mime, header)
      const result = await validateUpload(file, category)
      expect(result.ok).toBe(true)
    })

    it(`${category}: rejects a file 1 byte over the limit`, async () => {
      const file = makeFileOfSize(limit + 1, mime, header)
      const result = await validateUpload(file, category)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(413)
    })
  }
})
