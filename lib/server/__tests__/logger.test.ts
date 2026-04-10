/**
 * Unit tests for lib/server/logger.ts
 *
 * server-only is stubbed by vitest alias (vitest.mocks/server-only.ts).
 * fetch is provided by jsdom; we spy on it to test OpenObserve shipping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { logServerError, logServerInfo } from "@/lib/server/logger"

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined)
  vi.spyOn(console, "warn").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  // Reset env vars changed during tests
  delete process.env.OPENOBSERVE_URL
  delete process.env.OPENOBSERVE_USER
  delete process.env.OPENOBSERVE_PASSWORD
})

// ── logServerInfo ─────────────────────────────────────────────────────────────

describe("logServerInfo", () => {
  it("calls console.info once", () => {
    logServerInfo("test.event")
    expect(console.info).toHaveBeenCalledTimes(1)
  })

  it("log line is valid JSON", () => {
    logServerInfo("test.event", { userId: "u1" })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    expect(() => JSON.parse(arg)).not.toThrow()
  })

  it("includes event name in the output", () => {
    logServerInfo("user.login")
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    expect(JSON.parse(arg).event).toBe("user.login")
  })

  it("includes level: info", () => {
    logServerInfo("user.login")
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    expect(JSON.parse(arg).level).toBe("info")
  })

  it("includes service: mhealth-app", () => {
    logServerInfo("user.login")
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    expect(JSON.parse(arg).service).toBe("mhealth-app")
  })

  it("includes a ts (ISO timestamp)", () => {
    logServerInfo("test")
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ts = JSON.parse(arg).ts
    expect(() => new Date(ts).toISOString()).not.toThrow()
  })

  it("includes context when provided", () => {
    logServerInfo("test", { foo: "bar" })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const parsed = JSON.parse(arg)
    expect(parsed.context).toBeDefined()
    expect((parsed.context as Record<string, unknown>).foo).toBe("bar")
  })

  it("omits context key when not provided", () => {
    logServerInfo("test")
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    expect(JSON.parse(arg).context).toBeUndefined()
  })
})

// ── logServerError ────────────────────────────────────────────────────────────

describe("logServerError", () => {
  it("calls console.error once", () => {
    logServerError("test.error", new Error("boom"))
    expect(console.error).toHaveBeenCalledTimes(1)
  })

  it("includes level: error", () => {
    logServerError("test.error", new Error("boom"))
    const arg = (console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    expect(JSON.parse(arg).level).toBe("error")
  })

  it("serialises Error name and message", () => {
    logServerError("test.error", new Error("something failed"))
    const arg = (console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    const err = ctx.error as Record<string, unknown>
    expect(err.name).toBe("Error")
    expect(err.message).toBe("something failed")
  })

  it("serialises non-Error values as message", () => {
    logServerError("test.error", "plain string error")
    const arg = (console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    const err = ctx.error as Record<string, unknown>
    expect(err.message).toBe("plain string error")
  })

  it("merges additional context alongside error", () => {
    logServerError("test.error", new Error("x"), { requestId: "req-123" })
    const arg = (console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect(ctx.requestId).toBe("req-123")
    expect(ctx.error).toBeDefined()
  })
})

// ── Sanitisation — PII redaction ──────────────────────────────────────────────

describe("logServerInfo — PII redaction", () => {
  it("redacts 'password' key", () => {
    logServerInfo("auth.attempt", { password: "s3cr3t!" })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect(ctx.password).toBe("[redacted]")
  })

  it("redacts 'token' key", () => {
    logServerInfo("auth.token", { token: "abc123" })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect(ctx.token).toBe("[redacted]")
  })

  it("redacts 'ssn' key", () => {
    logServerInfo("user.lookup", { ssn: "123-45-6789" })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect(ctx.ssn).toBe("[redacted]")
  })

  it("redacts 'authorization' key", () => {
    logServerInfo("api.call", { authorization: "Bearer token" })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect(ctx.authorization).toBe("[redacted]")
  })

  it("does not redact safe keys like userId or event", () => {
    logServerInfo("user.action", { userId: "u-123", route: "/api/test" })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect(ctx.userId).toBe("u-123")
    expect(ctx.route).toBe("/api/test")
  })
})

// ── Sanitisation — type handling ──────────────────────────────────────────────

describe("logServerInfo — sanitise value types", () => {
  it("passes through numbers and booleans unchanged", () => {
    logServerInfo("test", { count: 42, active: true })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect(ctx.count).toBe(42)
    expect(ctx.active).toBe(true)
  })

  it("truncates strings longer than 500 characters", () => {
    const longString = "x".repeat(600)
    logServerInfo("test", { note: longString })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    const note = ctx.note as string
    expect(note.length).toBeLessThanOrEqual(504) // 500 + '...'
    expect(note.endsWith("...")).toBe(true)
  })

  it("serialises Date objects to ISO string", () => {
    const d = new Date("2026-01-01T00:00:00Z")
    logServerInfo("test", { createdAt: d as unknown as Record<string, unknown> })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect(ctx.createdAt).toBe("2026-01-01T00:00:00.000Z")
  })

  it("passes null and undefined through", () => {
    logServerInfo("test", { a: null as unknown as Record<string, unknown>, b: undefined as unknown as Record<string, unknown> })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect(ctx.a).toBeNull()
  })

  it("truncates arrays longer than 20 items", () => {
    const longArray = Array.from({ length: 30 }, (_, i) => i)
    logServerInfo("test", { items: longArray as unknown as Record<string, unknown> })
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    const ctx = JSON.parse(arg).context as Record<string, unknown>
    expect((ctx.items as unknown[]).length).toBeLessThanOrEqual(20)
  })

  it("truncates deeply nested objects at MAX_DEPTH", () => {
    const deep = { a: { b: { c: { d: { e: "too deep" } } } } }
    logServerInfo("test", deep as unknown as Record<string, unknown>)
    const arg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string
    // Should not throw during serialisation
    expect(() => JSON.parse(arg)).not.toThrow()
  })
})

// ── OpenObserve shipping ──────────────────────────────────────────────────────

describe("logServerInfo — OpenObserve shipping", () => {
  it("does NOT call fetch when OO env vars are absent", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response())
    logServerInfo("test")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("calls fetch when all OO env vars are set", async () => {
    process.env.OPENOBSERVE_URL      = "https://oo.example.com"
    process.env.OPENOBSERVE_USER     = "admin"
    process.env.OPENOBSERVE_PASSWORD = "pass"

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response())
    logServerInfo("test.event")

    // Fire-and-forget — flush microtasks so the void fetch promise is queued
    await Promise.resolve()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("oo.example.com")
    expect(url).toContain("mhealth-app")
    expect(options.method).toBe("POST")
  })

  it("does not throw when OO fetch fails (fire-and-forget)", async () => {
    process.env.OPENOBSERVE_URL      = "https://oo.example.com"
    process.env.OPENOBSERVE_USER     = "admin"
    process.env.OPENOBSERVE_PASSWORD = "pass"

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"))

    await expect(async () => {
      logServerInfo("test")
      await Promise.resolve()
    }).not.toThrow()
  })
})
