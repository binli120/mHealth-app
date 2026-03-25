/**
 * Unit tests for lib/auth/require-auth.ts
 * Supabase client and local-auth helper are mocked; the JWT helpers are exercised
 * indirectly through requireAuthenticatedUser.
 * @author Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/local-auth", () => ({
  isLocalAuthHelperEnabled: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

const mockGetUser = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { isLocalAuthHelperEnabled } from "@/lib/auth/local-auth"
import { logServerError } from "@/lib/server/logger"

const mockLocalAuth = vi.mocked(isLocalAuthHelperEnabled)
const mockLogError  = vi.mocked(logServerError)

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

/** Build a minimal 3-part JWT with a base64url-encoded payload. */
function makeJwt(payload: Record<string, unknown>): string {
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const body    = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${body}.fakesignature`
}

/** A JWT whose subject is VALID_UUID and expires 1 hour from now. */
function validJwt(overrides: Record<string, unknown> = {}): string {
  return makeJwt({
    sub: VALID_UUID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  })
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", { headers })
}

function bearerRequest(token: string): Request {
  return makeRequest({ authorization: `Bearer ${token}` })
}

function cookieRequest(token: string): Request {
  return makeRequest({ cookie: `sb-access-token=${encodeURIComponent(token)}` })
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockLocalAuth.mockReturnValue(false)
  // Default: Supabase returns a valid user
  mockGetUser.mockResolvedValue({ data: { user: { id: VALID_UUID } }, error: null })
})

// ── No token ──────────────────────────────────────────────────────────────────

describe("requireAuthenticatedUser — no token", () => {
  it("returns 401 when no Authorization header and no cookie", async () => {
    const result = await requireAuthenticatedUser(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      const body = await result.response.json() as { error: string }
      expect(body.error).toMatch(/authentication required/i)
    }
  })

  it("returns 401 when Authorization header is present but not Bearer scheme", async () => {
    const result = await requireAuthenticatedUser(
      makeRequest({ authorization: "Basic dXNlcjpwYXNz" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it("returns 401 when Authorization header has only the scheme with no token", async () => {
    const result = await requireAuthenticatedUser(
      makeRequest({ authorization: "Bearer" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })
})

// ── Supabase success ──────────────────────────────────────────────────────────

describe("requireAuthenticatedUser — Supabase returns a valid user", () => {
  it("accepts a Bearer token and returns ok: true with the userId", async () => {
    const result = await requireAuthenticatedUser(bearerRequest(validJwt()))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(VALID_UUID)
  })

  it("accepts a token from the sb-access-token cookie", async () => {
    const result = await requireAuthenticatedUser(cookieRequest(validJwt()))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(VALID_UUID)
  })

  it("Bearer token takes precedence over cookie token", async () => {
    const bearerUid = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
    mockGetUser.mockResolvedValue({ data: { user: { id: bearerUid } }, error: null })

    const req = new Request("http://localhost/api/test", {
      headers: {
        authorization: `Bearer ${validJwt()}`,
        cookie: `sb-access-token=${encodeURIComponent(validJwt({ sub: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb" }))}`,
      },
    })
    const result = await requireAuthenticatedUser(req)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(bearerUid)
  })
})

// ── Supabase returns an error — local auth disabled ───────────────────────────

describe("requireAuthenticatedUser — Supabase error, local auth disabled", () => {
  beforeEach(() => {
    mockLocalAuth.mockReturnValue(false)
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "JWT expired" } })
  })

  it("returns 401 with 'Invalid or expired session' message", async () => {
    const result = await requireAuthenticatedUser(bearerRequest(validJwt()))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      const body = await result.response.json() as { error: string }
      expect(body.error).toMatch(/invalid or expired session/i)
    }
  })
})

// ── Supabase returns an error — local auth enabled ────────────────────────────

describe("requireAuthenticatedUser — Supabase error, local auth enabled", () => {
  beforeEach(() => {
    mockLocalAuth.mockReturnValue(true)
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "JWT expired" } })
  })

  it("falls back to JWT sub when token is valid and not expired", async () => {
    const result = await requireAuthenticatedUser(bearerRequest(validJwt()))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(VALID_UUID)
  })

  it("returns 401 when JWT sub is not a valid UUID", async () => {
    const result = await requireAuthenticatedUser(bearerRequest(makeJwt({ sub: "not-a-uuid", exp: 9999999999 })))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it("returns 401 when JWT is already expired (exp in the past)", async () => {
    const expiredToken = makeJwt({ sub: VALID_UUID, exp: Math.floor(Date.now() / 1000) - 60 })
    const result = await requireAuthenticatedUser(bearerRequest(expiredToken))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it("returns 401 when the token has no sub claim", async () => {
    const result = await requireAuthenticatedUser(bearerRequest(makeJwt({ exp: 9999999999 })))
    expect(result.ok).toBe(false)
  })

  it("returns 401 when the token is malformed (not 3-part JWT)", async () => {
    const result = await requireAuthenticatedUser(bearerRequest("not.ajwt"))
    expect(result.ok).toBe(false)
  })
})

// ── Supabase throws an exception ─────────────────────────────────────────────

describe("requireAuthenticatedUser — Supabase throws", () => {
  it("returns 401 and logs the error when local auth is disabled", async () => {
    mockLocalAuth.mockReturnValue(false)
    mockGetUser.mockRejectedValue(new Error("Network error"))

    const result = await requireAuthenticatedUser(bearerRequest(validJwt()))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      const body = await result.response.json() as { error: string }
      expect(body.error).toMatch(/invalid or expired session/i)
    }
    expect(mockLogError).toHaveBeenCalledOnce()
  })

  it("returns 500 when error message indicates missing Supabase config", async () => {
    mockLocalAuth.mockReturnValue(false)
    mockGetUser.mockRejectedValue(new Error("Missing Supabase env vars"))

    const result = await requireAuthenticatedUser(bearerRequest(validJwt()))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(500)
      const body = await result.response.json() as { error: string }
      expect(body.error).toMatch(/unable to verify authentication/i)
    }
  })

  it("falls back to JWT sub when local auth is enabled and token is valid", async () => {
    mockLocalAuth.mockReturnValue(true)
    mockGetUser.mockRejectedValue(new Error("Network error"))

    const result = await requireAuthenticatedUser(bearerRequest(validJwt()))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(VALID_UUID)
    // Does NOT log the error because the fallback succeeded
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("returns 401 and logs when local auth fallback also fails (expired JWT)", async () => {
    mockLocalAuth.mockReturnValue(true)
    mockGetUser.mockRejectedValue(new Error("Network error"))

    const expiredToken = makeJwt({ sub: VALID_UUID, exp: Math.floor(Date.now() / 1000) - 10 })
    const result = await requireAuthenticatedUser(bearerRequest(expiredToken))
    expect(result.ok).toBe(false)
    expect(mockLogError).toHaveBeenCalledOnce()
  })
})
