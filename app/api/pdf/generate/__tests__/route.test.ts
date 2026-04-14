/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const generateMassHealthAcaPdfMock = vi.fn()
const requireAuthenticatedUserMock = vi.fn()

vi.mock("@/lib/pdf/masshealth-aca", () => ({
  generateMassHealthAcaPdf: generateMassHealthAcaPdfMock,
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}))

describe("app/api/pdf/generate/route", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    generateMassHealthAcaPdfMock.mockReset()
    requireAuthenticatedUserMock.mockReset()
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      userId: "11111111-1111-4111-8111-111111111111",
    })
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("exports node runtime", async () => {
    const route = await import("@/app/api/pdf/generate/route")

    expect(route.runtime).toBe("nodejs")
  })

  it("returns generated PDF for valid JSON payload", async () => {
    generateMassHealthAcaPdfMock.mockResolvedValue(new Uint8Array([9, 8, 7]))

    const { POST } = await import("@/app/api/pdf/generate/route")

    const request = new Request("http://localhost/api/pdf/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        formType: "aca-3-0325",
        filename: "custom file name.pdf",
        data: { firstName: "Jane", lastName: "Doe" },
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toContain("custom-file-name.pdf")

    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(bytes)).toEqual([9, 8, 7])
  })

  it("returns 422 for invalid JSON payload", async () => {
    const { POST } = await import("@/app/api/pdf/generate/route")

    const request = new Request("http://localhost/api/pdf/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ formType: "aca-3-0325" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid PDF generation payload.",
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
