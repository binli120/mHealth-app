/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for loadUserAgentMemory.
 *
 * Strategy: mock getDbPool to return a fake pg Pool whose query() resolves
 * to controlled row fixtures. No real DB connection is made.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock declarations ─────────────────────────────────────────────────────────

const mockQuery = vi.fn()

vi.mock("@/lib/db/server", () => ({
  getDbPool: vi.fn(() => ({ query: mockQuery })),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { loadUserAgentMemory } from "@/lib/agents/memory/load"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const MEMORY_ROW = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  user_id: USER_ID,
  session_id: "sess-001",
  extracted_facts: { age: 34, householdSize: 4, annualIncome: 36000 },
  form_progress: { section: "household", complete: true },
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-10T00:00:00Z"),
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
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
    expect(sql).toMatch(/FROM user_agent_memory/i)
    expect(params).toContain(USER_ID)
  })

  it("maps a DB row to an AgentMemory object", async () => {
    mockQuery.mockResolvedValue({ rows: [MEMORY_ROW] })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result).not.toBeNull()
    expect(result!.id).toBe(MEMORY_ROW.id)
    expect(result!.userId).toBe(USER_ID)
    expect(result!.sessionId).toBe("sess-001")
    expect(result!.extractedFacts).toEqual({ age: 34, householdSize: 4, annualIncome: 36000 })
    expect(result!.formProgress).toEqual({ section: "household", complete: true })
  })

  it("maps created_at and updated_at as Date objects", async () => {
    mockQuery.mockResolvedValue({ rows: [MEMORY_ROW] })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.createdAt).toBeInstanceOf(Date)
    expect(result!.updatedAt).toBeInstanceOf(Date)
  })

  it("returns empty objects for null extracted_facts and form_progress", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ ...MEMORY_ROW, extracted_facts: null, form_progress: null }],
    })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.extractedFacts).toEqual({})
    expect(result!.formProgress).toEqual({})
  })

  it("returns null sessionId when session_id column is null", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ ...MEMORY_ROW, session_id: null }],
    })

    const result = await loadUserAgentMemory(USER_ID)

    expect(result!.sessionId).toBeNull()
  })

  it("propagates DB errors to the caller", async () => {
    mockQuery.mockRejectedValue(new Error("Connection refused"))

    await expect(loadUserAgentMemory(USER_ID)).rejects.toThrow("Connection refused")
  })
})
