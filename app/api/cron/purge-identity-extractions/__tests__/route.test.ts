/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Unit tests for GET /api/cron/purge-identity-extractions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQuery = vi.fn()

vi.mock("@/lib/db/server", () => ({
  getDbPool: vi.fn(() => ({ query: mockQuery })),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
  logServerInfo:  vi.fn(),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { GET } from "@/app/api/cron/purge-identity-extractions/route"
import { logServerError, logServerInfo } from "@/lib/server/logger"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string, host = "localhost:3000"): Request {
  return {
    headers: new Headers({
      ...(authHeader ? { authorization: authHeader } : {}),
      host,
    }),
  } as unknown as Request
}

const PURGE_COUNTS = { rowCount: 3 }

function mockDbSuccess() {
  mockQuery.mockResolvedValue(PURGE_COUNTS)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("GET /api/cron/purge-identity-extractions — auth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it("returns 401 when CRON_SECRET is set and no Authorization header is present", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t")
    const res = await GET(makeRequest(undefined, "api.example.com"))
    expect(res.status).toBe(401)
  })

  it("returns 401 when CRON_SECRET is set and the token is wrong", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t")
    const res = await GET(makeRequest("Bearer wrong-token", "api.example.com"))
    expect(res.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it("returns 401 from a non-local host when no CRON_SECRET is configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const res = await GET(makeRequest(undefined, "api.example.com"))
    expect(res.status).toBe(401)
  })

  it("allows a localhost request when no CRON_SECRET is configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    mockDbSuccess()
    const res = await GET(makeRequest(undefined, "localhost:3000"))
    expect(res.status).toBe(200)
  })

  it("allows a 127.0.0.1 request when no CRON_SECRET is configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    mockDbSuccess()
    const res = await GET(makeRequest(undefined, "127.0.0.1:3000"))
    expect(res.status).toBe(200)
  })
})

// ── Successful purge ──────────────────────────────────────────────────────────

describe("GET /api/cron/purge-identity-extractions — purge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("CRON_SECRET", "test-secret")
  })

  it("returns 200 with a purge summary on success", async () => {
    mockDbSuccess()
    const res = await GET(makeRequest("Bearer test-secret"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.purged).toMatchObject({
      mobileSessionsExtractedData:    3,
      identityAttemptsIpAndUserAgent: 3,
      documentExtractionsRawOutput:   3,
      documentPagesOcrText:           3,
    })
  })

  it("runs exactly four UPDATE statements", async () => {
    mockDbSuccess()
    await GET(makeRequest("Bearer test-secret"))
    expect(mockQuery).toHaveBeenCalledTimes(4)
  })

  it("passes the retention interval as a parameterized value", async () => {
    mockDbSuccess()
    await GET(makeRequest("Bearer test-secret"))
    for (const call of mockQuery.mock.calls) {
      // Each call: query(sql, [retentionInterval])
      expect(call[1]).toEqual(["30 days"])
    }
  })

  it("targets mobile_verify_sessions.extracted_data in the first query", async () => {
    mockDbSuccess()
    await GET(makeRequest("Bearer test-secret"))
    const [sql] = mockQuery.mock.calls[0] as [string]
    expect(sql).toMatch(/mobile_verify_sessions/)
    expect(sql).toMatch(/extracted_data\s*=\s*NULL/)
  })

  it("targets identity_verification_attempts ip_address and user_agent in the second query", async () => {
    mockDbSuccess()
    await GET(makeRequest("Bearer test-secret"))
    const [sql] = mockQuery.mock.calls[1] as [string]
    expect(sql).toMatch(/identity_verification_attempts/)
    expect(sql).toMatch(/ip_address\s*=\s*NULL/)
    expect(sql).toMatch(/user_agent\s*=\s*NULL/)
  })

  it("targets document_extractions raw_output and structured_output in the third query", async () => {
    mockDbSuccess()
    await GET(makeRequest("Bearer test-secret"))
    const [sql] = mockQuery.mock.calls[2] as [string]
    expect(sql).toMatch(/document_extractions/)
    expect(sql).toMatch(/raw_output\s*=\s*NULL/)
    expect(sql).toMatch(/structured_output\s*=\s*NULL/)
  })

  it("targets document_pages.ocr_text via documents.uploaded_at in the fourth query", async () => {
    mockDbSuccess()
    await GET(makeRequest("Bearer test-secret"))
    const [sql] = mockQuery.mock.calls[3] as [string]
    expect(sql).toMatch(/document_pages/)
    expect(sql).toMatch(/documents/)
    expect(sql).toMatch(/ocr_text\s*=\s*NULL/)
    expect(sql).toMatch(/uploaded_at/)
  })

  it("logs completion with the purge summary", async () => {
    mockDbSuccess()
    await GET(makeRequest("Bearer test-secret"))
    expect(logServerInfo).toHaveBeenCalledOnce()
    const [, ctx] = vi.mocked(logServerInfo).mock.calls[0]
    expect(ctx).toMatchObject({ retentionDays: 30 })
  })

  it("handles null rowCount from the driver gracefully (treats as 0)", async () => {
    mockQuery.mockResolvedValue({ rowCount: null })
    const res = await GET(makeRequest("Bearer test-secret"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.purged.mobileSessionsExtractedData).toBe(0)
  })
})

// ── Error handling ────────────────────────────────────────────────────────────

describe("GET /api/cron/purge-identity-extractions — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("CRON_SECRET", "test-secret")
  })

  it("returns 500 and logs when the database query throws", async () => {
    mockQuery.mockRejectedValue(new Error("Connection refused"))
    const res = await GET(makeRequest("Bearer test-secret"))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(logServerError).toHaveBeenCalledOnce()
  })

  it("does not leak error details in the 500 response body", async () => {
    mockQuery.mockRejectedValue(new Error("pg: permission denied for table users"))
    const res = await GET(makeRequest("Bearer test-secret"))
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toMatch(/permission denied/)
    expect(raw).not.toMatch(/\bstack\b/)
  })
})
