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
})
