/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Unit tests for loadUserAgentMemory.
 *
 * Strategy: mock getDbPool to return a fake pg Pool whose query() resolves
 * to controlled row fixtures. Real AES-256-GCM decrypt runs against a
 * stubbed test key. No real DB connection is made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock declarations ─────────────────────────────────────────────────────────

const mockQuery = vi.fn()

vi.mock("@/lib/db/server", () => ({
  getDbPool: vi.fn(() => ({ query: mockQuery })),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { loadUserAgentMemory } from "@/lib/agents/memory/load"
import { encryptField } from "@/lib/user-profile/encrypt"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TEST_KEY_HEX = "0".repeat(64)

const FACTS = { age: 34, householdSize: 4, annualIncome: 36000 }

function freshRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    user_id: USER_ID,
    session_id: "sess-001",
    extracted_facts: null,
    extracted_facts_encrypted: encryptField(JSON.stringify(FACTS)),
    form_progress: { section: "household", complete: true },
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date(), // fresh by default
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PROFILE_ENCRYPTION_KEY", TEST_KEY_HEX)
  mockQuery.mockResolvedValue({ rowCount: 1 })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("loadUserAgentMemory", () => {
  it("returns null when no memory row exists for the user", async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result).toBeNull()
  })

  it("queries user_agent_memory by user_id", async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    await loadUserAgentMemory(USER_ID)

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/FROM public\.user_agent_memory/i)
    expect(sql).toMatch(/extracted_facts_encrypted/i)
    expect(params).toContain(USER_ID)
  })

  it("maps a DB row to an AgentMemory object, decrypting extracted_facts_encrypted", async () => {
    mockQuery.mockResolvedValue({ rows: [freshRow()] })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result).not.toBeNull()
    expect(result!.id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    expect(result!.userId).toBe(USER_ID)
    expect(result!.sessionId).toBe("sess-001")
    expect(result!.extractedFacts).toEqual(FACTS)
    expect(result!.formProgress).toEqual({ section: "household", complete: true })
  })

  it("maps created_at and updated_at as Date objects", async () => {
    mockQuery.mockResolvedValue({ rows: [freshRow()] })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.createdAt).toBeInstanceOf(Date)
    expect(result!.updatedAt).toBeInstanceOf(Date)
  })

  it("falls back to legacy plaintext extracted_facts when no encrypted column is set", async () => {
    mockQuery.mockResolvedValue({
      rows: [freshRow({ extracted_facts: FACTS, extracted_facts_encrypted: null })],
    })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.extractedFacts).toEqual(FACTS)
  })

  it("returns empty objects for null extracted_facts and form_progress", async () => {
    mockQuery.mockResolvedValue({
      rows: [freshRow({ extracted_facts: null, extracted_facts_encrypted: null, form_progress: null })],
    })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.extractedFacts).toEqual({})
    expect(result!.formProgress).toEqual({})
  })

  it("returns empty facts (not a throw) when decryption fails", async () => {
    mockQuery.mockResolvedValue({
      rows: [freshRow({ extracted_facts_encrypted: "v2:not:valid:ciphertext" })],
    })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.extractedFacts).toEqual({})
  })

  it("returns null sessionId when session_id column is null", async () => {
    mockQuery.mockResolvedValue({
      rows: [freshRow({ session_id: null })],
    })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.sessionId).toBeNull()
  })

  it("marks facts fresh when updated within the staleness window", async () => {
    mockQuery.mockResolvedValue({ rows: [freshRow({ updated_at: new Date() })] })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.isStale).toBe(false)
  })

  it("marks facts stale when updated_at is older than 90 days", async () => {
    const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
    mockQuery.mockResolvedValue({ rows: [freshRow({ updated_at: oldDate })] })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.isStale).toBe(true)
    expect(result!.factAgeDays).toBeGreaterThanOrEqual(120)
  })

  it("logs a PHI audit read event when facts are non-empty", async () => {
    mockQuery.mockResolvedValue({ rows: [freshRow()] })

    await loadUserAgentMemory(USER_ID)

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO audit_logs/i),
      expect.arrayContaining([USER_ID, "phi.agent_memory.read"]),
    )
  })

  it("propagates DB errors to the caller", async () => {
    mockQuery.mockRejectedValue(new Error("Connection refused"))

    await expect(loadUserAgentMemory(USER_ID)).rejects.toThrow("Connection refused")
  })
})
