/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 *
 * Integration test for the SSN write path (HIPAA_COMPLIANCE.md §9, finding #1:
 * "SSN field encryption not verified end-to-end").
 *
 * lib/db/__tests__/user-profile-ssn.test.ts mocks @/lib/user-profile/encrypt
 * entirely, so it only proves upsertApplicantSsn() *calls* encryptField() —
 * it would still pass if the real cipher were broken or a no-op passthrough.
 *
 * This test uses the REAL AES-256-GCM encrypt/decrypt implementation and a
 * fake in-memory `applicants` table to prove, end to end, that:
 *   - the value actually persisted to ssn_encrypted is genuine ciphertext,
 *     never the plaintext SSN;
 *   - it round-trips back to the original SSN through the real decrypt path;
 *   - re-encrypting the same SSN produces a different ciphertext each time
 *     (random IV — not a static/broken cipher).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/logger", () => ({ logServerError: vi.fn() }))
vi.mock("@/lib/supabase/storage", () => ({ getSignedDocumentUrl: vi.fn() }))

// Fake `applicants` table, keyed by user id — the only thing this test doubles.
const applicantsTable = new Map<string, { ssn_encrypted: string | null }>()

const queryMock = vi.fn((sql: string, params: unknown[] = []) => {
  if (sql.includes("UPDATE applicants SET ssn_encrypted")) {
    const [encrypted, userId] = params as [string, string]
    applicantsTable.set(userId, { ssn_encrypted: encrypted })
    return Promise.resolve({ rows: [] })
  }
  if (sql.includes("SELECT ssn_encrypted FROM applicants")) {
    const [userId] = params as [string]
    const row = applicantsTable.get(userId)
    return Promise.resolve({ rows: row ? [row] : [] })
  }
  if (sql.includes("INSERT INTO audit_logs")) {
    return Promise.resolve({ rows: [] })
  }
  return Promise.resolve({ rows: [] })
})

vi.mock("pg", () => ({ Pool: vi.fn(() => ({ query: queryMock })) }))

const TEST_KEY_HEX = "1".repeat(64) // valid 32-byte AES-256 key, test use only

describe("SSN write path (real encryptField/decryptField)", () => {
  beforeEach(() => {
    vi.resetModules()
    applicantsTable.clear()
    queryMock.mockClear()
    vi.stubEnv("PROFILE_ENCRYPTION_KEY", TEST_KEY_HEX)
    process.env.NODE_ENV = "test"
    process.env.DATABASE_URL = "postgres://test"
    delete (globalThis as any).__mhealthDbPool
  })

  it("never writes the plaintext SSN to the database", async () => {
    const { upsertApplicantSsn } = await import("@/lib/db/user-profile")
    await upsertApplicantSsn("user-1", "123-45-6789")

    const stored = applicantsTable.get("user-1")?.ssn_encrypted
    expect(stored).toBeTruthy()
    expect(stored).not.toContain("123-45-6789")
    expect(stored).not.toBe("123-45-6789")
  })

  it("persists ciphertext in the documented v2:iv:tag:cipher format", async () => {
    const { upsertApplicantSsn } = await import("@/lib/db/user-profile")
    await upsertApplicantSsn("user-2", "987654321")

    const stored = applicantsTable.get("user-2")?.ssn_encrypted as string
    const parts = stored.split(":")
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe("v2")
    expect(parts[1]).toMatch(/^[0-9a-f]{24}$/) // 12-byte IV
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/) // 16-byte auth tag
    expect(parts[3]).toMatch(/^[0-9a-f]+$/) // ciphertext
  })

  it("round-trips through the real decrypt path back to the normalised SSN", async () => {
    const { upsertApplicantSsn, getDecryptedSsn } = await import("@/lib/db/user-profile")
    await upsertApplicantSsn("user-3", "123456789")

    const decrypted = await getDecryptedSsn("user-3")
    expect(decrypted).toBe("123-45-6789")
  })

  it("produces a different ciphertext each time the same SSN is written (random IV)", async () => {
    const { upsertApplicantSsn } = await import("@/lib/db/user-profile")
    await upsertApplicantSsn("user-4", "555-55-5555")
    const first = applicantsTable.get("user-4")?.ssn_encrypted

    await upsertApplicantSsn("user-4", "555-55-5555")
    const second = applicantsTable.get("user-4")?.ssn_encrypted

    expect(first).not.toBe(second)
  })

  it("cannot be decrypted with the wrong encryption key", async () => {
    const { upsertApplicantSsn } = await import("@/lib/db/user-profile")
    await upsertApplicantSsn("user-5", "111-22-3333")

    vi.stubEnv("PROFILE_ENCRYPTION_KEY", "2".repeat(64))
    vi.resetModules()
    const { getDecryptedSsn } = await import("@/lib/db/user-profile")

    await expect(getDecryptedSsn("user-5")).rejects.toThrow()
  })
})
