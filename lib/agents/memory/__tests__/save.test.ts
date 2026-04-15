/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for mergeAndSaveAgentMemory.
 *
 * Strategy: mock getDbPool to return a fake pg Pool. Assert on the SQL and
 * parameter values passed to pool.query() — no real DB connection is made.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock declarations ─────────────────────────────────────────────────────────

const mockQuery = vi.fn()

vi.mock("@/lib/db/server", () => ({
  getDbPool: vi.fn(() => ({ query: mockQuery })),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { mergeAndSaveAgentMemory } from "@/lib/agents/memory/save"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockResolvedValue({ rowCount: 1 })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the SQL and parsed JSON params from the most recent pool.query call. */
function lastCall() {
  const [sql, params] = mockQuery.mock.calls[0]
  return {
    sql: sql as string,
    userId: params[0] as string,
    sessionId: params[1] as string | null,
    facts: JSON.parse(params[2] as string) as Record<string, unknown>,
    progress: JSON.parse(params[3] as string) as Record<string, unknown>,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("mergeAndSaveAgentMemory", () => {
  it("calls INSERT ... ON CONFLICT for the given user", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } })

    const { sql, userId } = lastCall()
    expect(sql).toMatch(/INSERT INTO user_agent_memory/i)
    expect(sql).toMatch(/ON CONFLICT.*DO UPDATE/i)
    expect(userId).toBe(USER_ID)
  })

  it("serialises extracted facts as JSON in the query params", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      extractedFacts: { age: 45, householdSize: 3, annualIncome: 48000 },
    })

    const { facts } = lastCall()
    expect(facts).toEqual({ age: 45, householdSize: 3, annualIncome: 48000 })
  })

  it("strips null values from extracted facts before persisting", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      extractedFacts: { age: 28, isPregnant: null as unknown as boolean },
    })

    const { facts } = lastCall()
    expect(facts.age).toBe(28)
    expect("isPregnant" in facts).toBe(false)
  })

  it("strips undefined values from extracted facts before persisting", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      extractedFacts: { age: 28, hasMedicare: undefined },
    })

    const { facts } = lastCall()
    expect("hasMedicare" in facts).toBe(false)
  })

  it("passes sessionId as the second query param when provided", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      extractedFacts: {},
      sessionId: "sess-abc",
    })

    const { sessionId } = lastCall()
    expect(sessionId).toBe("sess-abc")
  })

  it("passes null for sessionId when not provided", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } })

    const { sessionId } = lastCall()
    expect(sessionId).toBeNull()
  })

  it("serialises form_progress as JSON in the fourth query param", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      formProgress: { section: "income", complete: false },
    })

    const { progress } = lastCall()
    expect(progress).toEqual({ section: "income", complete: false })
  })

  it("uses empty objects when payload fields are omitted", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {})

    const { facts, progress } = lastCall()
    expect(facts).toEqual({})
    expect(progress).toEqual({})
  })

  it("propagates DB errors to the caller", async () => {
    mockQuery.mockRejectedValue(new Error("Unique violation"))

    await expect(mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } }))
      .rejects.toThrow("Unique violation")
  })
})
