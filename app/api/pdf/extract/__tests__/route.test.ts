/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const extractPdfJsonMock = vi.fn()
const requireAuthenticatedUserMock = vi.fn()

vi.mock("@/lib/pdf/extract-pdf-json", () => ({
  extractPdfJson: extractPdfJsonMock,
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}))

describe("app/api/pdf/extract/route", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    extractPdfJsonMock.mockReset()
    requireAuthenticatedUserMock.mockReset()
    requireAuthenticatedUserMock.mockResolvedValue({ ok: true, userId: "11111111-1111-4111-8111-111111111111" })
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  function createRequestWithFile(fileValue: FormDataEntryValue | null): Request {
    return {
      formData: vi.fn().mockResolvedValue({
        get: vi.fn().mockImplementation((key: string) => (key === "file" ? fileValue : null)),
      }),
    } as unknown as Request
  }

  it("returns 400 when file is missing", async () => {
    const { POST } = await import("@/app/api/pdf/extract/route")
    const request = createRequestWithFile(null)

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Missing file upload. Use multipart/form-data with field 'file'.",
    })
  })

  it("returns 400 when uploaded file is not a PDF", async () => {
    const { POST } = await import("@/app/api/pdf/extract/route")
    const request = createRequestWithFile({
      name: "note.txt",
      size: 10,
      type: "text/plain",
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    } as unknown as FormDataEntryValue)

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Uploaded file must be a PDF.",
    })
  })

  it("returns 413 when uploaded file exceeds size limit", async () => {
    const { POST } = await import("@/app/api/pdf/extract/route")
    const request = createRequestWithFile({
      name: "input.pdf",
      size: 10 * 1024 * 1024 + 1,
      type: "application/pdf",
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1)),
    } as unknown as FormDataEntryValue)

    const response = await POST(request)

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      error: "Uploaded file exceeds the 10 MB limit.",
    })
    expect(extractPdfJsonMock).not.toHaveBeenCalled()
  })

  it("returns extracted JSON for uploaded PDF", async () => {
    extractPdfJsonMock.mockResolvedValue({ pageCount: 1, formFields: [] })

    const { POST } = await import("@/app/api/pdf/extract/route")
    const request = createRequestWithFile({
      name: "input.pdf",
      size: 3,
      type: "application/pdf",
      arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    } as unknown as FormDataEntryValue)

    const response = await POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { pageCount: 1, formFields: [] },
    })
    expect(extractPdfJsonMock).toHaveBeenCalledTimes(1)
  })
})
