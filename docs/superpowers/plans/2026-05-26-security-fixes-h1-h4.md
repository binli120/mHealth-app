# Security Fixes H1–H4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four high-severity security vulnerabilities: fail-close the RAG ingest secret, prevent dev auth routes from opening against cloud databases, enforce `expiresAt` on mobile upload sessions, and replace missing/single-process rate limiting with a Postgres-backed implementation that works across all instances.

**Architecture:** Each task is independent and safe to deploy individually in priority order (H3 → H4 → H2 → H1). H1 introduces a `DbRateLimiter` backed by a new `rate_limit_counters` Supabase table; it replaces `RateLimiter` (in-memory) on the five routes that currently have no limiting or single-process-only limiting.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase Postgres (via `pg` pool), Vitest, `pnpm vitest run`

---

## File Map

| Action | Path | Change |
|---|---|---|
| Modify | `app/api/rag/ingest/route.ts` | Fail-closed: 403 when `RAG_INGEST_SECRET` is unset |
| Create | `app/api/rag/ingest/__tests__/route.test.ts` | Tests for secret-absent rejection |
| Modify | `lib/auth/local-auth.ts` | `isLocalAuthHelperEnabled()`: explicit flag AND local DB required |
| Modify | `lib/auth/__tests__/local-auth.test.ts` | Add staging-with-cloud-Supabase cases |
| Modify | `app/api/upload/mobile/[token]/route.ts` | Enforce `expiresAt` timestamp + add per-token rate limit |
| Modify | `app/api/upload/mobile/[token]/__tests__/route.test.ts` | Add expiry + rate-limit cases |
| Create | `supabase/migrations/20260526010000_rate_limit_counters.sql` | New table + cleanup function |
| Modify | `lib/server/rate-limit.ts` | Add `DbRateLimiter`, add 5 new limiter instances |
| Create | `lib/server/__tests__/db-rate-limit.test.ts` | Unit tests for `DbRateLimiter` |
| Modify | `app/api/user-profile/ssn/route.ts` | Apply SSN limiter (currently only logs IP) |
| Modify | `app/api/agents/chat/route.ts` | Apply AI chat limiter |
| Modify | `app/api/identity/verify-license/route.ts` | Apply identity-verify limiter |
| Modify | `app/api/applications/[applicationId]/documents/route.ts` | Apply document-upload limiter |

---

## Task 1: H3 — RAG Ingest Fail-Closed

**Files:**
- Modify: `app/api/rag/ingest/route.ts:49-58`
- Create: `app/api/rag/ingest/__tests__/route.test.ts`

### Background

The current code only checks the secret if the env var is set:
```typescript
const ingestSecret = process.env.RAG_INGEST_SECRET
if (ingestSecret) {          // ← skipped entirely if env var is absent
  const providedKey = ...
  if (providedKey !== ingestSecret) { return 403 }
}
```
An authenticated user on any staging env without `RAG_INGEST_SECRET` can inject arbitrary content into the vector store.

- [ ] **Step 1: Write the failing test**

Create `app/api/rag/ingest/__tests__/route.test.ts`:

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn().mockResolvedValue({
    ok: true,
    userId: "11111111-1111-4111-8111-111111111111",
    response: null,
  }),
}))

vi.mock("@/lib/rag/ingest", () => ({
  ingestAllDocuments: vi.fn().mockResolvedValue([]),
  POLICY_SOURCES: [],
}))

vi.mock("@/lib/server/logger", () => ({ logServerError: vi.fn() }))

// Lazy import after mocks are set up
async function importRoute() {
  const mod = await import("@/app/api/rag/ingest/route")
  return mod.POST
}

