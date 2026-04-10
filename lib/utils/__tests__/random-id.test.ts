import { describe, it, expect, vi, afterEach } from "vitest"
import { createUuid } from "@/lib/utils/random-id"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

afterEach(() => vi.restoreAllMocks())

// ── Default path (crypto.randomUUID available in jsdom) ───────────────────────

describe("createUuid — crypto.randomUUID path", () => {
  it("returns a string in UUID v4 format", () => {
    const id = createUuid()
    expect(id).toMatch(UUID_REGEX)
  })

  it("returns a different value each call", () => {
    const ids = new Set(Array.from({ length: 20 }, () => createUuid()))
    expect(ids.size).toBe(20)
  })
})

// ── Fallback path: randomUUID missing, getRandomValues available ──────────────

describe("createUuid — getRandomValues fallback", () => {
  it("still returns a valid UUID v4 when randomUUID is absent", () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: original.getRandomValues.bind(original),
        // randomUUID intentionally absent
      },
      configurable: true,
    })

    const id = createUuid()
    expect(id).toMatch(UUID_REGEX)

    Object.defineProperty(globalThis, "crypto", { value: original, configurable: true })
  })
})

// ── Fallback path: no crypto API at all ──────────────────────────────────────

describe("createUuid — Math.random fallback", () => {
  it("returns a valid UUID v4 when crypto is entirely absent", () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    })

    const id = createUuid()
    expect(id).toMatch(UUID_REGEX)

    Object.defineProperty(globalThis, "crypto", { value: original, configurable: true })
  })
})

// ── RFC 4122 bit constraints ──────────────────────────────────────────────────

describe("createUuid — RFC 4122 constraints", () => {
  it("version nibble is always 4", () => {
    for (let i = 0; i < 10; i++) {
      const id = createUuid()
      // 3rd group starts with '4'
      expect(id.split("-")[2][0]).toBe("4")
    }
  })

  it("variant bits are always 8, 9, a, or b", () => {
    for (let i = 0; i < 10; i++) {
      const id = createUuid()
      expect(id.split("-")[3][0]).toMatch(/^[89ab]$/i)
    }
  })

  it("has exactly 36 characters (including hyphens)", () => {
    expect(createUuid()).toHaveLength(36)
  })

  it("has hyphens at positions 8, 13, 18, 23", () => {
    const id = createUuid()
    expect(id[8]).toBe("-")
    expect(id[13]).toBe("-")
    expect(id[18]).toBe("-")
    expect(id[23]).toBe("-")
  })
})
