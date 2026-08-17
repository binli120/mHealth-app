/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 *
 * E2E tests for the shared request-validation module (lib/api/validation.ts)
 * as applied across the auth, application, and user-profile routes.
 *
 * Two kinds of routes are covered here:
 *   1. Public routes (session-cookie, reset-mfa, invite/[token]) — validation
 *      runs before any auth check, so bad input always surfaces as 400
 *      without needing a session.
 *   2. Auth-gated routes (applications, draft, confirm-review, user-profile,
 *      user-profile/applicant) — auth is checked before validation, so an
 *      unauthenticated request with a bad body/param returns 401, never 400.
 *      The 400-producing validation checks for these routes run only under
 *      an authenticated session (skipped gracefully when none is available,
 *      matching the existing 12-ssn-api.spec.ts convention).
 *
 * None of these tests write meaningful data — they only assert status codes
 * and error-shape for known-bad input.
 */

import { test, expect, type APIRequestContext } from "@playwright/test"
import { createHmac } from "crypto"
import * as fs from "fs"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

const AUTH_FILE = path.join(__dirname, "../.auth/user.json")
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const IS_LOCAL_E2E =
  BASE_URL.startsWith("http://localhost") || BASE_URL.startsWith("http://127.0.0.1")

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const IS_CLOUD_SUPABASE =
  Boolean(SUPABASE_URL) &&
  !SUPABASE_URL.includes("localhost") &&
  !SUPABASE_URL.includes("127.0.0.1")
const LOCAL_AUTH_HELPERS_ENABLED =
  !IS_CLOUD_SUPABASE &&
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS !== "false" &&
  process.env.ENABLE_LOCAL_AUTH_HELPERS !== "false"
const LOCAL_DEV_JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long"

const HAS_AUTH =
  !IS_CLOUD_SUPABASE &&
  hasSupabaseAuthState(AUTH_FILE) &&
  LOCAL_AUTH_HELPERS_ENABLED

// ── Auth helper (mirrors 12-ssn-api.spec.ts) ────────────────────────────────

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
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify({
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
    get: (url: string) => request.get(url, { headers }),
    post: (url: string, data: unknown) =>
      request.post(url, { headers: { ...headers, "Content-Type": "application/json" }, data }),
    put: (url: string, data: unknown) =>
      request.put(url, { headers: { ...headers, "Content-Type": "application/json" }, data }),
    patch: (url: string) => request.patch(url, { headers }),
    delete: (url: string) => request.delete(url, { headers }),
  }
}

function expectJsonError(status: number, body: { ok: boolean; error?: string }) {
  expect(status).toBe(400)
  expect(body.ok).toBe(false)
  expect(body.error).toBeTruthy()
}

// ── POST /api/auth/session-cookie — public, validation before auth ─────────

