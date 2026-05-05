/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Unit tests for lib/telemetry/otel-phi-hooks.ts
 *
 * All hooks are pure, synchronous functions — no OTel SDK or Next.js runtime
 * required.  We use a minimal Span stub that records setAttribute calls so we
 * can assert on what the hooks write without spinning up the full SDK.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Span } from "@opentelemetry/api"
import type { IncomingMessage } from "http"
import type { PgRequestHookInformation } from "@opentelemetry/instrumentation-pg"

import {
  shouldIgnoreIncomingRequest,
  scrubHttpRequestSpan,
  scrubHttpResponseSpan,
  scrubPgStatement,
} from "../otel-phi-hooks"

// ── Span stub ─────────────────────────────────────────────────────────────────

function makeSpan(): { stub: Span; attrs: Record<string, unknown> } {
  const attrs: Record<string, unknown> = {}
  const stub = {
    setAttribute:  (key: string, value: unknown) => { attrs[key] = value; return stub },
    setAttributes: (a: Record<string, unknown>) => { Object.assign(attrs, a); return stub },
    // no-ops for the rest of the Span interface
    updateName:      () => stub,
    addEvent:        () => stub,
    addLink:         () => stub,
    setStatus:       () => stub,
    end:             () => undefined,
    isRecording:     () => true,
    recordException: () => undefined,
    spanContext:     () => ({ traceId: "", spanId: "", traceFlags: 0 }),
  } as unknown as Span
  return { stub, attrs }
}

// ── shouldIgnoreIncomingRequest ───────────────────────────────────────────────

describe("shouldIgnoreIncomingRequest", () => {
  function fakeRequest(url: string): IncomingMessage {
    return { url } as IncomingMessage
  }

  it("ignores /api/health (exact match)", () => {
    expect(shouldIgnoreIncomingRequest(fakeRequest("/api/health"))).toBe(true)
  })

  it("does NOT ignore /api/health/extra (only exact match)", () => {
    expect(shouldIgnoreIncomingRequest(fakeRequest("/api/health/extra"))).toBe(false)
  })

  it("ignores /_next/ prefix (static bundles)", () => {
    expect(shouldIgnoreIncomingRequest(fakeRequest("/_next/static/chunks/main.js"))).toBe(true)
    expect(shouldIgnoreIncomingRequest(fakeRequest("/_next/image?url=x&w=64"))).toBe(true)
  })

  it("ignores /favicon paths", () => {
    expect(shouldIgnoreIncomingRequest(fakeRequest("/favicon.ico"))).toBe(true)
    expect(shouldIgnoreIncomingRequest(fakeRequest("/favicon-32x32.png"))).toBe(true)
  })

  it("ignores /apple-icon paths", () => {
    expect(shouldIgnoreIncomingRequest(fakeRequest("/apple-icon.png"))).toBe(true)
  })

  it("ignores /robots.txt", () => {
    expect(shouldIgnoreIncomingRequest(fakeRequest("/robots.txt"))).toBe(true)
  })

  it("ignores /sitemap.xml", () => {
    expect(shouldIgnoreIncomingRequest(fakeRequest("/sitemap.xml"))).toBe(true)
  })

  it("does NOT ignore regular API routes", () => {
    expect(shouldIgnoreIncomingRequest(fakeRequest("/api/user-profile/ssn"))).toBe(false)
    expect(shouldIgnoreIncomingRequest(fakeRequest("/api/user-profile"))).toBe(false)
    expect(shouldIgnoreIncomingRequest(fakeRequest("/dashboard"))).toBe(false)
  })

  it("handles missing url gracefully (returns false)", () => {
    expect(shouldIgnoreIncomingRequest(fakeRequest(""))).toBe(false)
    expect(shouldIgnoreIncomingRequest({} as IncomingMessage)).toBe(false)
  })
})

// ── scrubHttpRequestSpan ──────────────────────────────────────────────────────

