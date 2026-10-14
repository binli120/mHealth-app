/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { calculateAge } from "@/lib/masshealth/saca2/age"

const ON = new Date("2026-10-13T12:00:00Z")

describe("calculateAge", () => {
  it("counts a person turning 65 on the reference date as 65", () => {
    expect(calculateAge("1961-10-13", ON)).toBe(65)
  })

  it("counts a person turning 65 tomorrow as 64", () => {
    expect(calculateAge("1961-10-14", ON)).toBe(64)
  })

  it("handles Feb 29 birthdays without throwing", () => {
    expect(calculateAge("1960-02-29", new Date("2026-02-28T12:00:00Z"))).toBe(65)
    expect(calculateAge("1960-02-29", new Date("2026-03-01T12:00:00Z"))).toBe(66)
  })

  it("returns null for missing, empty, malformed, impossible, or future dates", () => {
    expect(calculateAge(null, ON)).toBeNull()
    expect(calculateAge(undefined, ON)).toBeNull()
    expect(calculateAge("", ON)).toBeNull()
    expect(calculateAge("not-a-date", ON)).toBeNull()
    expect(calculateAge("2026-02-30", ON)).toBeNull()
    expect(calculateAge("2027-01-01", ON)).toBeNull()
  })
})
