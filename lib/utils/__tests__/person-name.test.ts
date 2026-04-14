/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import { hasFirstAndLastName, fullName } from "../person-name"

// ── hasFirstAndLastName ───────────────────────────────────────────────────────

describe("hasFirstAndLastName", () => {
  it("accepts names with first and last parts", () => {
    expect(hasFirstAndLastName("Jane Doe")).toBe(true)
    expect(hasFirstAndLastName("Jane Marie Doe")).toBe(true)
    expect(hasFirstAndLastName("Jean-Luc Picard")).toBe(true)
  })

  it("accepts unicode names", () => {
    expect(hasFirstAndLastName("José Álvarez")).toBe(true)
    expect(hasFirstAndLastName("Nguyễn Văn")).toBe(true)
  })

  it("rejects single-part and empty names", () => {
    expect(hasFirstAndLastName("Jane")).toBe(false)
    expect(hasFirstAndLastName("")).toBe(false)
    expect(hasFirstAndLastName("   ")).toBe(false)
  })
})

// ── fullName ──────────────────────────────────────────────────────────────────

describe("fullName", () => {
  // ── normal cases ─────────────────────────────────────────────────────────

  it("joins first and last name with a space", () => {
    expect(fullName({ first_name: "Jane", last_name: "Doe" })).toBe("Jane Doe")
  })

  it("preserves original casing", () => {
    expect(fullName({ first_name: "maria", last_name: "SANTOS" })).toBe("maria SANTOS")
  })

  it("works with unicode characters", () => {
    expect(fullName({ first_name: "José", last_name: "Álvarez" })).toBe("José Álvarez")
  })

  // ── partial presence ──────────────────────────────────────────────────────

  it("returns first name only when last_name is null", () => {
    expect(fullName({ first_name: "Jane", last_name: null })).toBe("Jane")
  })

  it("returns last name only when first_name is null", () => {
    expect(fullName({ first_name: null, last_name: "Doe" })).toBe("Doe")
  })

  it("returns last name only when first_name is undefined", () => {
    expect(fullName({ first_name: undefined, last_name: "Doe" })).toBe("Doe")
  })

  // ── empty / null ──────────────────────────────────────────────────────────

  it("returns '—' when both fields are null", () => {
    expect(fullName({ first_name: null, last_name: null })).toBe("—")
  })

  it("returns '—' when both fields are undefined", () => {
    expect(fullName({ first_name: undefined, last_name: undefined })).toBe("—")
  })

  it("returns '—' when both fields are empty strings", () => {
    expect(fullName({ first_name: "", last_name: "" })).toBe("—")
  })

  // ── structural compatibility ──────────────────────────────────────────────

  it("accepts any object shape with first_name and last_name (AdminUser-like)", () => {
    const adminUser = {
      id: "u1",
      email: "a@b.com",
      is_active: true,
      created_at: "2026-01-01",
      roles: ["admin"],
      first_name: "Bin",
      last_name: "Lee",
      company_id: null,
      company_name: null,
    }
    expect(fullName(adminUser)).toBe("Bin Lee")
  })

  it("accepts a SocialWorker-like object", () => {
    const sw = {
      id: "sw1",
      user_id: "u1",
      email: "sw@co.com",
      first_name: "Alice",
      last_name: "Chen",
      company_id: "c1",
      company_name: "Care Co",
      license_number: null,
      job_title: null,
      status: "approved" as const,
      rejection_note: null,
      created_at: "2026-01-01",
    }
    expect(fullName(sw)).toBe("Alice Chen")
  })
})

