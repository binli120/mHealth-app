/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const requireAuthenticatedUserMock = vi.fn()
const logServerErrorMock = vi.fn()
const logServerInfoMock = vi.fn()

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: logServerErrorMock,
  logServerInfo: logServerInfoMock,
}))

const USER_ID = "00000000-0000-4000-8000-000000000001"

describe("app/api/masshealth/appeals/draft/route", () => {
  beforeEach(() => {
    vi.resetModules()
    requireAuthenticatedUserMock.mockReset()
    logServerErrorMock.mockReset()
    logServerInfoMock.mockReset()
    requireAuthenticatedUserMock.mockResolvedValue({ ok: true, userId: USER_ID })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", letter_text: "Appeal draft" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps JSON draft requests compatible", async () => {
    const { POST } = await import("@/app/api/masshealth/appeals/draft/route")
    const request = new Request("http://localhost/api/masshealth/appeals/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicant_name: "Maria Santos", top_k: 5 }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "user-id": USER_ID,
    })
    expect(init?.body).toBe(JSON.stringify({ applicant_name: "Maria Santos", top_k: 5 }))
  })

  it("forwards multipart draft requests with the PDF file and form fields", async () => {
    const { POST } = await import("@/app/api/masshealth/appeals/draft/route")
    const formData = new FormData()
    const pdf = new File(["%PDF-1.7"], "denial-letter.pdf", { type: "application/pdf" })
    formData.append("file", pdf)
    formData.append("applicant_name", "Maria Santos")
    formData.append("applicant_id", "MH-2026-004821")
    formData.append("facts", JSON.stringify({ "Monthly income": "$1,150 from part-time work" }))
    formData.append("requested_relief", "Approval of MassHealth Standard coverage")
    formData.append("top_k", "5")

    const request = {
      headers: new Headers({ "Content-Type": "multipart/form-data; boundary=mock-boundary" }),
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(init?.headers).toMatchObject({ "user-id": USER_ID })
    expect(init?.headers).not.toMatchObject({ "Content-Type": expect.any(String) })
    expect(init?.body).toBeInstanceOf(FormData)

    const forwardedFormData = init?.body as FormData
    expect(forwardedFormData.get("applicant_name")).toBe("Maria Santos")
    expect(forwardedFormData.get("applicant_id")).toBe("MH-2026-004821")
    expect(forwardedFormData.get("requested_relief")).toBe("Approval of MassHealth Standard coverage")
    expect(forwardedFormData.get("top_k")).toBe("5")
    expect(forwardedFormData.get("facts")).toBe(JSON.stringify({ "Monthly income": "$1,150 from part-time work" }))
    expect(forwardedFormData.get("file")).toBeInstanceOf(File)
    expect((forwardedFormData.get("file") as File).name).toBe("denial-letter.pdf")
  })
})
