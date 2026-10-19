/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { isIsoDate, isoDay, isoMonthsBefore } from "@/lib/masshealth/saca2/eligibility/dates"

describe("dates", () => {
  it("isoDay uses the UTC calendar day", () => {
    expect(isoDay(new Date("2026-10-13T12:00:00Z"))).toBe("2026-10-13")
  })

  it("isoMonthsBefore keeps the day and clamps to the month's last day", () => {
    expect(isoMonthsBefore(new Date("2026-10-13T12:00:00Z"), 60)).toBe("2021-10-13")
    expect(isoMonthsBefore(new Date("2028-02-29T12:00:00Z"), 60)).toBe("2023-02-28")
    expect(isoMonthsBefore(new Date("2026-03-31T12:00:00Z"), 1)).toBe("2026-02-28")
    expect(isoMonthsBefore(new Date("2026-01-15T12:00:00Z"), 13)).toBe("2024-12-15")
  })

  it("isIsoDate accepts only real YYYY-MM-DD strings", () => {
    expect(isIsoDate("2024-02-29")).toBe(true)
    expect(isIsoDate("2026-02-30")).toBe(false)
    expect(isIsoDate("03/15/2024")).toBe(false)
    expect(isIsoDate(null)).toBe(false)
    expect(isIsoDate(20240315)).toBe(false)
  })
})
