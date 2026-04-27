/**
 * Unit tests for lib/auth/local-auth.ts
 * Pure utility functions — no mocks needed, only process.env manipulation.
 * @author Bin Lee
 */

import { describe, it, expect, vi } from "vitest"
import { normalizeAuthEmail, isLocalAuthHelperEnabled } from "@/lib/auth/local-auth"

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Save and restore only the env keys touched in a test. */
function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {}
  const keys = [
    "NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS",
    "ENABLE_LOCAL_AUTH_HELPERS",
    "NEXT_PUBLIC_SUPABASE_URL_LOCAL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "DATABASE_URL_DEV",
    "DATABASE_URL",
    "DATABASE_URL_PROD",
    "NODE_ENV",
  ]

  for (const k of keys) {
    saved[k] = process.env[k]
    delete process.env[k]
  }

  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }

  try {
    fn()
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) {
        delete process.env[k]
      } else {
        process.env[k] = saved[k]
      }
    }
  }
}

// ── normalizeAuthEmail ─────────────────────────────────────────────────────────

describe("normalizeAuthEmail", () => {
  it("lowercases the email", () => {
    expect(normalizeAuthEmail("User@Example.COM")).toBe("user@example.com")
  })

  it("trims leading and trailing whitespace", () => {
    expect(normalizeAuthEmail("  user@example.com  ")).toBe("user@example.com")
  })

  it("trims and lowercases together", () => {
    expect(normalizeAuthEmail("  ADMIN@MASSHEALTH.GOV  ")).toBe("admin@masshealth.gov")
  })

  it("leaves an already-normalized email unchanged", () => {
    expect(normalizeAuthEmail("user@example.com")).toBe("user@example.com")
  })

  it("handles an empty string", () => {
    expect(normalizeAuthEmail("")).toBe("")
  })
})

// ── isLocalAuthHelperEnabled — explicit env flags ─────────────────────────────

