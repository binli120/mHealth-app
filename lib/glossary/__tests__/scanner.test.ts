import { describe, it, expect } from "vitest"
import { findTermsInText } from "../scanner"
import type { GlossaryIndex } from "../types"

const INDEX: GlossaryIndex = [
  { slug: "deductible", term_en: "Deductible", aliases: [], category: "insurance" },
  { slug: "copayment", term_en: "Copayment", aliases: ["co-pay", "copay"], category: "insurance" },
  { slug: "out-of-pocket-maximum", term_en: "Out-of-Pocket Maximum", aliases: ["out-of-pocket limit"], category: "insurance" },
  { slug: "pcp", term_en: "Primary Care Provider", aliases: ["PCP"], category: "medical" },
]

describe("findTermsInText", () => {
  it("returns a single text segment for text with no matches", () => {
    const segments = findTermsInText("Hello world", INDEX)
    expect(segments).toEqual([{ type: "text", content: "Hello world" }])
  })

  it("detects a term by slug display name (case-insensitive)", () => {
    const segments = findTermsInText("Your deductible resets each year.", INDEX)
    expect(segments).toContainEqual(
      expect.objectContaining({ type: "term", slug: "deductible" })
    )
  })

  it("detects a term by alias", () => {
    const segments = findTermsInText("Pay your co-pay at the desk.", INDEX)
    expect(segments).toContainEqual(
      expect.objectContaining({ type: "term", slug: "copayment" })
    )
  })

  it("matches longest alias first (out-of-pocket limit before out-of-pocket)", () => {
    const segments = findTermsInText("You have an out-of-pocket limit of $3,000.", INDEX)
    expect(segments).toContainEqual(
      expect.objectContaining({ type: "term", slug: "out-of-pocket-maximum" })
    )
  })

  it("preserves original casing in matched content", () => {
    const segments = findTermsInText("Your DEDUCTIBLE is $500.", INDEX)
    const term = segments.find((s) => s.type === "term")
    expect(term?.content).toBe("DEDUCTIBLE")
  })

  it("does not match partial words", () => {
    const segments = findTermsInText("non-deductible expenses", INDEX)
    expect(segments.every((s) => s.type === "text")).toBe(true)
  })

  it("produces text segments between terms", () => {
    const segments = findTermsInText("Your deductible and copay matter.", INDEX)
    const types = segments.map((s) => s.type)
    expect(types).toEqual(["text", "term", "text", "term", "text"])
  })

  it("handles empty string", () => {
    expect(findTermsInText("", INDEX)).toEqual([])
  })

  it("handles empty index", () => {
    const segments = findTermsInText("Your deductible", [])
    expect(segments).toEqual([{ type: "text", content: "Your deductible" }])
  })
})
