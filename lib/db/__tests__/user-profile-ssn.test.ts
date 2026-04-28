/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for the SSN functions in lib/db/user-profile:
 *   normalizeSsn, upsertApplicantSsn, hasApplicantSsn, getDecryptedSsn
 *
 * All external dependencies (pg pool, encrypt, server-only, supabase storage)
 * are mocked so tests run in isolation without a real database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Module mocks ──────────────────────────────────────────────────────────────

// Default: return an empty result set so fire-and-forget calls (e.g. the PHI
// audit log INSERT inside getDecryptedSsn) always resolve without error.
const queryMock = vi.fn().mockResolvedValue({ rows: [] })
const PoolMock = vi.fn(() => ({ query: queryMock }))

vi.mock("server-only", () => ({}))
vi.mock("pg", () => ({ Pool: PoolMock }))

const encryptFieldMock = vi.fn((v: string) => `enc:${v}`)
const decryptFieldMock = vi.fn((v: string) => v.replace(/^enc:/, ""))

vi.mock("@/lib/user-profile/encrypt", () => ({
  encryptField: encryptFieldMock,
  decryptField: decryptFieldMock,
}))

vi.mock("@/lib/supabase/storage", () => ({
  getSignedDocumentUrl: vi.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupDbEnv() {
  process.env.NODE_ENV = "test"
  process.env.DATABASE_URL = "postgres://test"
   
  delete (globalThis as any).__mhealthDbPool
}

// ── normalizeSsn ──────────────────────────────────────────────────────────────

describe("normalizeSsn", () => {
  it("accepts already-dashed format and returns it unchanged", async () => {
    const { normalizeSsn } = await import("@/lib/db/user-profile")
    expect(normalizeSsn("123-45-6789")).toBe("123-45-6789")
  })

  it("converts 9 consecutive digits to dashed format", async () => {
    const { normalizeSsn } = await import("@/lib/db/user-profile")
    expect(normalizeSsn("123456789")).toBe("123-45-6789")
  })

  it("trims surrounding whitespace before normalising", async () => {
    const { normalizeSsn } = await import("@/lib/db/user-profile")
    expect(normalizeSsn("  123-45-6789  ")).toBe("123-45-6789")
    expect(normalizeSsn("  123456789  ")).toBe("123-45-6789")
  })

  it("throws on too-short input", async () => {
    const { normalizeSsn } = await import("@/lib/db/user-profile")
    expect(() => normalizeSsn("12345")).toThrow(/Invalid SSN format/)
  })

  it("throws on too-long input", async () => {
    const { normalizeSsn } = await import("@/lib/db/user-profile")
    expect(() => normalizeSsn("1234567890")).toThrow(/Invalid SSN format/)
  })

  it("throws on dashed input with wrong segment lengths", async () => {
    const { normalizeSsn } = await import("@/lib/db/user-profile")
    expect(() => normalizeSsn("12-345-6789")).toThrow(/Invalid SSN format/)
  })

  it("throws on non-numeric characters", async () => {
    const { normalizeSsn } = await import("@/lib/db/user-profile")
    expect(() => normalizeSsn("abc-de-fghi")).toThrow(/Invalid SSN format/)
  })

  it("throws on empty string", async () => {
    const { normalizeSsn } = await import("@/lib/db/user-profile")
    expect(() => normalizeSsn("")).toThrow(/Invalid SSN format/)
  })
})

// ── upsertApplicantSsn ────────────────────────────────────────────────────────

describe("upsertApplicantSsn", () => {
  beforeEach(() => {
    vi.resetModules()
    PoolMock.mockClear()
    queryMock.mockReset()
    encryptFieldMock.mockClear()
    setupDbEnv()
  })

  it("normalises, encrypts, and writes the SSN to the database", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    const { upsertApplicantSsn } = await import("@/lib/db/user-profile")
    await upsertApplicantSsn("user-1", "123456789")

    // Must encrypt the normalised (dashed) form
    expect(encryptFieldMock).toHaveBeenCalledWith("123-45-6789")

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE applicants SET ssn_encrypted"),
      ["enc:123-45-6789", "user-1"],
    )
  })

  it("also works when SSN is already in dashed format", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    const { upsertApplicantSsn } = await import("@/lib/db/user-profile")
    await upsertApplicantSsn("user-2", "987-65-4321")

    expect(encryptFieldMock).toHaveBeenCalledWith("987-65-4321")
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE applicants"),
      ["enc:987-65-4321", "user-2"],
    )
  })

  it("throws when the SSN format is invalid", async () => {
    const { upsertApplicantSsn } = await import("@/lib/db/user-profile")
    await expect(upsertApplicantSsn("user-3", "not-an-ssn")).rejects.toThrow(/Invalid SSN format/)
    // DB must not be touched
    expect(queryMock).not.toHaveBeenCalled()
  })
})

