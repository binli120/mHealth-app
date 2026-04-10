/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import {
  MAX_REASONABLE_AGE_YEARS,
  getDobInputBounds,
  getDobValidation,
  parseDateInput,
} from "@/lib/utils/date-of-birth"

describe("lib/utils/date-of-birth", () => {
  it("parses valid ISO date input", () => {
    const parsed = parseDateInput("2000-01-15")

    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(2000)
    expect(parsed?.getMonth()).toBe(0)
    expect(parsed?.getDate()).toBe(15)
  })

  it("rejects invalid dates", () => {
    expect(parseDateInput("2000-02-30")).toBeNull()
    expect(parseDateInput("invalid")).toBeNull()
  })

  it("provides min and max input bounds", () => {
    const bounds = getDobInputBounds(new Date("2026-03-03T12:00:00Z"))

    expect(bounds.max).toBe("2026-03-03")
    expect(bounds.min).toBe(`${2026 - MAX_REASONABLE_AGE_YEARS}-03-03`)
  })

  it("rejects future date of birth", () => {
    const validation = getDobValidation("2026-03-04", new Date("2026-03-03T12:00:00Z"))

    expect(validation.valid).toBe(false)
    expect(validation.error).toBe("Date of birth cannot be in the future.")
  })

  it("rejects date older than max reasonable age", () => {
    const validation = getDobValidation("1900-01-01", new Date("2026-03-03T12:00:00Z"))

    expect(validation.valid).toBe(false)
    expect(validation.error).toContain("cannot be more than")
  })

  it("accepts valid date in range", () => {
    const validation = getDobValidation("1990-10-20", new Date("2026-03-03T12:00:00Z"))

    expect(validation).toEqual({ valid: true })
  })

  // ── parseDateInput edge cases ─────────────────────────────────────────────

  it("rejects wrong format patterns", () => {
    expect(parseDateInput("01/15/2000")).toBeNull()  // MM/DD/YYYY
    expect(parseDateInput("2000/01/15")).toBeNull()  // slashes
    expect(parseDateInput("")).toBeNull()
    expect(parseDateInput("2000-1-5")).toBeNull()    // non-padded
  })

  it("rejects Feb 29 on non-leap year", () => {
    expect(parseDateInput("2023-02-29")).toBeNull()
  })

  it("accepts Feb 29 on leap year", () => {
    const result = parseDateInput("2000-02-29")
    expect(result).not.toBeNull()
    expect(result?.getDate()).toBe(29)
  })

  it("sets time to midnight (start of day)", () => {
    const result = parseDateInput("1990-06-15")
    expect(result?.getHours()).toBe(0)
    expect(result?.getMinutes()).toBe(0)
    expect(result?.getSeconds()).toBe(0)
  })

  // ── getDobValidation — empty value ────────────────────────────────────────

  it("returns error for empty value", () => {
    const validation = getDobValidation("")
    expect(validation.valid).toBe(false)
    expect(validation.error).toBe("Date of birth is required.")
  })

  it("returns error for invalid date string", () => {
    const validation = getDobValidation("not-a-date")
    expect(validation.valid).toBe(false)
    expect(validation.error).toBe("Enter a valid date of birth.")
  })

  // ── getDobInputBounds ─────────────────────────────────────────────────────

  it("max bound equals today's date", () => {
    const today = new Date("2026-04-08T15:00:00Z")
    const bounds = getDobInputBounds(today)
    expect(bounds.max).toBe("2026-04-08")
  })

  it("min bound is exactly MAX_REASONABLE_AGE_YEARS back", () => {
    // Use local date constructor to avoid timezone-offset day shifting
    const today = new Date(2026, 3, 8) // April 8, 2026 local time
    const bounds = getDobInputBounds(today)
    expect(bounds.min).toBe(`${2026 - MAX_REASONABLE_AGE_YEARS}-04-08`)
  })
})
