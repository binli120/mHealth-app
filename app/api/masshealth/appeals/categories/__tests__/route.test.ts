/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/masshealth/appeals/categories/route"
import { FALLBACK_APPEAL_CATEGORIES } from "@/lib/masshealth/appeal-categories"

const {
  requireAuthenticatedUserMock,
  logServerErrorMock,
  logServerInfoMock,
} = vi.hoisted(() => ({
  requireAuthenticatedUserMock: vi.fn(),
  logServerErrorMock: vi.fn(),
  logServerInfoMock: vi.fn(),
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: logServerErrorMock,
  logServerInfo: logServerInfoMock,
}))

const USER_ID = "00000000-0000-4000-8000-000000000001"

function makeRequest() {
  return new Request("http://localhost/api/masshealth/appeals/categories")
}

describe("GET /api/masshealth/appeals/categories", () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({ ok: true, userId: USER_ID })
    logServerErrorMock.mockReset()
    logServerInfoMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns deterministic fallback categories when the analysis service is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("analysis service down")))

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      degraded: true,
      warning: "Using built-in appeal categories while the analysis service is unavailable.",
      categories: FALLBACK_APPEAL_CATEGORIES,
    })
    expect(logServerErrorMock).toHaveBeenCalledWith(
      "masshealth.appeals.categories.error",
      expect.any(Error),
      expect.any(Object),
    )
  })

  it("returns fallback categories instead of surfacing upstream 5xx errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.degraded).toBe(true)
    expect(body.categories).toEqual(FALLBACK_APPEAL_CATEGORIES)
  })

  it("proxies healthy analysis-service categories unchanged", async () => {
    const upstreamCategories = [
      {
        code: "custom_category",
        label: "Custom category",
        description: "Category returned by the live analysis service.",
      },
    ]
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(upstreamCategories), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(upstreamCategories)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/masshealth/appeals/categories"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "user-id": USER_ID }),
      }),
    )
  })

  it("does not call the analysis service when auth fails", async () => {
    requireAuthenticatedUserMock.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    })
    vi.stubGlobal("fetch", vi.fn())

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
