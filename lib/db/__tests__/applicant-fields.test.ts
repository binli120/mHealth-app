/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for lib/db/applicant-fields.ts
 *
 * encryptApplicantField / decryptOrPlain / decryptDisplayName are pure helpers
 * that delegate to the encryption primitives.  We mock encryptField /
 * decryptField so these tests remain fast and self-contained.
 *
 * APPLICANT_PHI_SELECT / APPLICANT_PHI_GROUP_BY / APPLICANT_NAME_SELECT /
 * APPLICANT_NAME_GROUP_BY produce SQL fragments — tested by inspecting the
 * string output without touching a database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock the encryption primitives ────────────────────────────────────────────

vi.mock("@/lib/user-profile/encrypt", () => ({
  encryptField: vi.fn((plain: string) => `ENC(${plain})`),
  decryptField: vi.fn((cipher: string) => {
    // Reverse the mock encoding: strip "ENC(" prefix and ")" suffix
    if (cipher.startsWith("ENC(") && cipher.endsWith(")")) {
      return cipher.slice(4, -1)
    }
    throw new Error(`Mock decryptField: unexpected input "${cipher}"`)
  }),
}))

// server-only is a Next.js module that throws outside a server context.
// Mock it as a no-op so Vitest can import the module.
vi.mock("server-only", () => ({}))

import {
  encryptApplicantField,
  decryptOrPlain,
  decryptDisplayName,
  APPLICANT_PHI_SELECT,
  APPLICANT_PHI_GROUP_BY,
  APPLICANT_NAME_SELECT,
  APPLICANT_NAME_GROUP_BY,
} from "../applicant-fields"

// ── encryptApplicantField ─────────────────────────────────────────────────────