describe("POST /api/rag/ingest — secret guard", () => {
  const originalEnv = process.env.RAG_INGEST_SECRET

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.RAG_INGEST_SECRET
    else process.env.RAG_INGEST_SECRET = originalEnv
    vi.resetModules()
  })

  it("returns 403 when RAG_INGEST_SECRET is not set", async () => {
    delete process.env.RAG_INGEST_SECRET
    const POST = await importRoute()
    const req = new NextRequest("http://localhost/api/rag/ingest", {
      method: "POST",
      body: "",
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it("returns 403 when RAG_INGEST_SECRET is set but no key provided", async () => {
    process.env.RAG_INGEST_SECRET = "correct-secret"
    const POST = await importRoute()
    const req = new NextRequest("http://localhost/api/rag/ingest", {
      method: "POST",
      body: "",
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("returns 403 when wrong key is provided", async () => {
    process.env.RAG_INGEST_SECRET = "correct-secret"
    const POST = await importRoute()
    const req = new NextRequest("http://localhost/api/rag/ingest", {
      method: "POST",
      headers: { "x-ingest-key": "wrong-secret" },
      body: "",
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("allows the request when the correct key is provided", async () => {
    process.env.RAG_INGEST_SECRET = "correct-secret"
    const POST = await importRoute()
    const req = new NextRequest("http://localhost/api/rag/ingest", {
      method: "POST",
      headers: { "x-ingest-key": "correct-secret" },
      body: "",
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm vitest run app/api/rag/ingest/__tests__/route.test.ts
```

Expected: the "returns 403 when RAG_INGEST_SECRET is not set" test fails because the route currently returns 200.

- [ ] **Step 3: Fix `app/api/rag/ingest/route.ts`**

Replace lines 49–58 (the `if (ingestSecret) { ... }` block):

```typescript
  // ── Auth: must supply ingest secret (protects against non-staff users) ───
  const ingestSecret = process.env.RAG_INGEST_SECRET
  if (!ingestSecret) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — endpoint not configured." },
      { status: 403 },
    )
  }
  const providedKey = request.headers.get("x-ingest-key")
  if (providedKey !== ingestSecret) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — invalid ingest key." },
      { status: 403 },
    )
  }
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
pnpm vitest run app/api/rag/ingest/__tests__/route.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/rag/ingest/route.ts app/api/rag/ingest/__tests__/route.test.ts
git commit -m "fix(security): fail-closed RAG ingest when RAG_INGEST_SECRET is unset (H3)"
```

---

## Task 2: H4 — Dev Auth Explicit + Local DB Required

**Files:**
- Modify: `lib/auth/local-auth.ts`
- Modify: `lib/auth/__tests__/local-auth.test.ts`

### Background

`isLocalAuthHelperEnabled()` has two flaws:

1. When `ENABLE_LOCAL_AUTH_HELPERS=true` is explicitly set, it trusts the flag without verifying the database is local. A staging server with cloud Supabase and this flag set exposes `/api/auth/dev-grant-admin` to any authenticated user.

2. The `resolveLocalRuntime()` fallback checks `window.location.hostname` in a jsdom environment — that path returns `true` in any jsdom test runner that doesn't override the hostname. While test environments are expected, the implicit auto-enable on `window.hostname === "localhost"` should not apply when a cloud database is present.

**Fix:** When the explicit flag is `true`, additionally require the database to be local. The security invariant becomes: *dev routes are only enabled when BOTH the flag is set AND the Supabase/DB URL is localhost.*

- [ ] **Step 1: Write the failing tests**

Add to `lib/auth/__tests__/local-auth.test.ts` — append after the last `describe` block:

```typescript
// ── isLocalAuthHelperEnabled — cloud DB + explicit flag (staging guard) ───────
//
// Even when ENABLE_LOCAL_AUTH_HELPERS is explicitly set to "true", the routes
// must be blocked if the database is cloud-hosted.  This prevents a staging
// server with a real Supabase instance from accidentally exposing dev routes.

describe("isLocalAuthHelperEnabled — explicit true blocked by cloud DB", () => {
  it("returns false when flag is true but Supabase URL is cloud", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({
        NODE_ENV: "development",
        NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "true",
        NEXT_PUBLIC_SUPABASE_URL: "https://xyz.supabase.co",
      }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("returns false when server-side flag is true but DATABASE_URL is remote", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({
        NODE_ENV: "development",
        ENABLE_LOCAL_AUTH_HELPERS: "true",
        DATABASE_URL: "postgres://user:pass@prod.db.example.com:5432/db",
      }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("returns true when flag is true AND Supabase URL is local", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({
        NODE_ENV: "development",
        NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "true",
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(true)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("returns true when flag is true AND DATABASE_URL is local", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({
        NODE_ENV: "development",
        ENABLE_LOCAL_AUTH_HELPERS: "true",
        DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(true)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run lib/auth/__tests__/local-auth.test.ts
```

Expected: the two "returns false when flag is true but ... is cloud/remote" tests FAIL (currently return `true`).

- [ ] **Step 3: Implement the fix in `lib/auth/local-auth.ts`**

Replace the `isLocalAuthHelperEnabled()` function (lines 64–86):

```typescript
export function isLocalAuthHelperEnabled(): boolean {
  // Hard block in production — no flag can override this.
  if (process.env.NODE_ENV === "production") {
    return false
  }

  const explicit =
    parseBoolean(process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS) ??
    parseBoolean(process.env.ENABLE_LOCAL_AUTH_HELPERS)

  if (explicit === false) {
    return false
  }

  if (explicit === true) {
    // Even with an explicit opt-in, the database MUST be local.
    // This prevents a staging server with a cloud Supabase instance from
    // accidentally exposing dev routes when ENABLE_LOCAL_AUTH_HELPERS=true
    // is set in the environment.
    return resolveLocalRuntime()
  }

  // No explicit flag: auto-detect from connection URLs / window hostname.
  return resolveLocalRuntime()
}
```

- [ ] **Step 4: Run all local-auth tests**

```bash
pnpm vitest run lib/auth/__tests__/local-auth.test.ts
```

Expected: all tests PASS (the new 4 pass; existing tests are unaffected because the only behavior change is "explicit true + cloud DB → false").

- [ ] **Step 5: Commit**

```bash
git add lib/auth/local-auth.ts lib/auth/__tests__/local-auth.test.ts
git commit -m "fix(security): require local DB even when ENABLE_LOCAL_AUTH_HELPERS is explicitly true (H4)"
```

---

## Task 3: H2 — Mobile Upload: Enforce `expiresAt` + Rate Limit

**Files:**
- Modify: `app/api/upload/mobile/[token]/route.ts`
- Modify: `app/api/upload/mobile/[token]/__tests__/route.test.ts`

### Background

`MobileUploadSession` already has `expiresAt: string`, but the route only checks `session.status === "expired"` — it never compares the timestamp against `Date.now()`. If the background job that flips status to `"expired"` is delayed or missing, time-expired tokens remain usable.

Additionally, there is no rate limit on GET or POST, so an intercepted token can be probed or replayed without throttling.

- [ ] **Step 1: Write failing tests**

Add to `app/api/upload/mobile/[token]/__tests__/route.test.ts`. First, read the existing test file to find the right import block and append after existing tests:

The existing file already mocks `getUploadSessionByToken`. Add these test cases at the end:

```typescript
// ── expiresAt enforcement ─────────────────────────────────────────────────────

describe("POST /api/upload/mobile/[token] — expiresAt enforcement", () => {
  const PAST = new Date(Date.now() - 60_000).toISOString()   // 1 min ago
  const FUTURE = new Date(Date.now() + 60_000 * 60).toISOString() // 1 hr ahead

  const makeFile = () =>
    new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])],
      "test.jpg",
      { type: "image/jpeg" },
    )

  it("returns 410 when expiresAt has passed (even if status is still 'pending')", async () => {
    const { getUploadSessionByToken: mock } = await import("@/lib/db/mobile-upload-session")
    vi.mocked(mock).mockResolvedValueOnce({
      id: "sess-1",
      token: TOKEN,
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      documentType: "generic",
      requiredDocumentLabel: null,
      status: "pending",   // ← status not updated yet by cron
      documentId: null,
      createdAt: PAST,
      expiresAt: PAST,     // ← already expired by timestamp
      completedAt: null,
    })

    const form = new FormData()
    form.append("file", makeFile())
    const res = await POST(
      new Request(`http://localhost/api/upload/mobile/${TOKEN}`, { method: "POST", body: form }),
      { params: Promise.resolve({ token: TOKEN }) },
    )
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it("allows upload when expiresAt is in the future", async () => {
    const { getUploadSessionByToken: mock } = await import("@/lib/db/mobile-upload-session")
    const { insertDocument: insertMock } = await import("@/lib/db/documents")
    vi.mocked(mock).mockResolvedValueOnce({
      id: "sess-2",
      token: TOKEN,
      userId: USER_ID,
      applicationId: APPLICATION_ID,
      documentType: "generic",
      requiredDocumentLabel: null,
      status: "pending",
      documentId: null,
      createdAt: new Date().toISOString(),
      expiresAt: FUTURE,
      completedAt: null,
    })
    vi.mocked(insertMock).mockResolvedValueOnce({
      id: "doc-1",
      applicationId: APPLICATION_ID,
      uploadedBy: USER_ID,
      documentType: "generic",
      requiredDocumentLabel: null,
      fileName: "test.jpg",
      filePath: "path/test.jpg",
      thumbnailPath: null,
      pdfPath: null,
      fileSizeBytes: 12,
      mimeType: "image/jpeg",
      documentStatus: "uploaded",
      validationStatus: "valid",
      analysisDocumentType: null,
      validationError: null,
      validationSummary: null,
      validationCertificate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const form = new FormData()
    form.append("file", makeFile())
    const res = await POST(
      new Request(`http://localhost/api/upload/mobile/${TOKEN}`, { method: "POST", body: form }),
      { params: Promise.resolve({ token: TOKEN }) },
    )
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests to confirm the expiry test fails**

```bash
pnpm vitest run "app/api/upload/mobile/\[token\]/__tests__/route.test.ts"
```

Expected: "returns 410 when expiresAt has passed" FAILS (currently returns 200 because the route never checks `expiresAt`).

- [ ] **Step 3: Add `expiresAt` enforcement to the route**

In `app/api/upload/mobile/[token]/route.ts`, the POST handler already checks `session.status`. Add the timestamp check immediately after the existing `status !== "pending"` check (around line 107):

```typescript
  if (session.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "This session has already been used." },
      { status: 409 },
    )
  }

  // Enforce expiry by timestamp — do not rely solely on the status column,
  // which may not have been updated yet by the cleanup job.
  if (new Date(session.expiresAt) <= new Date()) {
    return NextResponse.json(
      { ok: false, error: "This upload link has expired. Please request a new QR code." },
      { status: 410 },
    )
  }
```

Apply the same `expiresAt` check in the GET handler (after the `session` null check), so QR polling also returns 410:

```typescript
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
    }
    // Expired-by-timestamp guard (status column may not be updated yet)
    if (new Date(session.expiresAt) <= new Date()) {
      return NextResponse.json(
        { ok: false, error: "Session expired." },
        { status: 410 },
      )
    }
    return NextResponse.json({
      ok: true,
      status: session.status,
      documentLabel: session.requiredDocumentLabel ?? null,
    })
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run "app/api/upload/mobile/\[token\]/__tests__/route.test.ts"
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/upload/mobile/[token]/route.ts" "app/api/upload/mobile/[token]/__tests__/route.test.ts"
git commit -m "fix(security): enforce expiresAt timestamp on mobile upload sessions (H2)"
```

---

## Task 4: H1 Part A — Postgres-Backed `DbRateLimiter`

**Files:**
- Create: `supabase/migrations/20260526010000_rate_limit_counters.sql`
- Modify: `lib/server/rate-limit.ts`
- Create: `lib/server/__tests__/db-rate-limit.test.ts`

### Background

The existing `RateLimiter` is in-memory: a `Map` keyed by client IP. On multi-instance deployments (e.g., two Next.js containers behind a load balancer), each instance tracks its own counter independently — so a client can exceed the limit by hitting different instances. `DbRateLimiter` uses an atomic Postgres upsert and works across all instances.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260526010000_rate_limit_counters.sql`:

```sql
-- Rate-limit counters — shared across all app instances (multi-instance safe).
-- Each row represents a (limiter-key, time-window) bucket. The count is
-- incremented atomically by DbRateLimiter.checkAsync().

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 0,
  CONSTRAINT rate_limit_counters_pkey PRIMARY KEY (key, window_start)
);

-- Index for the periodic cleanup function
CREATE INDEX IF NOT EXISTS rate_limit_counters_window_start_idx
  ON public.rate_limit_counters (window_start);

-- Periodic cleanup: remove windows older than 2 hours to keep the table small.
CREATE OR REPLACE FUNCTION public.purge_expired_rate_limit_counters()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.rate_limit_counters
  WHERE window_start < (now() - interval '2 hours');
$$;

-- Disable RLS — rate-limit rows contain no PHI and are written only via
-- the server-side service-role connection pool, never by user JWTs.
ALTER TABLE public.rate_limit_counters DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rate_limit_counters IS
  'Shared rate-limit window counters. Written by DbRateLimiter (lib/server/rate-limit.ts). '
  'Purged periodically by purge_expired_rate_limit_counters().';
```

- [ ] **Step 2: Write failing tests for `DbRateLimiter`**

Create `lib/server/__tests__/db-rate-limit.test.ts`:

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Unit tests for DbRateLimiter. The Postgres pool is mocked so no real DB
 * is required — we verify the SQL arguments and that allowed/remaining/resetAt
 * are derived correctly from the returned count.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock pg pool ───────────────────────────────────────────────────────────

const mockQuery = vi.fn()
vi.mock("@/lib/db/server", () => ({
  getDbPool: () => ({ query: mockQuery }),
}))

import { DbRateLimiter } from "@/lib/server/rate-limit"

describe("DbRateLimiter", () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it("allows the request when count equals 1 (first hit in window)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1, window_start: new Date() }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("allows the request when count is exactly at the limit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 5, window_start: new Date() }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it("blocks the request when count exceeds the limit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 6, window_start: new Date() }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("returns resetAt as window_start + windowMs", async () => {
    const windowStart = new Date(Date.now() - 30_000) // 30 s ago
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1, window_start: windowStart }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.resetAt).toBe(windowStart.getTime() + 60_000)
  })

  it("falls back to allowed=true when the DB query throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"))
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 60_000 })
    const result = await limiter.checkAsync("ip:1.2.3.4")
    expect(result.allowed).toBe(true)  // fail-open to avoid blocking all traffic on DB outage
  })

  it("passes window duration in seconds as the SQL parameter", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 1, window_start: new Date() }] })
    const limiter = new DbRateLimiter({ limit: 5, windowMs: 120_000 })
    await limiter.checkAsync("my-key")
    const params = mockQuery.mock.calls[0][1] as unknown[]
    // Second param is windowSeconds (120_000 ms / 1000 = 120)
    expect(params[1]).toBe(120)
  })
})
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
pnpm vitest run lib/server/__tests__/db-rate-limit.test.ts
```

Expected: FAIL — `DbRateLimiter` is not yet exported from `rate-limit.ts`.

- [ ] **Step 4: Implement `DbRateLimiter` in `lib/server/rate-limit.ts`**

Add the following **after** the existing `RateLimiter` class and before the shared limiter instances block:

```typescript
import { getDbPool } from "@/lib/db/server"

// ── DbRateLimiter — Postgres-backed, multi-instance-safe ─────────────────────

/**
 * Rate limiter backed by a Postgres counter table (rate_limit_counters).
 *
 * Uses an atomic INSERT ... ON CONFLICT DO UPDATE to increment a per-(key,
 * window) counter.  Safe across multiple Next.js instances.
 *
 * Fail-open: if the DB is unavailable, requests are allowed through rather
 * than blocking all traffic during an outage.
 */
export class DbRateLimiter {
  private readonly limit: number
  private readonly windowMs: number

  constructor({ limit, windowMs }: RateLimitConfig) {
    this.limit = limit
    this.windowMs = windowMs
  }

  async checkAsync(key: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const windowSeconds = Math.ceil(this.windowMs / 1000)

    try {
      const pool = getDbPool()
      const { rows } = await pool.query<{ count: string; window_start: Date }>(
        `INSERT INTO public.rate_limit_counters (key, window_start, count)
         VALUES (
           $1,
           to_timestamp(floor(extract(epoch from now()) / $2) * $2),
           1
         )
         ON CONFLICT (key, window_start) DO UPDATE
           SET count = rate_limit_counters.count + 1
         RETURNING count::integer AS count, window_start`,
        [key, windowSeconds],
      )

      const row = rows[0]
      if (!row) {
        return { allowed: true, remaining: this.limit - 1, resetAt: Date.now() + this.windowMs }
      }

      const count = typeof row.count === "string" ? parseInt(row.count, 10) : row.count
      const windowStart = row.window_start instanceof Date
        ? row.window_start.getTime()
        : new Date(row.window_start).getTime()
      const resetAt = windowStart + this.windowMs

      if (count > this.limit) {
        return { allowed: false, remaining: 0, resetAt }
      }

      return { allowed: true, remaining: Math.max(0, this.limit - count), resetAt }
    } catch {
      // Fail-open: do not block traffic if the DB is down.
      // The in-memory limiter remains active as a secondary defence.
      return { allowed: true, remaining: this.limit - 1, resetAt: Date.now() + this.windowMs }
    }
  }
}

/**
 * Run a DbRateLimiter check and return a 429 NextResponse if the limit is
 * exceeded, or null if the request should proceed.
 */
export async function checkRateLimitAsync(
  limiter: DbRateLimiter,
  key: string,
): Promise<NextResponse | null> {
  const { allowed, remaining, resetAt } = await limiter.checkAsync(key)

  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
      },
    )
  }

  void remaining
  return null
}
```

Then add the new limiter instances to the shared instances section at the bottom of the file:

```typescript
// ── DB-backed limiter instances (multi-instance safe) ─────────────────────────

/** SSN submission — 3 attempts per 15 min per user */
export const ssnSubmitLimiter = new DbRateLimiter({ limit: 3, windowMs: 15 * 60_000 })

/** Identity (driver-license) verification — 5 attempts per 30 min per user */
export const identityVerifyLimiter = new DbRateLimiter({ limit: 5, windowMs: 30 * 60_000 })

/** AI chat — 30 messages per 5 min per user (streaming) */
export const aiChatLimiter = new DbRateLimiter({ limit: 30, windowMs: 5 * 60_000 })

/** Document upload — 20 uploads per 10 min per user */
export const documentUploadLimiter = new DbRateLimiter({ limit: 20, windowMs: 10 * 60_000 })

/** Mobile upload — 5 attempts per token per 15 min */
export const mobileUploadLimiter = new DbRateLimiter({ limit: 5, windowMs: 15 * 60_000 })
```

Also add `import { getDbPool } from "@/lib/db/server"` at the top of the file (after the existing imports).

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm vitest run lib/server/__tests__/db-rate-limit.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260526010000_rate_limit_counters.sql \
        lib/server/rate-limit.ts \
        lib/server/__tests__/db-rate-limit.test.ts
git commit -m "feat(security): Postgres-backed DbRateLimiter for multi-instance rate limiting (H1)"
```

---

## Task 5: H1 Part B — Apply Rate Limiters to Four Unprotected Routes

**Files:**
- Modify: `app/api/user-profile/ssn/route.ts`
- Modify: `app/api/agents/chat/route.ts`
- Modify: `app/api/identity/verify-license/route.ts`
- Modify: `app/api/applications/[applicationId]/documents/route.ts`

Each change follows the same pattern: import the limiter + `checkRateLimitAsync`, call it in the POST handler after `requireAuthenticatedUser`, keyed on `userId` (not IP — these are all authenticated routes, so user-keyed limiting is more accurate and prevents shared-IP false positives).

- [ ] **Step 1: Apply `ssnSubmitLimiter` to SSN route**

In `app/api/user-profile/ssn/route.ts`, add to the imports block:

```typescript
import {
  getClientIp,
  ssnSubmitLimiter,
  checkRateLimitAsync,
} from "@/lib/server/rate-limit"
```

In the `POST` handler, after `const authResult = await requireAuthenticatedUser(request)` and its early return, add:

```typescript
  const rateLimitResponse = await checkRateLimitAsync(
    ssnSubmitLimiter,
    `ssn:${authResult.userId}`,
  )
  if (rateLimitResponse) return rateLimitResponse
```

- [ ] **Step 2: Apply `aiChatLimiter` to AI chat route**

In `app/api/agents/chat/route.ts`, add to imports:

```typescript
import { aiChatLimiter, checkRateLimitAsync } from "@/lib/server/rate-limit"
```

After `requireAuthenticatedUser` and its guard:

```typescript
  const rateLimitResponse = await checkRateLimitAsync(
    aiChatLimiter,
    `chat:${authResult.userId}`,
  )
  if (rateLimitResponse) return rateLimitResponse
```

- [ ] **Step 3: Apply `identityVerifyLimiter` to identity verification route**

In `app/api/identity/verify-license/route.ts`, add to imports:

```typescript
import { identityVerifyLimiter, checkRateLimitAsync } from "@/lib/server/rate-limit"
```

In the `POST` handler, after `requireAuthenticatedUser` and its guard:

```typescript
  const rateLimitResponse = await checkRateLimitAsync(
    identityVerifyLimiter,
    `identity-verify:${authResult.userId}`,
  )
  if (rateLimitResponse) return rateLimitResponse
```

- [ ] **Step 4: Apply `documentUploadLimiter` to document upload route**

In `app/api/applications/[applicationId]/documents/route.ts`, add to imports:

```typescript
import { documentUploadLimiter, checkRateLimitAsync } from "@/lib/server/rate-limit"
```

In the `POST` handler, after `requireAuthenticatedUser` and its guard:

```typescript
  const rateLimitResponse = await checkRateLimitAsync(
    documentUploadLimiter,
    `doc-upload:${authResult.userId}`,
  )
  if (rateLimitResponse) return rateLimitResponse
```

- [ ] **Step 5: Run the full unit test suite to confirm nothing regressed**

```bash
pnpm vitest run
```

Expected: all tests PASS (or the same count as before this task — no new failures).

- [ ] **Step 6: Commit**

```bash
git add app/api/user-profile/ssn/route.ts \
        app/api/agents/chat/route.ts \
        app/api/identity/verify-license/route.ts \
        "app/api/applications/[applicationId]/documents/route.ts"
git commit -m "fix(security): apply DB rate limiters to SSN, AI chat, identity verify, document upload (H1)"
```

---

## Self-Review

### Spec coverage

| Finding | Task | Addressed? |
|---|---|---|
| H3 — RAG ingest bypasses auth when secret unset | Task 1 | ✓ |
| H4 — dev routes open with cloud DB in staging | Task 2 | ✓ |
| H2 — mobile upload unauthenticated, no expiry enforcement | Task 3 | ✓ expiresAt enforced |
| H1 — in-memory rate limiting useless on multi-instance | Task 4 | ✓ DbRateLimiter introduced |
| H1 — SSN, AI chat, identity verify, document upload unprotected | Task 5 | ✓ all four covered |
| H2 — no rate limit on mobile upload POST | Task 4 `mobileUploadLimiter` created; applying it to mobile upload route is a **gap** — see below |

**Gap found:** `mobileUploadLimiter` is defined in Task 4 but never applied to the mobile upload route. Add this to Task 3 Step 3 or Task 5:

In `app/api/upload/mobile/[token]/route.ts` POST handler, after the `expiresAt` guard:

```typescript
import { mobileUploadLimiter, checkRateLimitAsync } from "@/lib/server/rate-limit"

// ... inside POST, after expiresAt check:
  const rateLimitResponse = await checkRateLimitAsync(
    mobileUploadLimiter,
    `mobile-upload:${token}`,   // keyed on token — this is an unauthenticated route
  )
  if (rateLimitResponse) return rateLimitResponse
```

Add this to `git add` in Task 3 Step 5.

### Placeholder scan

None found — all steps include complete code.

### Type consistency

- `DbRateLimiter.checkAsync()` returns `Promise<{ allowed, remaining, resetAt }>` — same shape as `RateLimiter.check()` — consistent across Tasks 4 and 5.
- `checkRateLimitAsync()` has the same return type as `checkRateLimit()` — consistent.
- `ssnSubmitLimiter`, `aiChatLimiter`, etc. are all `DbRateLimiter` instances — consistent with `checkRateLimitAsync`.
