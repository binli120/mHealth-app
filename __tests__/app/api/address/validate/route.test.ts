import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const requireAuthenticatedUserMock = vi.fn()

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}))

describe("app/api/address/validate/route", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    requireAuthenticatedUserMock.mockReset()
    requireAuthenticatedUserMock.mockResolvedValue({ ok: true, userId: "11111111-1111-4111-8111-111111111111" })
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns 400 for invalid payload", async () => {
    const { POST } = await import("@/app/api/address/validate/route")

    const request = new Request("http://localhost/api/address/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streetAddress: "1 Main St" }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      valid: false,
      error: "Invalid address payload.",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 502 when geocoder service fails", async () => {
    fetchMock.mockResolvedValue(new Response("unavailable", { status: 503 }))

    const { POST } = await import("@/app/api/address/validate/route")

    const request = new Request("http://localhost/api/address/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streetAddress: "1 Main St",
        city: "Boston",
        state: "MA",
        zipCode: "02108",
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      valid: false,
      error: "Address lookup service is unavailable.",
    })
  })

  it("returns valid=false when no matches are found", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const { POST } = await import("@/app/api/address/validate/route")

    const request = new Request("http://localhost/api/address/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streetAddress: "1 Main St",
        city: "Boston",
        state: "MA",
        zipCode: "02108",
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      valid: false,
      message: "No matching address found. Please check the address details.",
    })
  })

  it("returns normalized suggestion for a valid match", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: "42.358",
            lon: "-71.058",
            display_name: "1 Main St, Boston, MA 02108, USA",
            address: {
              house_number: "1",
              road: "Main St",
              city: "Boston",
              county: "Suffolk County",
              postcode: "02108-1234",
              "ISO3166-2-lvl4": "US-MA",
            },
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )

    const { POST } = await import("@/app/api/address/validate/route")

    const request = new Request("http://localhost/api/address/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        streetAddress: "1 Main St",
        city: "Boston",
        state: "MA",
        zipCode: "02108",
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      valid: true,
      message: "Address validated successfully.",
      suggestion: {
        streetAddress: "1 Main St",
        city: "Boston",
        state: "MA",
        zipCode: "02108",
        county: "Suffolk County",
        displayName: "1 Main St, Boston, MA 02108, USA",
        latitude: "42.358",
        longitude: "-71.058",
      },
    })
  })
})
