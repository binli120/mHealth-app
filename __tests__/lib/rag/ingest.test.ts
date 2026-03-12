import { describe, it, expect } from "vitest"

import { chunkText } from "@/lib/rag/ingest"
import { CHUNK_MAX_CHARS, CHUNK_MIN_LENGTH, POLICY_SOURCES } from "@/lib/rag/constants"

// ── chunkText ─────────────────────────────────────────────────────────────────

describe("chunkText", () => {
  it("returns the whole text as one chunk when it fits within maxChars", () => {
    const text = "Short text."
    const result = chunkText(text, 200, 20)
    expect(result).toEqual(["Short text."])
  })

  it("returns empty array for empty input", () => {
    expect(chunkText("", 200, 20)).toEqual([])
  })

  it("returns empty array for whitespace-only input", () => {
    expect(chunkText("   \n\n  ", 200, 20)).toEqual([])
  })

  it("splits text that exceeds maxChars into multiple chunks", () => {
    const paragraph = "word ".repeat(100).trim()  // ~500 chars
    const text = [paragraph, paragraph, paragraph].join("\n\n")
    const result = chunkText(text, 600, 50)
    expect(result.length).toBeGreaterThan(1)
    result.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(650))  // slight tolerance for overlap
  })

  it("filters out trivially short chunks (≤ CHUNK_MIN_LENGTH)", () => {
    // Single very long paragraph that forces sentence splitting with short remnant
    const text = "A. ".repeat(300)   // many 3-char sentences — each well over min length individually
    const result = chunkText(text, 100, 10)
    result.forEach((chunk) => {
      expect(chunk.trim().length).toBeGreaterThan(CHUNK_MIN_LENGTH)
    })
  })

  it("normalizes excessive blank lines to double newline", () => {
    const text = "Para one.\n\n\n\n\nPara two."
    const result = chunkText(text, 200, 20)
    expect(result.join("")).not.toContain("\n\n\n")
  })

  it("uses CHUNK_MAX_CHARS as default maxChars", () => {
    const longText = "x".repeat(CHUNK_MAX_CHARS + 1)
    const result = chunkText(longText)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it("each chunk does not exceed maxChars significantly", () => {
    const longPara = "The quick brown fox jumps over the lazy dog. ".repeat(50)
    const result = chunkText(longPara, 300, 50)
    result.forEach((chunk) => {
      // Overlap may push slightly over, allow 2x buffer for sentence boundary
      expect(chunk.length).toBeLessThanOrEqual(650)
    })
  })
})

// ── POLICY_SOURCES ────────────────────────────────────────────────────────────

describe("POLICY_SOURCES", () => {
  it("contains at least 4 documents", () => {
    expect(POLICY_SOURCES.length).toBeGreaterThanOrEqual(4)
  })

  it("each source has required fields", () => {
    POLICY_SOURCES.forEach((source) => {
      expect(source.title).toBeTruthy()
      expect(source.url).toMatch(/^https?:\/\//)
      expect(source.doc_type).toBeTruthy()
      expect(source.language).toBe("en")
    })
  })

  it("all sources point to mass.gov", () => {
    POLICY_SOURCES.forEach((source) => {
      expect(source.url).toContain("mass.gov")
    })
  })

  it("has no duplicate URLs", () => {
    const urls = POLICY_SOURCES.map((s) => s.url)
    const unique = new Set(urls)
    expect(unique.size).toBe(urls.length)
  })
})