describe("scrubHttpRequestSpan", () => {
  it("blanks url.query", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpRequestSpan(stub, { url: "/api/foo?token=abc&bar=1" })
    expect(attrs["url.query"]).toBe("")
  })

  it("strips query string from http.target (IncomingMessage .url)", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpRequestSpan(stub, { url: "/api/foo?secret=123" })
    expect(attrs["http.target"]).toBe("/api/foo")
  })

  it("strips query string from http.target (ClientRequest .path)", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpRequestSpan(stub, { path: "/api/bar?x=1" })
    expect(attrs["http.target"]).toBe("/api/bar")
  })

  it("sets http.target to the full path when no query string is present", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpRequestSpan(stub, { url: "/api/user-profile/ssn" })
    expect(attrs["http.target"]).toBe("/api/user-profile/ssn")
  })

  it("does not set http.target when both url and path are absent", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpRequestSpan(stub, {})
    expect(attrs["http.target"]).toBeUndefined()
  })

  it("redacts authorization header", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpRequestSpan(stub, { url: "/api/x" })
    expect(attrs["http.request.header.authorization"]).toBe("[REDACTED]")
  })

  it("redacts cookie header", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpRequestSpan(stub, { url: "/api/x" })
    expect(attrs["http.request.header.cookie"]).toBe("[REDACTED]")
  })

  it("redacts set-cookie header", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpRequestSpan(stub, { url: "/api/x" })
    expect(attrs["http.request.header.set-cookie"]).toBe("[REDACTED]")
  })

  it("redacts x-supabase-session header", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpRequestSpan(stub, { url: "/api/x" })
    expect(attrs["http.request.header.x-supabase-session"]).toBe("[REDACTED]")
  })
})

// ── scrubHttpResponseSpan ─────────────────────────────────────────────────────

describe("scrubHttpResponseSpan", () => {
  it("redacts http.response.header.set-cookie", () => {
    const { stub, attrs } = makeSpan()
    scrubHttpResponseSpan(stub)
    expect(attrs["http.response.header.set-cookie"]).toBe("[REDACTED]")
  })
})

// ── scrubPgStatement ──────────────────────────────────────────────────────────

describe("scrubPgStatement", () => {
  function makeQueryInfo(text: string): PgRequestHookInformation {
    return {
      query: { text },
      connection: {},
    }
  }

  it("does NOT redact a normal parameterized query", () => {
    const { stub, attrs } = makeSpan()
    scrubPgStatement(stub, makeQueryInfo("SELECT id FROM applicants WHERE user_id = $1"))
    expect(attrs["db.statement"]).toBeUndefined()
  })

  it("does NOT redact a query with dollar placeholders that look like SSNs ($1, $2)", () => {
    const { stub, attrs } = makeSpan()
    // $1 followed by digits should not be mistaken for ###-##-####
    scrubPgStatement(stub, makeQueryInfo("UPDATE applicants SET ssn_encrypted = $1 WHERE id = $2"))
    expect(attrs["db.statement"]).toBeUndefined()
  })

  it("redacts a query containing a literal AES-256-GCM ciphertext (v1:hex:…)", () => {
    const { stub, attrs } = makeSpan()
    // Realistic v1:iv(24 hex):tag(32 hex):ciphertext format
    const iv  = "a".repeat(24)   // 12-byte IV = 24 hex chars
    const tag = "b".repeat(32)   // 16-byte tag = 32 hex chars
    const ct  = "c".repeat(18)   // arbitrary ciphertext length
    const ciphertext = `v1:${iv}:${tag}:${ct}`
    scrubPgStatement(stub, makeQueryInfo(
      `UPDATE applicants SET ssn_encrypted = '${ciphertext}' WHERE id = '123'`,
    ))
    expect(attrs["db.statement"]).toMatch(/REDACTED/)
  })

  it("redacts a query containing a bare SSN (###-##-####)", () => {
    const { stub, attrs } = makeSpan()
    scrubPgStatement(stub, makeQueryInfo(
      "SELECT * FROM applicants WHERE ssn_plain = '123-45-6789'",
    ))
    expect(attrs["db.statement"]).toMatch(/REDACTED/)
  })

  it("logs a console.error when PHI is detected", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { stub } = makeSpan()
    scrubPgStatement(stub, makeQueryInfo(
      "SELECT * FROM applicants WHERE ssn = '123-45-6789'",
    ))
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0][0]).toContain("PHI detected")
    spy.mockRestore()
  })

  it("handles missing query.text gracefully (no redaction, no throw)", () => {
    const { stub, attrs } = makeSpan()
    scrubPgStatement(stub, { query: { text: "" }, connection: {} })
    expect(attrs["db.statement"]).toBeUndefined()
  })
})
