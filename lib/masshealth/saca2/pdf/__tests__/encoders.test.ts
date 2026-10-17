/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"

import { encodeCheckbox, encodeSsn, encodeText, encodeToParts, isCheckboxEncoder, sanitizeText } from "../encoders"

describe("encodeText: date", () => {
  it("formats an ISO date as MM/DD/YYYY", () => {
    expect(encodeText("date", "2026-10-13")).toBe("10/13/2026")
    expect(encodeText("date", "1950-01-05")).toBe("01/05/1950")
  })
  it("returns undefined for empty or malformed input", () => {
    expect(encodeText("date", null)).toBeUndefined()
    expect(encodeText("date", undefined)).toBeUndefined()
    expect(encodeText("date", "")).toBeUndefined()
    expect(encodeText("date", "10/13/2026")).toBeUndefined()
    expect(encodeText("date", 20261013)).toBeUndefined()
  })
  it("returns undefined for impossible calendar dates", () => {
    expect(encodeText("date", "2026-02-30")).toBeUndefined()
    expect(encodeText("date", "2026-13-01")).toBeUndefined()
    expect(encodeText("date", "2026-00-10")).toBeUndefined()
    expect(encodeText("date", "2025-02-29")).toBeUndefined()
    expect(encodeText("date", "2024-02-29")).toBe("02/29/2024")
  })
})

