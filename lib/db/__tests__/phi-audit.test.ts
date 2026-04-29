/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for lib/db/phi-audit:
 *   logPhiAccess, getPhiAuditLogs
 *
 * All external dependencies (pg pool, server-only) are mocked so tests
 * run in isolation without a real database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Module mocks ──────────────────────────────────────────────────────────────

const queryMock = vi.fn().mockResolvedValue({ rows: [] })
const PoolMock = vi.fn(() => ({ query: queryMock }))

vi.mock("server-only", () => ({}))
vi.mock("pg", () => ({ Pool: PoolMock }))

const logServerErrorMock = vi.fn()
vi.mock("@/lib/server/logger", () => ({ logServerError: logServerErrorMock }))

// ── Setup helpers ─────────────────────────────────────────────────────────────

function setupDbEnv() {
  process.env.NODE_ENV = "test"
  process.env.DATABASE_URL = "postgres://test"
  delete (globalThis as any).__mhealthDbPool
}

// ── logPhiAccess ──────────────────────────────────────────────────────────────

describe("logPhiAccess", () => {
  beforeEach(() => {
    vi.resetModules()
    PoolMock.mockClear()
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    logServerErrorMock.mockClear()
    setupDbEnv()
  })

  it("inserts a row with userId, action, ipAddress, and serialised newData", async () => {
    const { logPhiAccess } = await import("@/lib/db/phi-audit")
    logPhiAccess("user-1", "phi.ssn.written", { ipAddress: "1.2.3.4", purpose: "user-submitted" })

    // Fire-and-forget: flush the microtask queue so the promise resolves
    await vi.waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1))

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain("INSERT INTO audit_logs")
    expect(params[0]).toBe("user-1")
    expect(params[1]).toBe("phi.ssn.written")
    expect(params[2]).toBe("1.2.3.4")
    const parsed = JSON.parse(params[3] as string) as Record<string, unknown>
    expect(parsed.purpose).toBe("user-submitted")
  })

  it("stores null for ipAddress when context omits it", async () => {
    const { logPhiAccess } = await import("@/lib/db/phi-audit")
    logPhiAccess("user-2", "phi.ssn.decrypted")

    await vi.waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1))

    const [, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(params[2]).toBeNull()
  })

  it("never throws when the DB query rejects", async () => {
    queryMock.mockRejectedValueOnce(new Error("DB down"))

    const { logPhiAccess } = await import("@/lib/db/phi-audit")
    // Must not throw — fire-and-forget
    expect(() => logPhiAccess("user-3", "phi.ssn.written")).not.toThrow()

    // Error is forwarded to logServerError
    await vi.waitFor(() => expect(logServerErrorMock).toHaveBeenCalledTimes(1))
    expect(logServerErrorMock).toHaveBeenCalledWith(
      "phi.audit.write_failed",
      expect.any(Error),
      expect.objectContaining({ userId: "user-3", action: "phi.ssn.written" }),
    )
  })

  it("includes extra meta fields alongside purpose in new_data", async () => {
    const { logPhiAccess } = await import("@/lib/db/phi-audit")
    logPhiAccess(
      "user-4",
      "phi.bank_account.written",
      { ipAddress: "5.6.7.8", purpose: "user-submitted" },
      { bankName: "Chase", accountType: "checking", lastFourDigits: "4321" },
    )

    await vi.waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1))

    const [, params] = queryMock.mock.calls[0] as [string, unknown[]]
    const parsed = JSON.parse(params[3] as string) as Record<string, unknown>
    expect(parsed.purpose).toBe("user-submitted")
    expect(parsed.bankName).toBe("Chase")
    expect(parsed.lastFourDigits).toBe("4321")
  })
})

// ── getPhiAuditLogs ───────────────────────────────────────────────────────────

describe("getPhiAuditLogs", () => {
  beforeEach(() => {
    vi.resetModules()
    PoolMock.mockClear()
    queryMock.mockReset()
    queryMock.mockResolvedValue({ rows: [] })
    setupDbEnv()
  })

  it("queries audit_logs filtering to phi.% actions", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })   // rows
      .mockResolvedValueOnce({ rows: [{ count: "0" }] }) // count

    const { getPhiAuditLogs } = await import("@/lib/db/phi-audit")
    await getPhiAuditLogs()

    const rowsCall = queryMock.mock.calls[0]
    expect(rowsCall?.[0]).toContain("action LIKE 'phi.%'")
  })

  it("adds a user_id filter when userId is provided", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })

    const { getPhiAuditLogs } = await import("@/lib/db/phi-audit")
    await getPhiAuditLogs({ userId: "target-user" })

    const rowsCall = queryMock.mock.calls[0]
    expect(rowsCall?.[0]).toContain("user_id = $")
    expect(rowsCall?.[1]).toContain("target-user")
  })

  it("maps DB rows to PhiAuditEntry shape", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "abc",
            user_id: "user-1",
            action: "phi.ssn.decrypted",
            ip_address: "9.9.9.9",
            new_data: JSON.stringify({ purpose: "pdf-generation" }),
            created_at: "2026-04-27T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })

    const { getPhiAuditLogs } = await import("@/lib/db/phi-audit")
    const { entries, total } = await getPhiAuditLogs()

    expect(total).toBe(1)
    expect(entries).toHaveLength(1)
    const entry = entries[0]!
    expect(entry.id).toBe("abc")
    expect(entry.userId).toBe("user-1")
    expect(entry.action).toBe("phi.ssn.decrypted")
    expect(entry.ipAddress).toBe("9.9.9.9")
    expect(entry.metadata).toEqual({ purpose: "pdf-generation" })
    expect(entry.createdAt).toBe("2026-04-27T00:00:00Z")
  })

  it("returns empty metadata object when new_data is null", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "def",
            user_id: "user-2",
            action: "phi.ssn.written",
            ip_address: null,
            new_data: null,
            created_at: "2026-04-27T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })

    const { getPhiAuditLogs } = await import("@/lib/db/phi-audit")
    const { entries } = await getPhiAuditLogs()

    expect(entries[0]!.metadata).toEqual({})
    expect(entries[0]!.ipAddress).toBeNull()
  })

  it("caps limit at 200 even if caller requests more", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })

    const { getPhiAuditLogs } = await import("@/lib/db/phi-audit")
    await getPhiAuditLogs({ limit: 9999 })

    const rowsCall = queryMock.mock.calls[0]
    // The LIMIT param should be 200, not 9999
    expect(rowsCall?.[1]).toContain(200)
    expect(rowsCall?.[1]).not.toContain(9999)
  })

  it("passes offset through to the query", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })

    const { getPhiAuditLogs } = await import("@/lib/db/phi-audit")
    await getPhiAuditLogs({ offset: 100 })

    const rowsCall = queryMock.mock.calls[0]
    expect(rowsCall?.[1]).toContain(100)
  })
})