test.describe("POST /api/auth/session-cookie — input validation", () => {
  test("returns 400 for malformed JSON", async ({ request }) => {
    const res = await request.post("/api/auth/session-cookie", {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    })
    expect(res.status()).toBe(400)
  })

  test("returns 400 when accessToken is missing", async ({ request }) => {
    const res = await request.post("/api/auth/session-cookie", { data: {} })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  test("returns 400 when accessToken is an empty string", async ({ request }) => {
    const res = await request.post("/api/auth/session-cookie", { data: { accessToken: "   " } })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  test("returns 401 (not 500) for a well-formed but invalid token", async ({ request }) => {
    const res = await request.post("/api/auth/session-cookie", {
      data: { accessToken: "not-a-real-jwt" },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })
})

// ── POST /api/auth/reset-mfa — public, no user enumeration ─────────────────

test.describe("POST /api/auth/reset-mfa — input validation", () => {
  test("returns 400 when email is missing", async ({ request }) => {
    const res = await request.post("/api/auth/reset-mfa", { data: {} })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  test("returns 400 for an email without an @", async ({ request }) => {
    const res = await request.post("/api/auth/reset-mfa", { data: { email: "not-an-email" } })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  test("returns 200 ok:true for a well-formed email even if the account doesn't exist", async ({ request }) => {
    const res = await request.post("/api/auth/reset-mfa", {
      data: { email: "definitely-not-a-real-account@masshealth-test.local" },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})

// ── POST /api/auth/invite/[token] — public, token-scoped ───────────────────

test.describe("POST /api/auth/invite/[token] — input validation", () => {
  test("returns 400 for a password under 8 characters", async ({ request }) => {
    const res = await request.post("/api/auth/invite/e2e-fake-invite-token", {
      data: { password: "short" },
    })
    const body = await res.json()
    expectJsonError(res.status(), body)
    expect(body.error).toMatch(/8 characters/i)
  })

  test("returns 400 when password is missing entirely", async ({ request }) => {
    const res = await request.post("/api/auth/invite/e2e-fake-invite-token", { data: {} })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })
})

// ── /api/applications — auth-gated: unauthenticated always 401 ─────────────

test.describe("/api/applications — unauthenticated", () => {
  test("GET returns 401 regardless of query validity", async ({ request }) => {
    const res = await request.get("/api/applications?status=bogus")
    expect(res.status()).toBe(401)
  })

  test("POST returns 401 regardless of body validity", async ({ request }) => {
    const res = await request.post("/api/applications", { data: { applicationId: "not-a-uuid" } })
    expect(res.status()).toBe(401)
  })
})

test.describe("/api/applications/[id]/confirm-review — unauthenticated", () => {
  test("PATCH returns 401 regardless of applicationId validity", async ({ request }) => {
    const res = await request.patch("/api/applications/not-a-uuid/confirm-review")
    expect(res.status()).toBe(401)
  })
})

test.describe("/api/applications/[id]/draft — unauthenticated", () => {
  test("GET returns 401 regardless of applicationId validity", async ({ request }) => {
    const res = await request.get("/api/applications/not-a-uuid/draft")
    expect(res.status()).toBe(401)
  })

  test("PUT returns 401 regardless of body validity", async ({ request }) => {
    const res = await request.put("/api/applications/not-a-uuid/draft", { data: {} })
    expect(res.status()).toBe(401)
  })
})

// ── /api/user-profile — auth-gated: unauthenticated always 401 ─────────────

test.describe("/api/user-profile — unauthenticated", () => {
  test("PUT returns 401 regardless of body validity", async ({ request }) => {
    const res = await request.put("/api/user-profile", { data: { section: "bogus" } })
    expect(res.status()).toBe(401)
  })
})

test.describe("/api/user-profile/applicant — unauthenticated", () => {
  test("PUT returns 401 regardless of body validity", async ({ request }) => {
    const res = await request.put("/api/user-profile/applicant", { data: { zip: "bad" } })
    expect(res.status()).toBe(401)
  })
})

// ── Authenticated validation checks ─────────────────────────────────────────
// Auth runs before validation on these routes, so a 400 can only be observed
// with a real session. Skips gracefully when no local auth session is available
// (e.g. against cloud Supabase, per the 12-ssn-api.spec.ts convention).

test.describe("Authenticated validation — /api/applications", () => {
  test.use({ storageState: AUTH_FILE })
  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated validation tests")
  })

  test("GET rejects an unknown status filter", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.get("/api/applications?status=bogus_status")
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  test("GET rejects a negative offset", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.get("/api/applications?offset=-1")
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  test("POST rejects a non-UUID applicationId", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.post("/api/applications", { applicationId: "not-a-uuid" })
    const body = await res.json()
    expectJsonError(res.status(), body)
    expect(body.error).toMatch(/UUID/i)
  })

  test("GET accepts a valid status filter", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.get("/api/applications?status=draft")
    expect(res.status()).toBe(200)
  })
})

test.describe("Authenticated validation — /api/applications/[id]/confirm-review", () => {
  test.use({ storageState: AUTH_FILE })
  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated validation tests")
  })

  test("PATCH rejects a non-UUID applicationId", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.patch("/api/applications/not-a-uuid/confirm-review")
    const body = await res.json()
    expectJsonError(res.status(), body)
  })
})

test.describe("Authenticated validation — /api/applications/[id]/draft", () => {
  test.use({ storageState: AUTH_FILE })
  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated validation tests")
  })

  test("GET rejects a non-UUID applicationId", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.get("/api/applications/not-a-uuid/draft")
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  const VALID_APPLICATION_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"

  test("PUT rejects a missing wizardState", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.put(`/api/applications/${VALID_APPLICATION_ID}/draft`, {})
    const body = await res.json()
    expectJsonError(res.status(), body)
    expect(body.error).toMatch(/wizardState/i)
  })

  test("PUT rejects an invalid applicationType", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.put(`/api/applications/${VALID_APPLICATION_ID}/draft`, {
      wizardState: {},
      applicationType: "Not Valid!",
    })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })
})

test.describe("Authenticated validation — /api/user-profile", () => {
  test.use({ storageState: AUTH_FILE })
  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated validation tests")
  })

  test("PUT rejects an unknown section", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.put("/api/user-profile", { section: "bogus", data: {} })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  test("PUT rejects a bank routing number that isn't 9 digits", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.put("/api/user-profile", {
      section: "bank",
      data: { bankName: "Chase", accountType: "checking", routingNumber: "123", accountNumber: "12345678" },
    })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })
})

test.describe("Authenticated validation — /api/user-profile/applicant", () => {
  test.use({ storageState: AUTH_FILE })
  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated validation tests")
  })

  test("PUT rejects an invalid phone number", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.put("/api/user-profile/applicant", { phone: "abc" })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  test("PUT rejects an invalid ZIP code", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.put("/api/user-profile/applicant", { zip: "abc" })
    const body = await res.json()
    expectJsonError(res.status(), body)
  })

  test("PUT accepts a valid partial update", async ({ request }) => {
    const api = authedFetch(request)
    const res = await api.put("/api/user-profile/applicant", { phone: "(617) 555-0199" })
    expect(res.status()).toBe(200)
  })
})