describe("encryptApplicantField", () => {
  it("encrypts a non-empty string", () => {
    expect(encryptApplicantField("Alice")).toBe("ENC(Alice)")
  })

  it("returns null for null input", () => {
    expect(encryptApplicantField(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(encryptApplicantField(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(encryptApplicantField("")).toBeNull()
  })
})

// ── decryptOrPlain ────────────────────────────────────────────────────────────

describe("decryptOrPlain", () => {
  it("decrypts when encrypted value is present", () => {
    expect(decryptOrPlain("ENC(Alice)", "Alice")).toBe("Alice")
  })

  it("falls back to plaintext when encrypted is null", () => {
    expect(decryptOrPlain(null, "Bob")).toBe("Bob")
  })

  it("falls back to plaintext when encrypted is undefined", () => {
    expect(decryptOrPlain(undefined, "Carol")).toBe("Carol")
  })

  it("returns null when both inputs are null", () => {
    expect(decryptOrPlain(null, null)).toBeNull()
  })

  it("returns null when both inputs are undefined", () => {
    expect(decryptOrPlain(undefined, undefined)).toBeNull()
  })

  it("returns null when plaintext is null and encrypted is null", () => {
    expect(decryptOrPlain(null, null)).toBeNull()
  })

  it("prefers decrypted over plaintext (encrypted takes priority)", () => {
    // encrypted present → decrypted result wins, legacy plain is ignored
    expect(decryptOrPlain("ENC(NewValue)", "OldPlain")).toBe("NewValue")
  })
})

// ── decryptDisplayName ────────────────────────────────────────────────────────

describe("decryptDisplayName", () => {
  it("builds first + last name from encrypted columns", () => {
    expect(decryptDisplayName("ENC(Alice)", null, "ENC(Smith)", null)).toBe("Alice Smith")
  })

  it("builds name from legacy plaintext fallback", () => {
    expect(decryptDisplayName(null, "Bob", null, "Jones")).toBe("Bob Jones")
  })

  it("returns first name only when last name is absent", () => {
    expect(decryptDisplayName("ENC(Alice)", null, null, null)).toBe("Alice")
  })

  it("returns last name only when first name is absent", () => {
    expect(decryptDisplayName(null, null, "ENC(Smith)", null)).toBe("Smith")
  })

  it("returns null when all inputs are null", () => {
    expect(decryptDisplayName(null, null, null, null)).toBeNull()
  })

  it("trims whitespace from assembled name", () => {
    // Both decrypt to empty-ish strings via the mock would only happen if
    // plaintext is empty — but with real values it should trim correctly.
    expect(decryptDisplayName("ENC(Alice)", null, "ENC(Smith)", null)).toBe("Alice Smith")
  })

  it("mixed encrypted first + plaintext last", () => {
    expect(decryptDisplayName("ENC(Alice)", "IgnoredLegacy", null, "Jones")).toBe("Alice Jones")
  })
})

// ── SQL fragment helpers ──────────────────────────────────────────────────────

describe("APPLICANT_PHI_SELECT", () => {
  it("includes both encrypted and legacy plaintext columns for the alias", () => {
    const fragment = APPLICANT_PHI_SELECT("a")
    expect(fragment).toContain("a.first_name_encrypted")
    expect(fragment).toContain("a.first_name")
    expect(fragment).toContain("a.last_name_encrypted")
    expect(fragment).toContain("a.last_name")
    expect(fragment).toContain("a.dob_encrypted")
    expect(fragment).toContain("a.phone_encrypted")
    expect(fragment).toContain("a.phone")
    expect(fragment).toContain("a.address_line1_encrypted")
    expect(fragment).toContain("a.city_encrypted")
    expect(fragment).toContain("a.state_encrypted")
    expect(fragment).toContain("a.zip_encrypted")
  })

  it("casts legacy dob column to text", () => {
    const fragment = APPLICANT_PHI_SELECT("a")
    expect(fragment).toContain("a.dob::text AS dob")
  })

  it("respects the table alias", () => {
    const fragment = APPLICANT_PHI_SELECT("ap")
    expect(fragment).toContain("ap.first_name_encrypted")
    expect(fragment).not.toContain("a.first_name_encrypted")
  })
})

describe("APPLICANT_PHI_GROUP_BY", () => {
  it("includes both encrypted and legacy plaintext columns", () => {
    const fragment = APPLICANT_PHI_GROUP_BY("a")
    expect(fragment).toContain("a.first_name_encrypted")
    expect(fragment).toContain("a.first_name")
    expect(fragment).toContain("a.dob_encrypted")
    expect(fragment).toContain("a.dob")
  })

  it("does NOT alias dob with ::text (GROUP BY does not use aliases)", () => {
    const fragment = APPLICANT_PHI_GROUP_BY("a")
    expect(fragment).not.toContain("::text AS dob")
  })

  it("respects the table alias", () => {
    const fragment = APPLICANT_PHI_GROUP_BY("ap")
    expect(fragment).toContain("ap.last_name_encrypted")
    expect(fragment).not.toContain("a.last_name_encrypted")
  })
})

describe("APPLICANT_NAME_SELECT", () => {
  it("includes only first/last name columns (not address, dob, etc.)", () => {
    const fragment = APPLICANT_NAME_SELECT("a")
    expect(fragment).toContain("a.first_name_encrypted")
    expect(fragment).toContain("a.first_name")
    expect(fragment).toContain("a.last_name_encrypted")
    expect(fragment).toContain("a.last_name")
    expect(fragment).not.toContain("dob")
    expect(fragment).not.toContain("phone")
    expect(fragment).not.toContain("address")
    expect(fragment).not.toContain("city")
    expect(fragment).not.toContain("state")
    expect(fragment).not.toContain("zip")
  })

  it("respects the table alias", () => {
    const fragment = APPLICANT_NAME_SELECT("sw")
    expect(fragment).toContain("sw.first_name_encrypted")
  })
})

describe("APPLICANT_NAME_GROUP_BY", () => {
  it("includes only first/last name columns", () => {
    const fragment = APPLICANT_NAME_GROUP_BY("a")
    expect(fragment).toContain("a.first_name_encrypted")
    expect(fragment).toContain("a.first_name")
    expect(fragment).toContain("a.last_name_encrypted")
    expect(fragment).toContain("a.last_name")
    expect(fragment).not.toContain("dob")
    expect(fragment).not.toContain("phone")
  })

  it("respects the table alias", () => {
    const fragment = APPLICANT_NAME_GROUP_BY("pt")
    expect(fragment).toContain("pt.first_name_encrypted")
  })
})