describe("encodeText: money and number", () => {
  it("writes whole dollars plainly and adds cents only when non-zero", () => {
    expect(encodeText("money", 1200)).toBe("1200")
    expect(encodeText("money", 1234.5)).toBe("1234.50")
    expect(encodeText("money", 0)).toBe("0")
    expect(encodeText("money", 19.99)).toBe("19.99")
  })
  it("returns undefined for non-numbers", () => {
    expect(encodeText("money", null)).toBeUndefined()
    expect(encodeText("money", undefined)).toBeUndefined()
    expect(encodeText("money", "12")).toBeUndefined()
    expect(encodeText("money", Number.NaN)).toBeUndefined()
  })
  it("rounds to cents before choosing integer or two-decimal form", () => {
    expect(encodeText("money", 19.999)).toBe("20")
    expect(encodeText("money", 1234.504)).toBe("1234.50")
    expect(encodeText("money", 0.004)).toBe("0")
    expect(encodeText("money", 10.005)).toBe("10.01")
  })
  it("rejects negative, non-finite and absurdly large amounts", () => {
    expect(encodeText("money", -1)).toBeUndefined()
    expect(encodeText("money", -0.01)).toBeUndefined()
    expect(encodeText("money", Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(encodeText("money", 1e15)).toBeUndefined()
    expect(encodeText("money", 999999999999999)).toBe("999999999999999")
  })
  it("writes a number as an integer string", () => {
    expect(encodeText("number", 3)).toBe("3")
    expect(encodeText("number", 0)).toBe("0")
    expect(encodeText("number", null)).toBeUndefined()
  })
  it("avoids floating-point noise and rejects non-finite numbers", () => {
    expect(encodeText("number", 0.1 + 0.2)).toBe("0.3")
    expect(encodeText("number", 2.5)).toBe("2.5")
    expect(encodeText("number", 1.0)).toBe("1")
    expect(encodeText("number", Number.NaN)).toBeUndefined()
    expect(encodeText("number", Number.POSITIVE_INFINITY)).toBeUndefined()
  })
})

describe("encodeText: phone", () => {
  it("formats ten digits", () => {
    expect(encodeText("phone", "6175550100")).toBe("(617) 555-0100")
    expect(encodeText("phone", "617-555-0100")).toBe("(617) 555-0100")
  })
  it("returns undefined unless there are exactly ten digits", () => {
    expect(encodeText("phone", "555-0100")).toBeUndefined()
    expect(encodeText("phone", "")).toBeUndefined()
    expect(encodeText("phone", null)).toBeUndefined()
  })
})

describe("encodeText: text and upper", () => {
  it("passes plain text through and trims", () => {
    expect(encodeText("text", "  Maria  ")).toBe("Maria")
  })
  it("treats blank as absent", () => {
    expect(encodeText("text", "   ")).toBeUndefined()
    expect(encodeText("text", null)).toBeUndefined()
  })
  it("upper-cases", () => {
    expect(encodeText("upper", "ma")).toBe("MA")
  })
})

describe("encodeSsn", () => {
  it("accepts dashed or plain digits and returns exactly nine digits", () => {
    const expected = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
    expect(encodeSsn("123-45-6789")).toEqual(expected)
    expect(encodeSsn("123456789")).toEqual(expected)
  })
  it("never returns a partial result", () => {
    expect(encodeSsn("123-45-678")).toBeUndefined()
    expect(encodeSsn("1234567890")).toBeUndefined()
    expect(encodeSsn("")).toBeUndefined()
    expect(encodeSsn(null)).toBeUndefined()
    expect(encodeSsn(123456789)).toBeUndefined()
  })
})

describe("encodeToParts", () => {
  it("spreads an SSN across the nine boxes and rejects another box count", () => {
    expect(encodeToParts({ kind: "ssn" }, "123-45-6789", 9)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"])
    expect(() => encodeToParts({ kind: "ssn" }, "123-45-6789", 10)).toThrow(/9/)
  })
  it("zero-pads digits to the width", () => {
    expect(encodeToParts({ kind: "digits", width: 4 }, 26, 1)).toEqual(["0026"])
    expect(encodeToParts({ kind: "digits", width: 2 }, "7", 1)).toEqual(["07"])
    expect(encodeToParts({ kind: "digits", width: 4 }, 2026, 4)).toEqual(["2", "0", "2", "6"])
  })
  it("does not truncate digits that exceed the width", () => {
    expect(encodeToParts({ kind: "digits", width: 2 }, 123, 1)).toBeUndefined()
  })
  it("repeats a plain value into every field", () => {
    expect(encodeToParts("text", "Ana", 3)).toEqual(["Ana", "Ana", "Ana"])
  })
  it("returns undefined for an absent value", () => {
    expect(encodeToParts("text", undefined, 2)).toBeUndefined()
    expect(encodeToParts({ kind: "digits", width: 4 }, null, 1)).toBeUndefined()
  })
})

describe("sanitizeText", () => {
  it("removes control characters and keeps everything else", () => {
    expect(sanitizeText("A\u0000B\u0007C\u007fD")).toBe("ABCD")
    expect(sanitizeText("O'Brien-Núñez")).toBe("O'Brien-Núñez")
  })
  it("turns line breaks and tabs into one space and collapses runs of whitespace", () => {
    expect(sanitizeText("12 Main St\nApt 4")).toBe("12 Main St Apt 4")
    expect(sanitizeText("A\r\nB\tC")).toBe("A B C")
    expect(sanitizeText("A   B \n\n C")).toBe("A B C")
  })
  it("replaces unencodable characters with one question mark each, even emoji", () => {
    expect(sanitizeText("Zoë 李")).toBe("Zoë ?")
    expect(sanitizeText("hi 😀!")).toBe("hi ?!")
    expect(sanitizeText("李华")).toBe("??")
  })
  it("keeps Windows-1252 characters Helvetica can draw", () => {
    expect(sanitizeText("“quoted” – € ™")).toBe("“quoted” – € ™")
  })
  it("never throws and keeps the length otherwise", () => {
    const s = "plain text 123"
    expect(sanitizeText(s)).toHaveLength(s.length)
  })
})

describe("encodeCheckbox", () => {
  it("maps yes/no onto the group's own on-states and ignores anything else", () => {
    const enc = { kind: "yesNo", yes: "2", no: "1" } as const
    expect(encodeCheckbox(enc, "yes")).toBe("2")
    expect(encodeCheckbox(enc, "no")).toBe("1")
    expect(encodeCheckbox(enc, "")).toBeUndefined()
    expect(encodeCheckbox(enc, null)).toBeUndefined()
    expect(encodeCheckbox(enc, true)).toBeUndefined()
  })
  it("picks an enum value's state; unknown values leave the group untouched", () => {
    const enc = { kind: "pick", states: { a: "1", b: "3" } } as const
    expect(encodeCheckbox(enc, "b")).toBe("3")
    expect(encodeCheckbox(enc, "c")).toBeUndefined()
    expect(encodeCheckbox(enc, "toString")).toBeUndefined() // not inherited keys
    expect(encodeCheckbox(enc, undefined)).toBeUndefined()
  })
  it("checks a single box only for true", () => {
    expect(encodeCheckbox({ kind: "check" }, true)).toBe("On")
    expect(encodeCheckbox({ kind: "check" }, false)).toBeUndefined()
    expect(encodeCheckbox({ kind: "check" }, "yes")).toBeUndefined()
  })
  it("classifies encoders", () => {
    expect(isCheckboxEncoder({ kind: "check" })).toBe(true)
    expect(isCheckboxEncoder({ kind: "ssn" })).toBe(false)
    expect(isCheckboxEncoder("text")).toBe(false)
  })
})
