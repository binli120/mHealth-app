/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/mobile-upload-session", () => ({
  getUploadSessionByToken: vi.fn(),
  completeUploadSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/db/documents", () => ({
  insertDocument: vi.fn(),
  updateDocumentValidation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/uploads/document-artifacts", () => ({
  createAndUploadDocumentArtifacts: vi.fn().mockResolvedValue({
    thumbnailPath: null,
    pdfPath: null,
  }),
}))

vi.mock("@/lib/masshealth/document-validation-workflow", () => ({
  validateUploadedDocument: vi.fn(async ({ document }) => ({
    ...document,
    documentStatus: document.documentStatus ?? "uploaded",
    validationStatus: document.validationStatus ?? "valid",
    analysisDocumentType: document.analysisDocumentType ?? "driver_license",
    validationError: document.validationError ?? null,
    validationSummary: document.validationSummary ?? null,
    validationCertificate: document.validationCertificate ?? null,
  })),
}))

vi.mock("@/lib/supabase/storage", () => ({
  buildStoragePath: vi.fn((_userId: string, _applicationId: string, documentId: string, name: string) =>
    `uploads/${documentId}/${name}`,
  ),
  uploadDocumentToStorage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

import { GET, POST } from "@/app/api/upload/mobile/[token]/route"
import {
  completeUploadSession,
  getUploadSessionByToken,
} from "@/lib/db/mobile-upload-session"
import { insertDocument } from "@/lib/db/documents"
import { uploadDocumentToStorage } from "@/lib/supabase/storage"

const TOKEN = "mobile-token"
const USER_ID = "11111111-1111-4111-8111-111111111111"
const APPLICATION_ID = "22222222-2222-4222-8222-222222222222"
const JPEG_MAGIC = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
])

class TestFile extends File {
  async arrayBuffer() {
    return JPEG_MAGIC.buffer.slice(JPEG_MAGIC.byteOffset, JPEG_MAGIC.byteOffset + JPEG_MAGIC.byteLength)
  }
}

function makeSession(overrides: Partial<Awaited<ReturnType<typeof getUploadSessionByToken>>> = {}) {
  return {
    id: "session-id",
    token: TOKEN,
    userId: USER_ID,
    applicationId: APPLICATION_ID,
    documentType: "proof_of_identity",
    requiredDocumentLabel: "MA Driver's License",
    status: "pending",
    documentId: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    completedAt: null,
    ...overrides,
  }
}

function makeContext() {
  return { params: Promise.resolve({ token: TOKEN }) }
}

function makeRequest(formData: FormData) {
  const request = new Request(`http://localhost/api/upload/mobile/${TOKEN}`, { method: "POST" })
  vi.spyOn(request, "formData").mockResolvedValue(formData)
  return request
}

function makeJpeg(name: string) {
  return new TestFile([JPEG_MAGIC], name, { type: "image/jpeg" })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.mocked(getUploadSessionByToken).mockResolvedValue(makeSession() as never)
  vi.mocked(insertDocument).mockImplementation(async (payload) => payload as never)
})

describe("POST /api/upload/mobile/[token]", () => {
  it("rejects a single-file upload for a driver's license session", async () => {
    const formData = new FormData()
    formData.set("file", makeJpeg("license-front.jpg"))

    const response = await POST(makeRequest(formData), makeContext())
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/front and back/i)
    expect(uploadDocumentToStorage).not.toHaveBeenCalled()
  })

  it("calls the analysis API before storing driver's license photos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          valid_ma_driver_license: true,
          issuing_state: "MA",
          document_type: "driver_license",
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const formData = new FormData()
    formData.set("file_front", makeJpeg("front.jpg"))
    formData.set("file_back", makeJpeg("back.jpg"))

    const response = await POST(makeRequest(formData), makeContext())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(init.body).toBeInstanceOf(FormData)
    expect(uploadDocumentToStorage).toHaveBeenCalledTimes(2)
    expect(insertDocument).toHaveBeenCalledTimes(2)
    expect(completeUploadSession).toHaveBeenCalledWith(TOKEN, expect.any(String))
  })

  it("rejects invalid license analysis results without storing files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            valid: true,
            issuing_state: "RI",
            document_type: "driver_license",
            reason: "License is not issued by Massachusetts.",
          }),
      }),
    )

    const formData = new FormData()
    formData.set("file_front", makeJpeg("front.jpg"))
    formData.set("file_back", makeJpeg("back.jpg"))

    const response = await POST(makeRequest(formData), makeContext())
    const json = await response.json()

    expect(response.status).toBe(422)
    expect(json.error).toMatch(/Massachusetts/i)
    expect(uploadDocumentToStorage).not.toHaveBeenCalled()
  })
})

// ── expiresAt enforcement ────────────────────────────────────────────────────

describe("POST /api/upload/mobile/[token] — expiresAt enforcement", () => {
  it("returns 410 when expiresAt has passed even if status is still 'pending'", async () => {
    const PAST = new Date(Date.now() - 60_000).toISOString()
    vi.mocked(getUploadSessionByToken).mockResolvedValueOnce(
      makeSession({
        id: "sess-exp",
        documentType: "generic",
        requiredDocumentLabel: null,
        status: "pending",   // status NOT updated yet by cron
        expiresAt: PAST,     // expired by timestamp
        createdAt: PAST,
      }) as never,
    )

    const formData = new FormData()
    formData.set("file", makeJpeg("test.jpg"))

    const res = await POST(makeRequest(formData), makeContext())
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("This upload link has expired. Please request a new QR code.")
  })

  it("GET returns 410 when expiresAt has passed even if status is still 'pending'", async () => {
    const PAST = new Date(Date.now() - 60_000).toISOString()
    vi.mocked(getUploadSessionByToken).mockResolvedValueOnce(
      makeSession({ status: "pending", expiresAt: PAST }) as never,
    )
    const res = await GET(
      new Request(`http://localhost/api/upload/mobile/${TOKEN}`),
      makeContext(),
    )
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })
})