// ── hasApplicantSsn ───────────────────────────────────────────────────────────

describe("hasApplicantSsn", () => {
  beforeEach(() => {
    vi.resetModules()
    PoolMock.mockClear()
    queryMock.mockReset()
    setupDbEnv()
  })

  it("returns true when ssn_encrypted is present", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ssn_encrypted: "enc:123-45-6789" }] })

    const { hasApplicantSsn } = await import("@/lib/db/user-profile")
    const result = await hasApplicantSsn("user-1")

    expect(result).toBe(true)
  })

  it("returns false when ssn_encrypted is null", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ssn_encrypted: null }] })

    const { hasApplicantSsn } = await import("@/lib/db/user-profile")
    const result = await hasApplicantSsn("user-1")

    expect(result).toBe(false)
  })

  it("returns false when no applicant row is found", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    const { hasApplicantSsn } = await import("@/lib/db/user-profile")
    const result = await hasApplicantSsn("unknown-user")

    expect(result).toBe(false)
  })

  it("queries by the correct userId", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ssn_encrypted: "enc:111-22-3333" }] })

    const { hasApplicantSsn } = await import("@/lib/db/user-profile")
    await hasApplicantSsn("target-user")

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = $1"),
      ["target-user"],
    )
  })
})

// ── getDecryptedSsn ───────────────────────────────────────────────────────────

describe("getDecryptedSsn", () => {
  beforeEach(() => {
    vi.resetModules()
    PoolMock.mockClear()
    queryMock.mockReset()
    // Restore default after reset so fire-and-forget calls (audit INSERT) always
    // resolve instead of returning undefined and crashing on .catch().
    queryMock.mockResolvedValue({ rows: [] })
    decryptFieldMock.mockClear()
    setupDbEnv()
  })

  it("returns the decrypted SSN when one exists", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ssn_encrypted: "enc:123-45-6789" }] })

    const { getDecryptedSsn } = await import("@/lib/db/user-profile")
    const result = await getDecryptedSsn("user-1")

    expect(decryptFieldMock).toHaveBeenCalledWith("enc:123-45-6789")
    expect(result).toBe("123-45-6789")
  })

  it("returns null when ssn_encrypted is null", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ssn_encrypted: null }] })

    const { getDecryptedSsn } = await import("@/lib/db/user-profile")
    const result = await getDecryptedSsn("user-1")

    expect(result).toBeNull()
    expect(decryptFieldMock).not.toHaveBeenCalled()
  })

  it("returns null when no applicant row is found", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    const { getDecryptedSsn } = await import("@/lib/db/user-profile")
    const result = await getDecryptedSsn("unknown-user")

    expect(result).toBeNull()
    expect(decryptFieldMock).not.toHaveBeenCalled()
  })

  it("never returns the raw encrypted blob", async () => {
    const encryptedBlob = "enc:999-88-7777"
    queryMock.mockResolvedValueOnce({ rows: [{ ssn_encrypted: encryptedBlob }] })

    const { getDecryptedSsn } = await import("@/lib/db/user-profile")
    const result = await getDecryptedSsn("user-1")

    expect(result).not.toBe(encryptedBlob)
    expect(result).toBe("999-88-7777") // decrypted form
  })

  it("writes a PHI audit log record after every successful decryption", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ssn_encrypted: "enc:123-45-6789" }] })

    const { getDecryptedSsn } = await import("@/lib/db/user-profile")
    await getDecryptedSsn("user-audit", "pdf-generation")

    // queryMock is called twice: once for SELECT, once for the audit INSERT
    expect(queryMock).toHaveBeenCalledTimes(2)
    const auditCall = queryMock.mock.calls[1]
    expect(auditCall?.[0]).toContain("INSERT INTO audit_logs")
    expect(auditCall?.[1]).toContain("user-audit")
    expect(auditCall?.[1]).toContain("phi.ssn.decrypted")
    // The metadata JSON should include the purpose
    const metaJson = auditCall?.[1]?.[2] as string
    expect(JSON.parse(metaJson)).toMatchObject({ purpose: "pdf-generation" })
  })

  it("does not write an audit log when no SSN is stored (null row)", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ssn_encrypted: null }] })

    const { getDecryptedSsn } = await import("@/lib/db/user-profile")
    await getDecryptedSsn("user-no-ssn")

    // Only the SELECT — no audit INSERT because there was nothing to decrypt
    expect(queryMock).toHaveBeenCalledTimes(1)
  })
})
