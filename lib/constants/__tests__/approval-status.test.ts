/**
 * Unit tests for shared approval-status constants.
 * @author Bin Lee
 */

import { describe, it, expect } from "vitest"
import {
  STATUS_FILTER_OPTIONS,
  STATUS_STYLE,
  VALID_STATUS_FILTERS,
} from "../approval-status"

// ── STATUS_FILTER_OPTIONS ─────────────────────────────────────────────────────

describe("STATUS_FILTER_OPTIONS", () => {
  it("is an array", () => {
    expect(Array.isArray(STATUS_FILTER_OPTIONS)).toBe(true)
  })

  it("has 4 entries (all + 3 statuses)", () => {
    expect(STATUS_FILTER_OPTIONS).toHaveLength(4)
  })

  it("first entry is the catch-all empty value", () => {
    expect(STATUS_FILTER_OPTIONS[0]).toEqual({ value: "", label: "All Statuses" })
  })

  it("includes pending, approved, and rejected entries", () => {
    const values = STATUS_FILTER_OPTIONS.map((o) => o.value)
    expect(values).toContain("pending")
    expect(values).toContain("approved")
    expect(values).toContain("rejected")
  })

  it("every entry has a non-empty label", () => {
    for (const option of STATUS_FILTER_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0)
    }
  })

  it("non-empty values match VALID_STATUS_FILTERS", () => {
    for (const option of STATUS_FILTER_OPTIONS) {
      if (option.value) {
        expect(VALID_STATUS_FILTERS.has(option.value)).toBe(true)
      }
    }
  })
})

// ── STATUS_STYLE ──────────────────────────────────────────────────────────────

describe("STATUS_STYLE", () => {
  it("has an entry for each valid status", () => {
    for (const status of VALID_STATUS_FILTERS) {
      expect(STATUS_STYLE).toHaveProperty(status)
    }
  })

  it("approved uses an emerald (green) color", () => {
    expect(STATUS_STYLE.approved).toContain("emerald")
  })

  it("pending uses an amber (yellow) color", () => {
    expect(STATUS_STYLE.pending).toContain("amber")
  })

  it("rejected uses a red color", () => {
    expect(STATUS_STYLE.rejected).toContain("red")
  })

  it("every entry has both a background and a text class", () => {
    for (const status of VALID_STATUS_FILTERS) {
      const cls = STATUS_STYLE[status]
      expect(cls).toMatch(/bg-/)
      expect(cls).toMatch(/text-/)
    }
  })

  it("returns undefined for an unknown status", () => {
    expect(STATUS_STYLE["unknown"]).toBeUndefined()
  })
})

// ── VALID_STATUS_FILTERS ──────────────────────────────────────────────────────

describe("VALID_STATUS_FILTERS", () => {
  it("is a Set", () => {
    expect(VALID_STATUS_FILTERS).toBeInstanceOf(Set)
  })

  it("contains exactly 3 values", () => {
    expect(VALID_STATUS_FILTERS.size).toBe(3)
  })

  it("contains pending, approved, and rejected", () => {
    expect(VALID_STATUS_FILTERS.has("pending")).toBe(true)
    expect(VALID_STATUS_FILTERS.has("approved")).toBe(true)
    expect(VALID_STATUS_FILTERS.has("rejected")).toBe(true)
  })

  it("does not contain the empty catch-all", () => {
    expect(VALID_STATUS_FILTERS.has("")).toBe(false)
  })

  it("does not contain unknown values", () => {
    expect(VALID_STATUS_FILTERS.has("draft")).toBe(false)
    expect(VALID_STATUS_FILTERS.has("active")).toBe(false)
  })
})
