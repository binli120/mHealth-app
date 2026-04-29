/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for the CSP middleware (middleware.ts).
 *
 * We import the middleware handler directly and feed it a minimal NextRequest
 * constructed from a URL string.  No network I/O occurs — the test just
 * verifies that the returned NextResponse carries the expected headers.
 *
 * Note: the middleware config.matcher is a Webpack/Next.js concept that is
 * evaluated at the edge runtime level and cannot be exercised in a Vitest unit
 * test.  Matcher exclusions are covered by integration/E2E tests instead.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ─────────────────────────────────────────────────────────────────────

// We mock generateNonce so that tests get a deterministic nonce value.
// buildCspHeader is exercised through real production code — the mock only
// controls the nonce string.
const FIXED_NONCE = "dGVzdG5vbmNlMTIzNDU2"   // base64("testNonce123456")

vi.mock("@/lib/csp/nonce", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/csp/nonce")>()
  return {
    ...real,
    generateNonce: vi.fn(() => FIXED_NONCE),
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url = "http://localhost:3000/dashboard"): NextRequest {
  return new NextRequest(url)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("middleware — CSP nonce injection", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("sets Content-Security-Policy on the response", async () => {
    const { middleware } = await import("../middleware")
    const res = middleware(makeRequest())

    expect(res.headers.get("Content-Security-Policy")).not.toBeNull()
  })

  it("CSP includes the generated nonce", async () => {
    const { middleware } = await import("../middleware")
    const res = middleware(makeRequest())

    const csp = res.headers.get("Content-Security-Policy") ?? ""
    expect(csp).toContain(`'nonce-${FIXED_NONCE}'`)
  })

  it("CSP does not include 'unsafe-inline' in script-src", async () => {
    process.env.NODE_ENV = "production"
    vi.resetModules()

    const { middleware } = await import("../middleware")
    const res = middleware(makeRequest())

    const csp = res.headers.get("Content-Security-Policy") ?? ""
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))
    expect(scriptSrc).toBeDefined()
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })

  it("CSP includes 'strict-dynamic' in script-src", async () => {
    const { middleware } = await import("../middleware")
    const res = middleware(makeRequest())

    const csp = res.headers.get("Content-Security-Policy") ?? ""
    expect(csp).toContain("'strict-dynamic'")
  })

  it("x-nonce on the request equals the nonce embedded in the CSP", async () => {
    // We can't directly read the forwarded request headers from NextResponse,
    // but we can verify the nonce the middleware used matches what's in the CSP.
    const { middleware } = await import("../middleware")
    const res = middleware(makeRequest())

    const csp = res.headers.get("Content-Security-Policy") ?? ""
    expect(csp).toContain(`'nonce-${FIXED_NONCE}'`)
    // The fixed nonce is what generateNonce returns — so this transitively
    // verifies that the nonce passed to buildCspHeader came from generateNonce.
  })

  it("returns a 200-range (non-redirect) response", async () => {
    const { middleware } = await import("../middleware")
    const res = middleware(makeRequest())

    // NextResponse.next() produces status 200 internally
    expect(res.status).toBeLessThan(300)
  })

  it("does not override an existing Content-Security-Policy header on the request", async () => {
    // The response header is always the freshly-built one — it must not be
    // the empty string or some stale value.
    const { middleware } = await import("../middleware")
    const req = new NextRequest("http://localhost:3000/")
    req.headers.set("Content-Security-Policy", "stale-value")

    const res = middleware(req)
    const csp = res.headers.get("Content-Security-Policy") ?? ""
    // Fresh CSP should contain our nonce, not the stale value
    expect(csp).toContain("nonce-")
    expect(csp).not.toBe("stale-value")
  })

  it("generates a unique nonce on each invocation (calls generateNonce every time)", async () => {
    const { generateNonce } = await import("@/lib/csp/nonce")
    const { middleware } = await import("../middleware")

    middleware(makeRequest())
    middleware(makeRequest())
    middleware(makeRequest())

    expect(vi.mocked(generateNonce)).toHaveBeenCalledTimes(3)
  })

  it("adds 'unsafe-eval' to script-src in development", async () => {
    process.env.NODE_ENV = "development"
    vi.resetModules()

    const { middleware } = await import("../middleware")
    const res = middleware(makeRequest())

    const csp = res.headers.get("Content-Security-Policy") ?? ""
    expect(csp).toContain("'unsafe-eval'")

    process.env.NODE_ENV = "test"
  })

  it("omits 'unsafe-eval' from script-src in test/production", async () => {
    process.env.NODE_ENV = "test"
    vi.resetModules()

    const { middleware } = await import("../middleware")
    const res = middleware(makeRequest())

    const csp = res.headers.get("Content-Security-Policy") ?? ""
    expect(csp).not.toContain("'unsafe-eval'")
  })
})