describe("isLocalAuthHelperEnabled — explicit NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS", () => {
  it('returns true for "true"', () => {
    withEnv({ NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "true" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it('returns true for "1"', () => {
    withEnv({ NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "1" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it('returns true for "yes"', () => {
    withEnv({ NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "yes" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it('returns true for "on"', () => {
    withEnv({ NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "on" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it('returns false for "false"', () => {
    withEnv({ NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "false" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(false)
    })
  })

  it('returns false for "0"', () => {
    withEnv({ NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "0" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(false)
    })
  })

  it('returns false for "no"', () => {
    withEnv({ NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "no" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(false)
    })
  })

  it('returns false for "off"', () => {
    withEnv({ NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "off" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(false)
    })
  })
})

describe("isLocalAuthHelperEnabled — explicit ENABLE_LOCAL_AUTH_HELPERS (server-side)", () => {
  it('returns true for "true"', () => {
    withEnv({ ENABLE_LOCAL_AUTH_HELPERS: "true" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it('returns false for "false"', () => {
    withEnv({ ENABLE_LOCAL_AUTH_HELPERS: "false" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(false)
    })
  })

  it("NEXT_PUBLIC flag takes precedence over server-side flag", () => {
    withEnv({
      NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "false",
      ENABLE_LOCAL_AUTH_HELPERS: "true",
    }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(false)
    })
  })
})

// ── isLocalAuthHelperEnabled — Supabase URL heuristic ─────────────────────────

describe("isLocalAuthHelperEnabled — SUPABASE_URL heuristic", () => {
  it("returns true when NEXT_PUBLIC_SUPABASE_URL points to localhost", () => {
    withEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it("returns true when NEXT_PUBLIC_SUPABASE_URL points to 127.0.0.1", () => {
    withEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it("returns true when NEXT_PUBLIC_SUPABASE_URL_LOCAL points to localhost", () => {
    withEnv({ NEXT_PUBLIC_SUPABASE_URL_LOCAL: "http://localhost:54321" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it("returns false when NEXT_PUBLIC_SUPABASE_URL points to a remote host", () => {
    withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://xyzabc.supabase.co" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(false)
    })
  })

  it("returns true when SUPABASE_URL points to 0.0.0.0", () => {
    withEnv({ SUPABASE_URL: "http://0.0.0.0:54321" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })
})

// ── isLocalAuthHelperEnabled — DATABASE_URL heuristic ─────────────────────────

describe("isLocalAuthHelperEnabled — DATABASE_URL heuristic", () => {
  it("returns true when DATABASE_URL points to localhost", () => {
    withEnv({ DATABASE_URL: "postgres://user:pass@localhost:5432/db" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it("returns true when DATABASE_URL_DEV points to 127.0.0.1", () => {
    withEnv({ DATABASE_URL_DEV: "postgres://user:pass@127.0.0.1:5432/db" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it("returns false when DATABASE_URL points to a remote host", () => {
    withEnv({ DATABASE_URL: "postgres://user:pass@prod.db.example.com:5432/db" }, () => {
      expect(isLocalAuthHelperEnabled()).toBe(false)
    })
  })
})

// ── isLocalAuthHelperEnabled — window.location.hostname branch ───────────────
//
// In a jsdom environment `typeof window !== "undefined"` is always true, so the
// window-hostname branch runs before the NODE_ENV fallback.  These tests cover
// that branch directly.

describe("isLocalAuthHelperEnabled — window.location.hostname branch (jsdom)", () => {
  it("returns true when window.location.hostname is 'localhost' (jsdom default)", () => {
    // jsdom sets window.location.hostname to "localhost" by default — no setup needed.
    withEnv({}, () => {
      expect(isLocalAuthHelperEnabled()).toBe(true)
    })
  })

  it("returns false when window.location.hostname is a remote host", () => {
    // jsdom doesn't support full navigation via assign(); stub the property directly.
    const originalLocation = window.location
    Object.defineProperty(window, "location", {
      value: { hostname: "production.example.com" },
      configurable: true,
      writable: true,
    })
    try {
      withEnv({}, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        configurable: true,
        writable: true,
      })
    }
  })
})

// ── isLocalAuthHelperEnabled — production hard block ─────────────────────────
//
// When NODE_ENV === "production" the function must always return false,
// regardless of any flag or URL heuristic.  This is the primary security
// guarantee introduced to prevent dev auth routes from ever being reachable
// in a production deployment.

describe("isLocalAuthHelperEnabled — production hard block", () => {
  it("returns false in production even when NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS is 'true'", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({ NODE_ENV: "production", NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "true" }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("returns false in production even when ENABLE_LOCAL_AUTH_HELPERS is 'true'", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({ NODE_ENV: "production", ENABLE_LOCAL_AUTH_HELPERS: "true" }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("returns false in production even when both flags are 'true'", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "true",
        ENABLE_LOCAL_AUTH_HELPERS: "true",
      }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("returns false in production even when Supabase URL points to localhost", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("returns false in production even when DATABASE_URL points to localhost", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("still returns true in development when flag is 'true' (guard only applies to production)", () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({ NODE_ENV: "development", NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS: "true" }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(true)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// ── isLocalAuthHelperEnabled — NODE_ENV fallback ──────────────────────────────
//
// The NODE_ENV path is only reached when `window` is undefined (i.e. a pure
// Node.js / server-only context).  We stub window away to simulate that.

describe("isLocalAuthHelperEnabled — NODE_ENV fallback (no window, no env vars)", () => {
  it('returns false when NODE_ENV is "development"', () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({ NODE_ENV: "development" }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns false when NODE_ENV is "production"', () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({ NODE_ENV: "production" }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(false)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns true when NODE_ENV is "test" (non-production)', () => {
    vi.stubGlobal("window", undefined)
    try {
      withEnv({ NODE_ENV: "test" }, () => {
        expect(isLocalAuthHelperEnabled()).toBe(true)
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
