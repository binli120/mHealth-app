import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/db/documents", () => ({
  insertDocument: vi.fn(),
  listDocumentsByApplication: vi.fn(),
  userCanAccessApplication: vi.fn(),
}))

vi.mock("@/lib/supabase/storage", () => ({
  buildStoragePath: vi.fn(() => "user/app/doc/test.pdf"),
  deleteFromStorage: vi.fn().mockResolvedValue(undefined),
  getSignedDocumentUrl: vi.fn().mockResolvedValue("https://signed.example/doc"),
  getSignedDocumentUrls: vi.fn().mockResolvedValue({}),
  uploadDocumentToStorage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

import { POST } from "@/app/api/applications/[applicationId]/documents/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { insertDocument, userCanAccessApplication } from "@/lib/db/documents"
import { deleteFromStorage, uploadDocumentToStorage } from "@/lib/supabase/storage"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const APPLICATION_ID = "22222222-2222-4222-8222-222222222222"

// %PDF magic bytes followed by padding — satisfies the magic-bytes check in validateUpload.
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

class TestFile extends File {
  async arrayBuffer() {
    return PDF_MAGIC.buffer.slice(PDF_MAGIC.byteOffset, PDF_MAGIC.byteOffset + PDF_MAGIC.byteLength)
  }
}

function makeRequest() {
  const formData = new FormData()
  const file = new TestFile([PDF_MAGIC], "test.pdf", { type: "application/pdf" })
  formData.set("file", file)
  const request = new Request(`http://localhost/api/applications/${APPLICATION_ID}/documents`, {
    method: "POST",
  })
  vi.spyOn(request, "formData").mockResolvedValue(formData)
  return request
}

function makeContext() {
  return { params: Promise.resolve({ applicationId: APPLICATION_ID }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
})

describe("POST /api/applications/[applicationId]/documents", () => {
  it("returns 403 before upload when the user does not own the application", async () => {
    vi.mocked(userCanAccessApplication).mockResolvedValue(false)

    const response = await POST(makeRequest(), makeContext())
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/not accessible/i)
    expect(uploadDocumentToStorage).not.toHaveBeenCalled()
  })

  it("cleans up the uploaded file if the guarded insert rejects access", async () => {
    vi.mocked(userCanAccessApplication).mockResolvedValue(true)
    vi.mocked(insertDocument).mockResolvedValue(null)

    const response = await POST(makeRequest(), makeContext())
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toMatch(/not accessible/i)
    expect(uploadDocumentToStorage).toHaveBeenCalledOnce()
    expect(deleteFromStorage).toHaveBeenCalledOnce()
  })
})
