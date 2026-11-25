/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStateCode, validateZip } from "@/lib/masshealth/saca2/questions/validators"

describe("validateStateCode", () => {
  it.each(["MA", "ma"])("accepts %s", (v) => expect(validateStateCode(v)).toBeNull())
  it.each(["M", "MAS", "1A", ""])("rejects %j with the exact message", (v) =>
    expect(validateStateCode(v)).toBe("Enter the 2-letter state code."),
  )
})

describe("validateZip", () => {
  it.each(["02101", "02101-1234"])("accepts %s", (v) => expect(validateZip(v)).toBeNull())
  it.each(["0210", "021011", "abcde", "02101-12"])("rejects %j with the exact message", (v) =>
    expect(validateZip(v)).toBe("Enter a 5-digit ZIP code."),
  )
})
