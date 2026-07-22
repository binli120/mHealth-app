/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Unit tests for mergeAndSaveAgentMemory.
 *
 * Strategy: mock getDbPool to return a fake pg Pool whose connect() yields a
 * fake client. The real code now runs three statements inside the
 * transaction — INSERT ... ON CONFLICT DO NOTHING (ensure a row exists),
 * SELECT ... FOR UPDATE (lock it), UPDATE (write the merged result) — to
 * avoid a first-session race where two concurrent writes for the same new
 * user could otherwise both merge against an empty row and the second to
 * commit would clobber the first's facts. Real AES-256-GCM encrypt/decrypt
 * runs against a stubbed test key so we can assert on the actual merged
 * plaintext, not just ciphertext. No real DB connection is made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock declarations ─────────────────────────────────────────────────────────

const mockClientQuery = vi.fn()
const mockClientRelease = vi.fn()
const mockPoolQuery = vi.fn()
const mockConnect = vi.fn(() => ({
  query: mockClientQuery,
  release: mockClientRelease,
}))

vi.mock("@/lib/db/server", () => ({
  getDbPool: vi.fn(() => ({ query: mockPoolQuery, connect: mockConnect })),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { mergeAndSaveAgentMemory } from "@/lib/agents/memory/save"
import { encryptField, decryptField } from "@/lib/user-profile/encrypt"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const TEST_KEY_HEX = "0".repeat(64)

/** No existing row — the common "first session" case. */
const EMPTY_SELECT_RESULT = { rows: [] }

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PROFILE_ENCRYPTION_KEY", TEST_KEY_HEX)
  mockPoolQuery.mockResolvedValue({ rowCount: 1 })
  mockClientQuery.mockImplementation((sql: string) => {
    if (/SELECT/i.test(sql)) return Promise.resolve(EMPTY_SELECT_RESULT)
    return Promise.resolve({ rowCount: 1 })
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find the ensure-row `INSERT ... ON CONFLICT DO NOTHING` call on the client. */
function ensureRowInsertCall() {
  const call = mockClientQuery.mock.calls.find(
    ([sql]) => /INSERT INTO public\.user_agent_memory/i.test(sql as string),
  )
  const [sql, params] = call!
  return { sql: sql as string, userId: params[0] as string, sessionId: params[1] as string | null }
}

/** Extract the SQL + params from the final `UPDATE` call on the client. */
function updateCall() {
  const call = mockClientQuery.mock.calls.find(
    ([sql]) => /^UPDATE public\.user_agent_memory/i.test(sql as string),
  )
  const [sql, params] = call!
  return {
    sql: sql as string,
    userId: params[0] as string,
    sessionId: params[1] as string | null,
    facts: JSON.parse(decryptField(params[2] as string)) as Record<string, unknown>,
    progress: JSON.parse(params[3] as string) as Record<string, unknown>,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("mergeAndSaveAgentMemory", () => {
  it("runs insert-if-missing → lock → update, in a BEGIN/COMMIT transaction", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } })

    expect(mockConnect).toHaveBeenCalledTimes(1)
    const sqls = mockClientQuery.mock.calls.map(([sql]) => sql as string)
    const insertIdx = sqls.findIndex((s) => /INSERT INTO public\.user_agent_memory/i.test(s))
    const selectIdx = sqls.findIndex((s) => /SELECT.*FOR UPDATE/is.test(s))
    const updateIdx = sqls.findIndex((s) => /^UPDATE public\.user_agent_memory/i.test(s))

    expect(sqls[0]).toMatch(/^BEGIN$/i)
    expect(insertIdx).toBeGreaterThan(-1)
    expect(selectIdx).toBeGreaterThan(insertIdx)
    expect(updateIdx).toBeGreaterThan(selectIdx)
    expect(sqls.at(-1)).toMatch(/^COMMIT$/i)
    expect(mockClientRelease).toHaveBeenCalledTimes(1)
  })

  it("ensures a row exists via INSERT ... ON CONFLICT DO NOTHING (not DO UPDATE)", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } })

    const { sql, userId } = ensureRowInsertCall()
    expect(sql).toMatch(/ON CONFLICT.*DO NOTHING/i)
    expect(sql).not.toMatch(/DO UPDATE/i)
    expect(userId).toBe(USER_ID)
  })

  it("locks the row with SELECT ... FOR UPDATE before merging", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } })

    const sqls = mockClientQuery.mock.calls.map(([sql]) => sql as string)
    expect(sqls.some((s) => /SELECT.*FOR UPDATE/is.test(s))).toBe(true)
  })

  it("writes the merged facts via a plain UPDATE for the given user", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } })

    const { sql, userId } = updateCall()
    expect(sql).toMatch(/^UPDATE public\.user_agent_memory/i)
    expect(userId).toBe(USER_ID)
  })

  it("encrypts extracted facts rather than storing them as plaintext", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 45 } })

    const { sql, params } = (() => {
      const call = mockClientQuery.mock.calls.find(([s]) => /^UPDATE public\.user_agent_memory/i.test(s as string))!
      return { sql: call[0] as string, params: call[1] as unknown[] }
    })()
    const rawFactsParam = params[2] as string
    // Ciphertext hex is random and may coincidentally contain a substring like
    // "45" — assert against the JSON literal shape instead of a bare digit.
    expect(rawFactsParam).not.toContain(JSON.stringify({ age: 45 }))
    expect(rawFactsParam).toMatch(/^v2:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)
    expect(sql).toMatch(/extracted_facts_encrypted/i)
  })

  it("round-trips extracted facts through encrypt/decrypt", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      extractedFacts: { age: 45, householdSize: 3, annualIncome: 48000 },
    })

    const { facts } = updateCall()
    expect(facts).toEqual({ age: 45, householdSize: 3, annualIncome: 48000 })
  })

  it("merges new facts with existing encrypted facts in application code", async () => {
    const existingFacts = encryptField(JSON.stringify({ age: 45, citizenshipStatus: "citizen" }))
    mockClientQuery.mockImplementation((sql: string) => {
      if (/SELECT/i.test(sql)) {
        return Promise.resolve({
          rows: [{ extracted_facts: null, extracted_facts_encrypted: existingFacts }],
        })
      }
      return Promise.resolve({ rowCount: 1 })
    })

    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { annualIncome: 36000 } })

    const { facts } = updateCall()
    expect(facts).toEqual({ age: 45, citizenshipStatus: "citizen", annualIncome: 36000 })
  })

  it("migrates a legacy plaintext row to the encrypted column on next write", async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/SELECT/i.test(sql)) {
        return Promise.resolve({
          rows: [{ extracted_facts: { age: 50 }, extracted_facts_encrypted: null }],
        })
      }
      return Promise.resolve({ rowCount: 1 })
    })

    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { hasMedicare: true } })

    const { sql, facts } = updateCall()
    expect(facts).toEqual({ age: 50, hasMedicare: true })
    expect(sql).toMatch(/extracted_facts\s*=\s*NULL/i)
  })

  it("aborts the write (does not wipe existing facts) when existing ciphertext fails to decrypt", async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/SELECT/i.test(sql)) {
        return Promise.resolve({
          rows: [{ extracted_facts: null, extracted_facts_encrypted: "v2:garbage:not:realciphertext" }],
        })
      }
      return Promise.resolve({ rowCount: 1 })
    })

    await expect(
      mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 40 } }),
    ).rejects.toThrow(/decrypt/i)

    // The merge must never reach the UPDATE — a bad decrypt should not let
    // re-encrypting only the new facts silently overwrite the old ciphertext.
    const sqls = mockClientQuery.mock.calls.map(([sql]) => sql as string)
    expect(sqls.some((s) => /^UPDATE public\.user_agent_memory/i.test(s))).toBe(false)
    expect(sqls.at(-1)).toMatch(/^ROLLBACK$/i)
    expect(mockClientRelease).toHaveBeenCalledTimes(1)
  })

  it("does not lose the winner's facts when SELECT ... FOR UPDATE races a concurrent first write", async () => {
    // Simulates the bug: by the time this call's SELECT runs, a concurrent
    // transaction has already committed its own first-write facts. Because
    // the ensure-row INSERT runs (and Postgres serializes concurrent inserts
    // on the same key) before the SELECT, the SELECT here must see that
    // committed row rather than an empty one.
    const concurrentWinnerFacts = encryptField(JSON.stringify({ citizenshipStatus: "citizen" }))
    mockClientQuery.mockImplementation((sql: string) => {
      if (/SELECT/i.test(sql)) {
        return Promise.resolve({
          rows: [{ extracted_facts: null, extracted_facts_encrypted: concurrentWinnerFacts }],
        })
      }
      return Promise.resolve({ rowCount: 1 })
    })

    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 40 } })

    const { facts } = updateCall()
    expect(facts).toEqual({ citizenshipStatus: "citizen", age: 40 })
  })

  it("strips null values from extracted facts before persisting", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      extractedFacts: { age: 28, isPregnant: null as unknown as boolean },
    })

    const { facts } = updateCall()
    expect(facts.age).toBe(28)
    expect("isPregnant" in facts).toBe(false)
  })

  it("strips undefined values from extracted facts before persisting", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      extractedFacts: { age: 28, hasMedicare: undefined },
    })

    const { facts } = updateCall()
    expect("hasMedicare" in facts).toBe(false)
  })

  it("passes sessionId as the second query param when provided", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      extractedFacts: {},
      sessionId: "sess-abc",
    })

    expect(ensureRowInsertCall().sessionId).toBe("sess-abc")
    expect(updateCall().sessionId).toBe("sess-abc")
  })

  it("passes null for sessionId when not provided", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } })

    expect(ensureRowInsertCall().sessionId).toBeNull()
    expect(updateCall().sessionId).toBeNull()
  })

  it("serialises form_progress as JSON in the fourth query param", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {
      formProgress: { section: "income", complete: false },
    })

    const { progress } = updateCall()
    expect(progress).toEqual({ section: "income", complete: false })
  })

  it("uses empty objects when payload fields are omitted", async () => {
    await mergeAndSaveAgentMemory(USER_ID, {})

    const { facts, progress } = updateCall()
    expect(facts).toEqual({})
    expect(progress).toEqual({})
  })

  it("logs a PHI audit event when facts are written", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } })

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO audit_logs/i),
      expect.arrayContaining([USER_ID, "phi.agent_memory.written"]),
    )
  })

  it("does not log a PHI audit event when no facts are written", async () => {
    await mergeAndSaveAgentMemory(USER_ID, { formProgress: { section: "income" } })

    expect(mockPoolQuery).not.toHaveBeenCalled()
  })

  it("rolls back the transaction and propagates DB errors to the caller", async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (/^BEGIN$/i.test(sql)) return Promise.resolve()
      if (/SELECT/i.test(sql)) return Promise.resolve(EMPTY_SELECT_RESULT)
      if (/^UPDATE/i.test(sql)) return Promise.reject(new Error("Unique violation"))
      return Promise.resolve()
    })

    await expect(mergeAndSaveAgentMemory(USER_ID, { extractedFacts: { age: 30 } }))
      .rejects.toThrow("Unique violation")

    const sqls = mockClientQuery.mock.calls.map(([sql]) => sql as string)
    expect(sqls.at(-1)).toMatch(/^ROLLBACK$/i)
    expect(mockClientRelease).toHaveBeenCalledTimes(1)
  })
})
