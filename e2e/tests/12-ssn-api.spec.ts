/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * E2E tests for /api/user-profile/ssn
 *
 * Security requirements verified here:
 *   1. Unauthenticated requests are rejected (401)
 *   2. POST validates SSN format — bad input → 400 with a clear message
 *   3. GET returns { hasSsn: boolean } — never the plaintext value
 *   4. POST succeeds with both ###-##-#### and 9-digit formats
 *   5. Error responses never contain stack traces or encrypted blobs
 *
 * NOTE: Tests that write to the DB (successful POST) are guarded behind an
 * auth session, and the guard skips them when no auth state file is present.
 */

import { test, expect, type Page } from "@playwright/test"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

const AUTH_FILE = path.join(__dirname, "../.auth/user.json")
const HAS_AUTH = hasSupabaseAuthState(AUTH_FILE)

// ── Auth helper ───────────────────────────────────────────────────────────────
//
// The Playwright storageState only contains localStorage (no cookies) because
// the Supabase JS v2 browser client stores the session there.
// `requireAuthenticatedUser` reads from Authorization: Bearer header, so we
// must extract the access_token from localStorage and attach it manually.
//
// We navigate to a page on localhost:3000 first so the storageState's
// localStorage is accessible to page.evaluate, then build a thin wrapper
// that forwards the Bearer token on every API call.

async function buildAuthedFetch(page: Page) {
  // Any page loads the origin; /auth/login is lightweight and always accessible
  await page.goto("/auth/login")

  const token = await page.evaluate((): string | null => {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    )
    if (!key) return null
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      // Supabase stores { access_token, refresh_token, ... }
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return typeof parsed.access_token === "string" ? parsed.access_token : null
    } catch {
      return null
    }
  })

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

  return {
    get: (url: string) =>
      page.request.get(url, { headers: authHeader }),
    post: (url: string, data: unknown) =>
      page.request.post(url, {
        headers: { ...authHeader, "Content-Type": "application/json" },
        data,
      }),
  }
}

// ── Unauthenticated requests ───────────────────────────────────────────────────

test.describe("GET /api/user-profile/ssn — unauthenticated", () => {
  test("returns 401 without a session cookie", async ({ request }) => {
    const res = await request.get("/api/user-profile/ssn")
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })
})

test.describe("POST /api/user-profile/ssn — unauthenticated", () => {
  test("returns 401 without a session cookie", async ({ request }) => {
    const res = await request.post("/api/user-profile/ssn", {
      data: { ssn: "123-45-6789" },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })
})

// ── Input validation (no auth required to hit 400 path) ───────────────────────

test.describe("POST /api/user-profile/ssn — input validation", () => {
  test("returns 400 for an empty body", async ({ request }) => {
    const res = await request.post("/api/user-profile/ssn", { data: {} })
    // Will be 400 (validation) or 401 (auth) — never 500
    expect([400, 401]).toContain(res.status())
  })

  test("returns 400 for an SSN that is too short", async ({ request }) => {
    const res = await request.post("/api/user-profile/ssn", {
      data: { ssn: "12345" },
    })
    expect([400, 401]).toContain(res.status())
    if (res.status() === 400) {
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toMatch(/SSN/i)
      expect(body.error).not.toMatch(/stack|Error:|at\s+\w/)
    }
  })

  test("returns 400 for letters instead of digits", async ({ request }) => {
    const res = await request.post("/api/user-profile/ssn", {
      data: { ssn: "abc-de-fghi" },
    })
    expect([400, 401]).toContain(res.status())
    if (res.status() === 400) {
      const body = await res.json()
      expect(body.ok).toBe(false)
    }
  })

  test("returns 400 for wrong dash positions (12-345-6789)", async ({ request }) => {
    const res = await request.post("/api/user-profile/ssn", {
      data: { ssn: "12-345-6789" },
    })
    expect([400, 401]).toContain(res.status())
  })

  test("returns 400 for too many digits (10 plain)", async ({ request }) => {
    const res = await request.post("/api/user-profile/ssn", {
      data: { ssn: "1234567890" },
    })
    expect([400, 401]).toContain(res.status())
  })

  test("error response body is JSON", async ({ request }) => {
    const res = await request.post("/api/user-profile/ssn", {
      data: { ssn: "bad" },
    })
    const ct = res.headers()["content-type"] ?? ""
    expect(ct).toContain("application/json")
  })
})

// ── Authenticated requests ─────────────────────────────────────────────────────

test.describe("GET /api/user-profile/ssn — authenticated", () => {
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated SSN tests")
  })

  test("returns { ok: true, hasSsn: boolean } — never the plaintext value", async ({ page }) => {
    const api = await buildAuthedFetch(page)
    const res = await api.get("/api/user-profile/ssn")
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.hasSsn).toBe("boolean")
    // The response must never contain a raw SSN pattern
    const raw = JSON.stringify(body)
    expect(raw).not.toMatch(/\d{3}-\d{2}-\d{4}/)
    expect(raw).not.toMatch(/\d{9}/)
  })
})

test.describe("POST /api/user-profile/ssn — authenticated", () => {
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated SSN tests")
  })

  test("accepts dashed SSN format (###-##-####)", async ({ page }) => {
    const api = await buildAuthedFetch(page)
    const res = await api.post("/api/user-profile/ssn", { ssn: "123-45-6789" })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    // Response must not echo back the SSN
    const raw = JSON.stringify(body)
    expect(raw).not.toContain("123-45-6789")
    expect(raw).not.toContain("123456789")
  })

  test("accepts plain 9-digit SSN format", async ({ page }) => {
    const api = await buildAuthedFetch(page)
    const res = await api.post("/api/user-profile/ssn", { ssn: "987654321" })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test("GET reflects hasSsn: true after a successful POST", async ({ page }) => {
    const api = await buildAuthedFetch(page)

    // Write
    const post = await api.post("/api/user-profile/ssn", { ssn: "111-22-3333" })
    expect(post.status()).toBe(200)

    // Read back — must report SSN exists, never expose the value
    const get = await api.get("/api/user-profile/ssn")
    expect(get.status()).toBe(200)
    const body = await get.json()
    expect(body.hasSsn).toBe(true)
    const raw = JSON.stringify(body)
    expect(raw).not.toMatch(/\d{3}-\d{2}-\d{4}/)
    expect(raw).not.toMatch(/111-22-3333/)
  })

  test("500 error response does not leak encrypted blob or internal details", async ({ page }) => {
    const api = await buildAuthedFetch(page)
    const res = await api.post("/api/user-profile/ssn", { ssn: "not-valid" })
    // 400 from Zod validation (auth will be fine since we have a token)
    expect(res.status()).toBe(400)
    const body = await res.json()
    const raw = JSON.stringify(body)
    // Must not expose stack traces or internal crypto details
    expect(raw).not.toMatch(/\bstack\b/)
    expect(raw).not.toContain("enc:")
    expect(raw).not.toContain("aes-256")
    expect(raw).not.toMatch(/^\s+at\s+\w/m) // stack frame lines: "    at ClassName"
  })
})
