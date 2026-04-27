/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockQuery = vi.hoisted(() => vi.fn())

vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({
    query: mockQuery,
  }),
}))

import {
  hashAccessToken,
  isSessionRevoked,
  revokeUserSessions,
} from "@/lib/auth/session-revocation"

const USER_ID = "550e8400-e29b-41d4-a716-446655440000"
const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"

describe("session-revocation", () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it("hashes access tokens with sha256 hex output", () => {
    expect(hashAccessToken("token-value")).toMatch(/^[0-9a-f]{64}$/)
    expect(hashAccessToken("token-value")).toBe(hashAccessToken("token-value"))
    expect(hashAccessToken("different-token")).not.toBe(hashAccessToken("token-value"))
  })

  it("checks token hash, session id, and user-wide revocation in one query", async () => {
    mockQuery.mockResolvedValue({ rows: [{ exists: true }] })
    const issuedAt = new Date("2026-04-27T12:00:00.000Z")

    const revoked = await isSessionRevoked({
      token: "access-token",
      userId: USER_ID,
      sessionId: "session-123",
      issuedAt,
    })

    expect(revoked).toBe(true)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("public.revoked_sessions"),
      [hashAccessToken("access-token"), "session-123", USER_ID, issuedAt],
    )
  })

  it("returns false when no active revocation row exists", async () => {
    mockQuery.mockResolvedValue({ rows: [{ exists: false }] })

    await expect(
      isSessionRevoked({
        token: "access-token",
        userId: USER_ID,
        sessionId: null,
        issuedAt: null,
      }),
    ).resolves.toBe(false)
  })

  it("inserts a user-wide revocation row for admin force logout", async () => {
    mockQuery.mockResolvedValue({ rowCount: 1 })
    const expiresAt = new Date("2026-04-28T12:00:00.000Z")

    await revokeUserSessions(USER_ID, {
      reason: "admin_force_logout",
      revokedBy: ADMIN_ID,
      expiresAt,
    })

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO public.revoked_sessions"),
      [USER_ID, "admin_force_logout", ADMIN_ID, expiresAt],
    )
  })
})
