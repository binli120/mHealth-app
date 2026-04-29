/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for lib/csp/nonce: generateNonce and buildCspHeader.
 *
 * No external dependencies — these are pure functions that can be exercised
 * without any mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { generateNonce, buildCspHeader } from "@/lib/csp/nonce"

// ── generateNonce ─────────────────────────────────────────────────────────────

describe("generateNonce", () => {
  it("returns a non-empty base64 string", () => {
    const nonce = generateNonce()
    expect(nonce).toBeTypeOf("string")
    expect(nonce.length).toBeGreaterThan(0)
    // Valid base64 characters only
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it("produces a different value on every call", () => {
    const values = new Set(Array.from({ length: 20 }, () => generateNonce()))
    // All 20 should be unique — the probability of a collision is astronomically small
    expect(values.size).toBe(20)
  })

  it("encodes 16 bytes (128 bits of entropy)", () => {
    const nonce = generateNonce()
    // 16 raw bytes → 22 base64 chars + up to 2 padding chars = 24 chars
    const decoded = atob(nonce)
    expect(decoded.length).toBe(16)
  })
})

// ── buildCspHeader ────────────────────────────────────────────────────────────

describe("buildCspHeader — structure", () => {
  it("returns a string with semicolon-separated directives", () => {
    const csp = buildCspHeader({ nonce: "testNonce" })
    expect(csp).toBeTypeOf("string")
    expect(csp).toContain(";")
  })

  it("includes all required directives", () => {
    const csp = buildCspHeader({ nonce: "testNonce" })
    const required = [
      "default-src",
      "script-src",
      "style-src",
      "connect-src",
      "img-src",
      "font-src",
      "media-src",
      "worker-src",
      "frame-src",
      "object-src",
      "base-uri",
      "form-action",
    ]
    for (const directive of required) {
      expect(csp, `missing directive: ${directive}`).toContain(directive)
    }
  })
})

describe("buildCspHeader — script-src (the critical one)", () => {
  it("includes the nonce in script-src", () => {
    const nonce = "abc123XYZ=="
    const csp = buildCspHeader({ nonce })
    expect(csp).toContain(`'nonce-${nonce}'`)
  })

  it("includes 'strict-dynamic' in script-src", () => {
    const csp = buildCspHeader({ nonce: "n1" })
    expect(csp).toContain("'strict-dynamic'")
  })

  it("does NOT include 'unsafe-inline' in script-src", () => {
    const csp = buildCspHeader({ nonce: "n1", isDev: false })
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))
    expect(scriptSrc).toBeDefined()
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })

  it("does NOT include 'unsafe-eval' in production", () => {
    const csp = buildCspHeader({ nonce: "n1", isDev: false })
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it("DOES include 'unsafe-eval' in development", () => {
    const csp = buildCspHeader({ nonce: "n1", isDev: true })
    expect(csp).toContain("'unsafe-eval'")
  })

  it("'unsafe-eval' is absent from the production script-src even when isDev is explicitly false", () => {
    const csp = buildCspHeader({ nonce: "n1", isDev: false })
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))
    expect(scriptSrc).not.toContain("'unsafe-eval'")
  })
})

describe("buildCspHeader — style-src", () => {
  it("keeps 'unsafe-inline' in style-src (Radix + Recharts use inline style= attrs)", () => {
    const csp = buildCspHeader({ nonce: "n1" })
    const styleSrc = csp.split(";").find((d) => d.trim().startsWith("style-src"))
    expect(styleSrc).toBeDefined()
    expect(styleSrc).toContain("'unsafe-inline'")
  })

  it("style-src does NOT include a nonce (nonces protect <style> elements, not style= attrs)", () => {
    const nonce = "abc123"
    const csp = buildCspHeader({ nonce })
    const styleSrc = csp.split(";").find((d) => d.trim().startsWith("style-src"))
    expect(styleSrc).not.toContain(`'nonce-${nonce}'`)
  })
})

describe("buildCspHeader — restrictive directives", () => {
  it("sets frame-src to 'none'", () => {
    const csp = buildCspHeader({ nonce: "n1" })
    expect(csp).toContain("frame-src 'none'")
  })

  it("sets object-src to 'none'", () => {
    const csp = buildCspHeader({ nonce: "n1" })
    expect(csp).toContain("object-src 'none'")
  })

  it("restricts base-uri to 'self'", () => {
    const csp = buildCspHeader({ nonce: "n1" })
    expect(csp).toContain("base-uri 'self'")
  })

  it("restricts form-action to 'self'", () => {
    const csp = buildCspHeader({ nonce: "n1" })
    expect(csp).toContain("form-action 'self'")
  })
})

describe("buildCspHeader — supabaseHost option", () => {
  it("uses the explicit supabaseHost when provided", () => {
    const csp = buildCspHeader({ nonce: "n1", supabaseHost: "xyz.supabase.co" })
    expect(csp).toContain("https://xyz.supabase.co")
    expect(csp).toContain("wss://xyz.supabase.co")
  })

  it("falls back to *.supabase.co when supabaseHost is not provided and env is unset", () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    const csp = buildCspHeader({ nonce: "n1" })
    expect(csp).toContain("*.supabase.co")

    // Restore
    if (savedUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
  })

  it("derives host from NEXT_PUBLIC_SUPABASE_URL env when supabaseHost is omitted", () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdef.supabase.co"

    const csp = buildCspHeader({ nonce: "n1" })
    expect(csp).toContain("https://abcdef.supabase.co")

    // Restore
    if (savedUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL
  })
})

describe("buildCspHeader — nonce uniqueness in output", () => {
  it("two CSPs with different nonces differ only in the nonce token", () => {
    const csp1 = buildCspHeader({ nonce: "nonce-one", supabaseHost: "x.supabase.co" })
    const csp2 = buildCspHeader({ nonce: "nonce-two", supabaseHost: "x.supabase.co" })

    expect(csp1).not.toBe(csp2)
    expect(csp1.replace("nonce-one", "nonce-two")).toBe(csp2)
  })
})
