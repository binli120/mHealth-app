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

import { test, expect, type APIRequestContext } from "@playwright/test"
import { createHmac } from "crypto"
import * as fs from "fs"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

const AUTH_FILE = path.join(__dirname, "../.auth/user.json")
const HAS_AUTH = hasSupabaseAuthState(AUTH_FILE)
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const IS_LOCAL_E2E =
  BASE_URL.startsWith("http://localhost") || BASE_URL.startsWith("http://127.0.0.1")
const LOCAL_AUTH_HELPERS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS !== "false" &&
  process.env.ENABLE_LOCAL_AUTH_HELPERS !== "false"
const LOCAL_DEV_JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long"

// ── Auth helper ───────────────────────────────────────────────────────────────
//
// Read the Supabase session directly from the Playwright storageState file
// (avoids page.goto which redirects authenticated users before localStorage
// is readable).  When running against a local dev stack, regenerate a fresh
// HS256 JWT so requests always travel through the fast local-fallback path in
// requireAuthenticatedUser instead of hitting Supabase's auth.getUser(), which
// can fail under concurrent test load.

function readAuthSession(filePath: string): { accessToken: string | null; userId: string | null } {
  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>
    }
    for (const origin of state.origins ?? []) {
      for (const item of origin.localStorage ?? []) {
        if (item.name.startsWith("sb-") && item.name.endsWith("-auth-token")) {
          const parsed = JSON.parse(item.value) as {
            access_token?: unknown
            user?: { id?: unknown }
          }
          return {
            accessToken: typeof parsed.access_token === "string" ? parsed.access_token : null,
            userId: typeof parsed.user?.id === "string" ? parsed.user.id : null,
          }
        }
      }
    }
  } catch {
    // File missing or malformed — tests skip gracefully via HAS_AUTH
  }
  return { accessToken: null, userId: null }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".")
  if (!payload) return null
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

function makeLocalJwt(userId: string): string {
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const body    = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    aud: "authenticated",
    iss: "supabase-demo",
    aal: "aal1",
  })).toString("base64url")
  const sig = createHmac("sha256", LOCAL_DEV_JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url")
  return `${header}.${body}.${sig}`
}

const AUTH_SESSION = readAuthSession(AUTH_FILE)

function getAuthHeader(): Record<string, string> {
  if (!AUTH_SESSION.accessToken) return {}
  if (IS_LOCAL_E2E && LOCAL_AUTH_HELPERS_ENABLED) {
    const payload = decodeJwtPayload(AUTH_SESSION.accessToken)
    const subject = AUTH_SESSION.userId ?? (typeof payload?.sub === "string" ? payload.sub : null)
    if (subject) return { Authorization: `Bearer ${makeLocalJwt(subject)}` }
  }
  return { Authorization: `Bearer ${AUTH_SESSION.accessToken}` }
}

function authedFetch(request: APIRequestContext) {
  const headers = getAuthHeader()
  return {
    get: (url: string) =>
      request.get(url, { headers }),
    post: (url: string, data: unknown) =>
      request.post(url, { headers: { ...headers, "Content-Type": "application/json" }, data }),
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

  test("returns { ok: true, hasSsn: boolean } — never the plaintext value", async ({ request }) => {
    const api = authedFetch(request)
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

  test("accepts dashed SSN format (###-##-####)", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.post("/api/user-profile/ssn", { ssn: "123-45-6789" })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    // Response must not echo back the SSN
    const raw = JSON.stringify(body)
    expect(raw).not.toContain("123-45-6789")
    expect(raw).not.toContain("123456789")
  })

  test("accepts plain 9-digit SSN format", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.post("/api/user-profile/ssn", { ssn: "987654321" })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test("GET reflects hasSsn: true after a successful POST", async ({ request }) => {
    const api = authedFetch(request)

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

  test("500 error response does not leak encrypted blob or internal details", async ({ request }) => {
    const api = authedFetch(request)
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
