/**
 * E2E security tests for dev-only auth API routes.
 *
 * These routes (/api/auth/dev-register, dev-grant-admin, dev-auto-confirm)
 * bypass Supabase Auth and must:
 *   1. Return 404 when the local-auth-helper flag is disabled
 *   2. Reject unauthenticated requests to role-granting endpoints
 *   3. Reject malformed input with 400 (not 500 or a data leak)
 *   4. Never expose stack traces or internal state in error responses
 *
 * The e2e server runs in development mode with local auth helpers enabled,
 * so tests exercise both the "enabled" path and the "disabled" path (by
 * passing the X-Disable-Local-Auth-Helpers header, or by verifying that
 * endpoints enforce auth even when the helper flag is on).
 *
 * NOTE: The production hard-block (NODE_ENV=production → always 404) is
 * covered by unit tests in lib/auth/__tests__/local-auth.test.ts and
 * __tests__/instrumentation.test.ts.  E2E tests here focus on runtime
 * behaviour of the live dev server.
 */

import { test, expect } from "@playwright/test"

function skipIfDevRegisterUnavailable(status: number): void {
  if (status === 404) {
    test.skip(true, "dev-register not available — local auth helpers disabled on this server")
  }
}

// ── /api/auth/dev-register ─────────────────────────────────────────────────────

test.describe("POST /api/auth/dev-register — input validation", () => {
  test("returns 400 when email is missing", async ({ request }) => {
    const res = await request.post("/api/auth/dev-register", {
      data: { password: "ValidPass1!" },
    })
    skipIfDevRegisterUnavailable(res.status())
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(typeof body.error).toBe("string")
  })

  test("returns 400 when email is malformed", async ({ request }) => {
    const res = await request.post("/api/auth/dev-register", {
      data: { email: "not-an-email", password: "ValidPass1!" },
    })
    skipIfDevRegisterUnavailable(res.status())
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test("returns 400 when password is too short", async ({ request }) => {
    const res = await request.post("/api/auth/dev-register", {
      data: { email: "test@example.com", password: "short" },
    })
    skipIfDevRegisterUnavailable(res.status())
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test("returns 400 when body is empty JSON", async ({ request }) => {
    const res = await request.post("/api/auth/dev-register", {
      data: {},
    })
    skipIfDevRegisterUnavailable(res.status())
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test("error response does not expose a stack trace", async ({ request }) => {
    const res = await request.post("/api/auth/dev-register", {
      data: { email: "bad", password: "x" },
    })
    const text = await res.text()
    expect(text).not.toMatch(/at\s+\w+\s+\(.*\.ts:\d+:\d+\)/)
    expect(text).not.toContain("node_modules")
  })

  test("successful registration returns ok:true and a userId", async ({ request }) => {
    const unique = `e2e.security.${Date.now()}@masshealth-test.local`
    const res = await request.post("/api/auth/dev-register", {
      data: {
        email: unique,
        password: "SecurePass@2026!",
        firstName: "Security",
        lastName: "Test",
      },
    })

    if (res.status() === 404) {
      // Local auth helpers disabled (e.g. targeting a remote/staging server)
      test.skip(true, "dev-register not available — local auth helpers disabled on this server")
      return
    }

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.userId).toBe("string")
    expect(body.userId.length).toBeGreaterThan(0)
  })
})

// ── /api/auth/dev-grant-admin ──────────────────────────────────────────────────

test.describe("POST /api/auth/dev-grant-admin — authentication required", () => {
  test("returns 401 when called without an Authorization header", async ({ request }) => {
    const res = await request.post("/api/auth/dev-grant-admin")
    // 401 Unauthorized or 404 (if helpers disabled) — never 200
    expect([401, 403, 404]).toContain(res.status())
  })

  test("returns 401 when called with a bogus Bearer token", async ({ request }) => {
    const res = await request.post("/api/auth/dev-grant-admin", {
      headers: { Authorization: "Bearer this.is.not.a.real.jwt" },
    })
    expect([401, 403, 404]).toContain(res.status())
  })

  test("error response does not expose internal role data", async ({ request }) => {
    const res = await request.post("/api/auth/dev-grant-admin", {
      headers: { Authorization: "Bearer fake.token.here" },
    })
    const text = await res.text()
    // Must not leak role IDs or DB row data in error responses
    expect(text).not.toMatch(/"role_id"\s*:/)
    expect(text).not.toContain("pg_query")
    expect(text).not.toContain("public.roles")
  })
})

// ── /api/auth/dev-auto-confirm ─────────────────────────────────────────────────

test.describe("POST /api/auth/dev-auto-confirm — input validation", () => {
  test("returns 400 when neither userId nor email is provided", async ({ request }) => {
    const res = await request.post("/api/auth/dev-auto-confirm", {
      data: {},
    })

    if (res.status() === 404) {
      test.skip(true, "dev-auto-confirm not available — local auth helpers disabled")
      return
    }

    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test("returns 400 when userId is not a valid UUID", async ({ request }) => {
    const res = await request.post("/api/auth/dev-auto-confirm", {
      data: { userId: "not-a-uuid" },
    })

    if (res.status() === 404) {
      test.skip(true, "dev-auto-confirm not available — local auth helpers disabled")
      return
    }

    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test("returns 404 when a valid UUID that does not exist is supplied", async ({ request }) => {
    // Use a properly formatted v4 UUID (version nibble = 4, variant nibble = b)
    // that will never exist in the database.
    const res = await request.post("/api/auth/dev-auto-confirm", {
      data: { userId: "ffffffff-ffff-4fff-bfff-ffffffffffff" },
    })

    if (res.status() === 404) {
      // Could be helpers disabled OR user not found — both are acceptable
      const body = await res.json().catch(() => ({}))
      // If helpers disabled, body.error would be "Not found"
      // If user not found, body.error would be "User not found in auth.users."
      expect(typeof (body as { error?: string }).error).toBe("string")
      return
    }

    // If helpers are enabled the non-existent UUID should produce 404
    expect(res.status()).toBe(404)
  })

  test("error response does not leak stack traces", async ({ request }) => {
    const res = await request.post("/api/auth/dev-auto-confirm", {
      data: { userId: "not-a-uuid" },
    })
    const text = await res.text()
    expect(text).not.toMatch(/at\s+\w+\s+\(.*\.ts:\d+:\d+\)/)
    expect(text).not.toContain("node_modules")
  })
})

// ── Cross-cutting: all dev routes return JSON ──────────────────────────────────

test.describe("dev auth routes — response format", () => {
  const routes = [
    "/api/auth/dev-register",
    "/api/auth/dev-grant-admin",
    "/api/auth/dev-auto-confirm",
  ]

  for (const route of routes) {
    test(`${route} always responds with Content-Type: application/json`, async ({ request }) => {
      const res = await request.post(route, { data: {} })
      const contentType = res.headers()["content-type"] ?? ""
      expect(contentType).toContain("application/json")
    })
  }
})
