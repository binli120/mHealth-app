/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const requireAuthenticatedUserMock = vi.fn()
const fetchMock = vi.fn()

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}))

describe("app/api/forms/aca-3-0325/fill/route", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  const originalAnalysisBaseUrl = process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL
  const originalFormsBaseUrl = process.env.NEXT_PUBLIC_MASSHEALTH_FORMS_BASE_URL
  const originalApiToken = process.env.MASSHEALTH_API_TOKEN

  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    requireAuthenticatedUserMock.mockReset()
    requireAuthenticatedUserMock.mockResolvedValue({
      ok: true,
      userId: "11111111-1111-4111-8111-111111111111",
    })
    process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL = "http://analysis.test"
    process.env.NEXT_PUBLIC_MASSHEALTH_FORMS_BASE_URL = ""
    process.env.MASSHEALTH_API_TOKEN = "test-token"
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.unstubAllGlobals()
    process.env.NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL = originalAnalysisBaseUrl
    process.env.NEXT_PUBLIC_MASSHEALTH_FORMS_BASE_URL = originalFormsBaseUrl
    process.env.MASSHEALTH_API_TOKEN = originalApiToken
  })

  it("exports node runtime", async () => {
    const route = await import("@/app/api/forms/aca-3-0325/fill/route")

    expect(route.runtime).toBe("nodejs")
  })

  it("proxies workflow data to the MassHealth analysis fill endpoint", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename=\"aca3-filled-test.pdf\"",
      },
    }))

    const { POST } = await import("@/app/api/forms/aca-3-0325/fill/route")

    const request = new Request("http://localhost/api/forms/aca-3-0325/fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId: "app-1",
        workflowData: {
          contact: {
            p1_name: "Jane Doe",
          },
        },
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("content-disposition")).toBe("attachment; filename=\"aca3-filled-test.pdf\"")

    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(bytes)).toEqual([1, 2, 3])
    expect(fetchMock).toHaveBeenCalledWith(
      "http://analysis.test/masshealth/fill/aca3",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
        body: JSON.stringify({
          user_id: "11111111-1111-4111-8111-111111111111",
          document_type: "ACA-3",
          workflow_data: {
            contact: {
              p1_name: "Jane Doe",
            },
          },
        }),
      }),
    )
  })

  it("returns 422 when workflow payload is invalid", async () => {
    const { POST } = await import("@/app/api/forms/aca-3-0325/fill/route")

    const request = new Request("http://localhost/api/forms/aca-3-0325/fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflowData: null }),
    })

    const response = await POST(request)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ error: "Invalid ACA workflow payload." })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns the upstream error when analysis PDF generation fails", async () => {
    fetchMock.mockResolvedValue(new Response(
      JSON.stringify({ detail: { message: "Input ACA-3 template data is incomplete or invalid." } }),
      {
        status: 422,
        headers: { "content-type": "application/json" },
      },
    ))

    const { POST } = await import("@/app/api/forms/aca-3-0325/fill/route")

    const request = new Request("http://localhost/api/forms/aca-3-0325/fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflowData: { contact: {} } }),
    })

    const response = await POST(request)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: "Input ACA-3 template data is incomplete or invalid.",
    })
  })
})
