/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const queryMock = vi.fn()
const PoolMock = vi.fn(() => ({ query: queryMock }))

vi.mock("server-only", () => ({}))
vi.mock("pg", () => ({
  Pool: PoolMock,
}))

describe("lib/db/server", () => {
  beforeEach(() => {
    vi.resetModules()
    PoolMock.mockClear()
    queryMock.mockReset()
    delete process.env.DATABASE_URL
    delete process.env.DATABASE_URL_DEV
    delete process.env.DATABASE_URL_PROD
    delete (globalThis as { __mhealthDbPool?: unknown }).__mhealthDbPool
  })

  it("throws when connection string is missing", async () => {
    process.env.NODE_ENV = "test"

    const { getDbPool } = await import("@/lib/db/server")

    expect(() => getDbPool()).toThrow(/Missing database connection string/)
    expect(PoolMock).not.toHaveBeenCalled()
  })

  it("creates and caches pool in non-production", async () => {
    process.env.NODE_ENV = "development"
    process.env.DATABASE_URL_DEV = "postgres://dev"

    const { getDbPool } = await import("@/lib/db/server")

    const first = getDbPool()
    const second = getDbPool()

    expect(first).toBe(second)
    expect(PoolMock).toHaveBeenCalledTimes(1)
    expect(PoolMock).toHaveBeenCalledWith({ connectionString: "postgres://dev" })
  })

  it("pings database with SELECT 1", async () => {
    process.env.NODE_ENV = "development"
    process.env.DATABASE_URL_DEV = "postgres://dev"

    const { pingDatabase } = await import("@/lib/db/server")

    await pingDatabase()

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith("SELECT 1")
  })
})
