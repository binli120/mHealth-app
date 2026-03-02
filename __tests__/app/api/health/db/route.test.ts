import { beforeEach, describe, expect, it, vi } from "vitest"

const pingDatabaseMock = vi.fn()

vi.mock("@/lib/db/server", () => ({
  pingDatabase: pingDatabaseMock,
}))

describe("app/api/health/db/route", () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.resetModules()
    pingDatabaseMock.mockReset()
    process.env.NODE_ENV = originalNodeEnv
  })

  it("returns ok=true when database ping succeeds", async () => {
    pingDatabaseMock.mockResolvedValue(undefined)

    const { GET } = await import("@/app/api/health/db/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it("returns 500 with development error details", async () => {
    process.env.NODE_ENV = "development"
    pingDatabaseMock.mockRejectedValue(new Error("db exploded"))

    const { GET } = await import("@/app/api/health/db/route")
    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ ok: false, error: "db exploded" })
  })

  it("returns 500 with safe message outside development", async () => {
    process.env.NODE_ENV = "production"
    pingDatabaseMock.mockRejectedValue(new Error("sensitive details"))

    const { GET } = await import("@/app/api/health/db/route")
    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Database connection failed" })
  })
})
