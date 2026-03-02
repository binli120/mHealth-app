import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const generateMassHealthAcaPdfMock = vi.fn()

vi.mock("@/lib/pdf/masshealth-aca", () => ({
  generateMassHealthAcaPdf: generateMassHealthAcaPdfMock,
}))

describe("app/api/forms/aca-3-0325/fill/route", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    generateMassHealthAcaPdfMock.mockReset()
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("exports node runtime", async () => {
    const route = await import("@/app/api/forms/aca-3-0325/fill/route")

    expect(route.runtime).toBe("nodejs")
  })

  it("returns a filled PDF response for valid payload", async () => {
    generateMassHealthAcaPdfMock.mockResolvedValue(new Uint8Array([1, 2, 3]))

    const { POST } = await import("@/app/api/forms/aca-3-0325/fill/route")

    const request = new Request("http://localhost/api/forms/aca-3-0325/fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: "Jane", lastName: "Doe" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("content-disposition")).toContain("ACA-3-0325-filled-")

    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(bytes)).toEqual([1, 2, 3])
  })

  it("returns 400 when payload is invalid", async () => {
    const { POST } = await import("@/app/api/forms/aca-3-0325/fill/route")

    const request = new Request("http://localhost/api/forms/aca-3-0325/fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: "Only" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Unable to generate filled ACA PDF" })
    expect(generateMassHealthAcaPdfMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it("returns 400 when PDF generation fails", async () => {
    generateMassHealthAcaPdfMock.mockRejectedValue(new Error("template unavailable"))

    const { POST } = await import("@/app/api/forms/aca-3-0325/fill/route")

    const request = new Request("http://localhost/api/forms/aca-3-0325/fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: "Jane", lastName: "Doe" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Unable to generate filled ACA PDF" })
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
