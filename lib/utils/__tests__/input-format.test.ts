import { describe, expect, it } from "vitest"

import {
  formatCurrency,
  formatPhoneNumber,
  formatSsn,
  parseCurrency,
} from "@/lib/utils/input-format"

describe("lib/utils/input-format", () => {
  it("formats phone number while typing", () => {
    expect(formatPhoneNumber("")).toBe("")
    expect(formatPhoneNumber("1")).toBe("(1")
    expect(formatPhoneNumber("123")).toBe("(123")
    expect(formatPhoneNumber("1234")).toBe("(123)4")
    expect(formatPhoneNumber("1234567")).toBe("(123)456-7")
    expect(formatPhoneNumber("1234567890")).toBe("(123)456-7890")
  })

  it("normalizes non-digit phone input and clamps length", () => {
    expect(formatPhoneNumber("(123) 456-7890")).toBe("(123)456-7890")
    expect(formatPhoneNumber("123-456-7890123")).toBe("(123)456-7890")
  })

  it("formats ssn while typing", () => {
    expect(formatSsn("")).toBe("")
    expect(formatSsn("1")).toBe("1")
    expect(formatSsn("123")).toBe("123")
    expect(formatSsn("1234")).toBe("123-4")
    expect(formatSsn("123456")).toBe("123-45-6")
    expect(formatSsn("123456789")).toBe("123-45-6789")
  })

  it("normalizes non-digit ssn input and clamps length", () => {
    expect(formatSsn("123-45-6789")).toBe("123-45-6789")
    expect(formatSsn("123-45-678901")).toBe("123-45-6789")
  })

  it("formats currency values while typing", () => {
    expect(formatCurrency("")).toBe("")
    expect(formatCurrency("0")).toBe("$0")
    expect(formatCurrency("1000")).toBe("$1,000")
    expect(formatCurrency("001234")).toBe("$1,234")
    expect(formatCurrency("1234.5")).toBe("$1,234.5")
    expect(formatCurrency("1234.567")).toBe("$1,234.56")
    expect(formatCurrency("$1,234.56")).toBe("$1,234.56")
  })

  it("parses currency values to numbers", () => {
    expect(parseCurrency("")).toBe(0)
    expect(parseCurrency("$0")).toBe(0)
    expect(parseCurrency("$1,234.56")).toBe(1234.56)
    expect(parseCurrency("abc")).toBe(0)
  })
})
