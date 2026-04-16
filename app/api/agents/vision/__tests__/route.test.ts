/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for POST /api/agents/vision.
 *
 * Strategy: jsdom cannot parse FormData from a Request body, so we mock
 * request.formData() directly via a partial request object. Auth, PDF
 * extraction, and global fetch are also mocked.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock declarations ─────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
  logServerInfo: vi.fn(),
}))

vi.mock("@/lib/pdf/extract-pdf-json", () => ({
  extractPdfJson: vi.fn(),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { POST } from "@/app/api/agents/vision/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { extractPdfJson } from "@/lib/pdf/extract-pdf-json"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff"
const MAX_BYTES = 10 * 1024 * 1024 // matches MAX_DOCUMENT_UPLOAD_BYTES

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal File-like object with a working arrayBuffer().
 *
 * jsdom does NOT implement Blob/File.arrayBuffer(), so we use a plain object
 * with the four properties the vision route actually reads:
 *   .size, .type, .name, .arrayBuffer()
 */
function makeFileLike(options: {
  name: string
  type: string
  size?: number
}): File {
  const bytes = new TextEncoder().encode("a".repeat(Math.min(options.size ?? 100, 200)))
  return {
    name: options.name,
    type: options.type,
    size: options.size ?? bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes.buffer as ArrayBuffer),
  } as unknown as File
}

/**
 * Create a mock Request whose `formData()` resolves to a FormData-like object
 * containing `file`. Bypasses jsdom's inability to parse multipart bodies.
 */
function makeFormRequest(file: File | null): Request {
  const formDataLike = {
    get: (_key: string) => file,
  }
  return {
    formData: () => Promise.resolve(formDataLike),
    headers: new Headers({ "content-type": "multipart/form-data" }),
  } as unknown as Request
}

function makeEmptyRequest(): Request {
  const formDataLike = {
    get: (_key: string) => null,
  }
  return {
    formData: () => Promise.resolve(formDataLike),
    headers: new Headers({ "content-type": "multipart/form-data" }),
  } as unknown as Request
}

const PDF_FILE = makeFileLike({ name: "denial-letter.pdf", type: "application/pdf" })
const JPEG_FILE = makeFileLike({ name: "denial.jpeg", type: "image/jpeg" })
const PNG_FILE = makeFileLike({ name: "denial.png", type: "image/png" })
const EXCEL_FILE = makeFileLike({
  name: "spreadsheet.xlsx",
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
})

// Oversized file (11 MB > 10 MB limit)
const BIG_PDF = makeFileLike({ name: "big.pdf", type: "application/pdf", size: MAX_BYTES + 1 })

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  vi.mocked(extractPdfJson).mockResolvedValue({
    pageText: "You have been denied MassHealth coverage.",
    pageCount: 1,
    formFields: [],
    metadata: { title: "Denial Notice", subject: "" },
  } as never)
  // Default: Ollama vision returns empty string (graceful degradation baseline)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ message: { content: "" } }), { status: 200 }),
  ))
})

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("POST /api/agents/vision — auth", () => {
  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)

    const response = await POST(makeFormRequest(PDF_FILE))
    expect(response.status).toBe(401)
  })
})

// ── File validation ───────────────────────────────────────────────────────────

describe("POST /api/agents/vision — file validation", () => {
  it("returns 400 when no file is provided", async () => {
    const response = await POST(makeEmptyRequest())
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it("returns 413 when the file exceeds the size limit", async () => {
    const response = await POST(makeFormRequest(BIG_PDF))
    const json = await response.json()
    expect(response.status).toBe(413)
    expect(json.ok).toBe(false)
  })

  it("returns 400 for an unsupported MIME type", async () => {
    const response = await POST(makeFormRequest(EXCEL_FILE))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.ok).toBe(false)
  })
})

// ── PDF extraction ────────────────────────────────────────────────────────────

describe("POST /api/agents/vision — PDF extraction", () => {
  it("returns 200 with extractedText for a valid PDF", async () => {
    const response = await POST(makeFormRequest(PDF_FILE))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.extractedText).toContain("denied")
  })

  it("includes the document title in the extracted text", async () => {
    const response = await POST(makeFormRequest(PDF_FILE))
    const json = await response.json()
    expect(json.extractedText).toContain("Denial Notice")
  })

  it("returns ok:true with empty extractedText when PDF parsing throws", async () => {
    vi.mocked(extractPdfJson).mockRejectedValue(new Error("Corrupt PDF"))
    const response = await POST(makeFormRequest(PDF_FILE))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.extractedText).toBe("")
  })
})

// ── Image (vision model) extraction ──────────────────────────────────────────

describe("POST /api/agents/vision — image extraction", () => {
  it("returns 200 with extractedText from the vision model response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ message: { content: "Your MassHealth application was denied." } }),
        { status: 200 },
      ),
    ))

    const response = await POST(makeFormRequest(JPEG_FILE))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.extractedText).toContain("denied")
  })

  it("returns ok:true with empty extractedText when Ollama vision is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")))

    const response = await POST(makeFormRequest(JPEG_FILE))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.extractedText).toBe("")
  })

  it("accepts PNG files in addition to JPEG", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "Denial text" } }), { status: 200 }),
    ))

    const response = await POST(makeFormRequest(PNG_FILE))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
  })

  it("does NOT call extractPdfJson for image files", async () => {
    await POST(makeFormRequest(JPEG_FILE))
    expect(extractPdfJson).not.toHaveBeenCalled()
  })
})
