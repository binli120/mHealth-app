/**
 * Tests for the startup security assertion in instrumentation.ts.
 *
 * The register() function must throw at server startup when
 * NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS or ENABLE_LOCAL_AUTH_HELPERS is set
 * to a truthy value in a production environment, preventing dev auth routes
 * from ever being reachable in a production deployment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

type EnvSnapshot = Record<string, string | undefined>

const WATCHED_KEYS = [
  "NODE_ENV",
  "NEXT_RUNTIME",
  "NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS",
  "ENABLE_LOCAL_AUTH_HELPERS",
  "OPENOBSERVE_URL",
  "OPENOBSERVE_USER",
  "OPENOBSERVE_PASSWORD",
] as const

function snapshotEnv(): EnvSnapshot {
  return Object.fromEntries(WATCHED_KEYS.map((k) => [k, process.env[k]]))
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const key of WATCHED_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = snapshot[key]
    }
  }
}

describe("instrumentation register() — production security assertion", () => {
  let snapshot: EnvSnapshot

  beforeEach(() => {
    snapshot = snapshotEnv()
    // Reset module registry so each test imports a fresh copy that reads
    // process.env at the time of the call (not at import time).
    vi.resetModules()
    // Simulate the Node.js server runtime; without this the function returns early
    process.env.NEXT_RUNTIME = "nodejs"
    // Remove OTel vars so the function exits before attempting dynamic imports
    delete process.env.OPENOBSERVE_URL
    delete process.env.OPENOBSERVE_USER
    delete process.env.OPENOBSERVE_PASSWORD
  })

  afterEach(() => {
    restoreEnv(snapshot)
    vi.resetModules()
  })

  // ── Should throw in production when flag is truthy ─────────────────────────

  it("throws when NODE_ENV=production and NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS='true'", async () => {
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS = "true"

    const { register } = await import("../instrumentation.ts")
    await expect(register()).rejects.toThrow("[SECURITY]")
  })

  it("throws when NODE_ENV=production and NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS='1'", async () => {
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS = "1"

    const { register } = await import("../instrumentation.ts")
    await expect(register()).rejects.toThrow("[SECURITY]")
  })

  it("throws when NODE_ENV=production and NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS='yes'", async () => {
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS = "yes"

    const { register } = await import("../instrumentation.ts")
    await expect(register()).rejects.toThrow("[SECURITY]")
  })

  it("throws when NODE_ENV=production and ENABLE_LOCAL_AUTH_HELPERS='true'", async () => {
    process.env.NODE_ENV = "production"
    process.env.ENABLE_LOCAL_AUTH_HELPERS = "true"

    const { register } = await import("../instrumentation.ts")
    await expect(register()).rejects.toThrow("[SECURITY]")
  })

  it("error message names the offending variable", async () => {
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS = "true"

    const { register } = await import("../instrumentation.ts")
    await expect(register()).rejects.toThrow("NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS")
  })

  // ── Should NOT throw in production when flag is falsy or absent ───────────

  it("does not throw when NODE_ENV=production and flag is 'false'", async () => {
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS = "false"
    process.env.PROFILE_ENCRYPTION_KEY = "0".repeat(64) // satisfy key assertion

    const { register } = await import("../instrumentation.ts")
    await expect(register()).resolves.toBeUndefined()
  })

  it("does not throw when NODE_ENV=production and flag is absent", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS
    delete process.env.ENABLE_LOCAL_AUTH_HELPERS
    process.env.PROFILE_ENCRYPTION_KEY = "0".repeat(64) // satisfy key assertion

    const { register } = await import("../instrumentation.ts")
    await expect(register()).resolves.toBeUndefined()
  })

  it("does not throw when NODE_ENV=production and flag is '0'", async () => {
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS = "0"
    process.env.PROFILE_ENCRYPTION_KEY = "0".repeat(64) // satisfy key assertion

    const { register } = await import("../instrumentation.ts")
    await expect(register()).resolves.toBeUndefined()
  })

  it("throws in production when PROFILE_ENCRYPTION_KEY is missing", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS
    delete process.env.ENABLE_LOCAL_AUTH_HELPERS
    delete process.env.PROFILE_ENCRYPTION_KEY

    const { register } = await import("../instrumentation.ts")
    await expect(register()).rejects.toThrow("PROFILE_ENCRYPTION_KEY")
  })

  it("does not throw in production when PROFILE_ENCRYPTION_KEY is set", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS
    process.env.PROFILE_ENCRYPTION_KEY = "a".repeat(64)

    const { register } = await import("../instrumentation.ts")
    await expect(register()).resolves.toBeUndefined()
  })

  // ── Should never throw in non-production environments ─────────────────────

  it("does not throw in development even when flag is 'true'", async () => {
    process.env.NODE_ENV = "development"
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS = "true"

    const { register } = await import("../instrumentation.ts")
    await expect(register()).resolves.toBeUndefined()
  })

  it("does not throw in test environment even when flag is 'true'", async () => {
    process.env.NODE_ENV = "test"
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS = "true"

    const { register } = await import("../instrumentation.ts")
    await expect(register()).resolves.toBeUndefined()
  })

  // ── Non-Node.js runtimes skip the check entirely ──────────────────────────

  it("returns immediately without checking when NEXT_RUNTIME is not 'nodejs'", async () => {
    process.env.NODE_ENV = "production"
    process.env.NEXT_RUNTIME = "edge"
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS = "true"

    const { register } = await import("../instrumentation.ts")
    await expect(register()).resolves.toBeUndefined()
  })
})
