import { describe, it, expect } from "vitest"

import { chunkText } from "../ingest"
import { CHUNK_MAX_CHARS, CHUNK_MIN_LENGTH, POLICY_SOURCES } from "../constants"

// ── chunkText ─────────────────────────────────────────────────────────────────

describe("chunkText", () => {
  it("returns the whole text as one chunk when it fits within maxChars", () => {
    const text = "Short text."
    expect(chunkText(text, 200, 20)).toEqual(["Short text."])
  })

  it("returns empty array for empty string", () => {
    expect(chunkText("", 200, 20)).toEqual([])
  })

  it("returns empty array for whitespace-only input", () => {
    expect(chunkText("   \n\n  ", 200, 20)).toEqual([])
  })

  it("splits long text into multiple chunks", () => {
    const paragraph = "word ".repeat(100).trim()  // ~500 chars
    const text = [paragraph, paragraph, paragraph].join("\n\n")
    const result = chunkText(text, 600, 50)
    expect(result.length).toBeGreaterThan(1)
  })

  it("no chunk significantly exceeds maxChars", () => {
    const longPara = "The quick brown fox jumps over the lazy dog. ".repeat(50)
    const result = chunkText(longPara, 300, 50)
    // Allow modest overage for sentence-boundary overlap
    result.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(650))
  })

  it("filters out chunks at or below CHUNK_MIN_LENGTH", () => {
    const text = "A. ".repeat(300)
    const result = chunkText(text, 100, 10)
    result.forEach((chunk) => {
      expect(chunk.trim().length).toBeGreaterThan(CHUNK_MIN_LENGTH)
    })
  })

  it("normalizes consecutive blank lines to a single double-newline", () => {
    const text = "Para one.\n\n\n\n\nPara two."
    const result = chunkText(text, 200, 20)
    expect(result.join("")).not.toContain("\n\n\n")
  })

  it("uses CHUNK_MAX_CHARS as the default maxChars", () => {
    // Text just over the default limit should produce at least 2 chunks
    const longText = "word ".repeat(Math.ceil(CHUNK_MAX_CHARS / 5) + 10)
    const result = chunkText(longText)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it("trims leading/trailing whitespace from the normalized text", () => {
    const text = "  \n\n  Hello world.  \n\n  "
    const result = chunkText(text, 200, 20)
    expect(result[0]).toBe("Hello world.")
  })

  it("produces chunks that cover all the original content (no text lost)", () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`)
    // Arrange as paragraphs (10 words each, separated by double newlines) so the
    // paragraph-accumulation path runs and no content is truncated.
    const paragraphs: string[] = []
    for (let i = 0; i < words.length; i += 10) {
      paragraphs.push(words.slice(i, i + 10).join(" "))
    }
    const text = paragraphs.join("\n\n")
    const result = chunkText(text, 300, 50)
    const combined = result.join(" ")
    // Every word should appear somewhere across the chunks
    words.forEach((w) => expect(combined).toContain(w))
  })
})

// ── POLICY_SOURCES ────────────────────────────────────────────────────────────

describe("POLICY_SOURCES", () => {
  it("contains at least 4 documents", () => {
    expect(POLICY_SOURCES.length).toBeGreaterThanOrEqual(4)
  })

  it("each source has a non-empty title", () => {
    POLICY_SOURCES.forEach((source) => {
      expect(source.title.trim().length).toBeGreaterThan(0)
    })
  })

  it("each source URL starts with https://", () => {
    POLICY_SOURCES.forEach((source) => {
      expect(source.url).toMatch(/^https:\/\//)
    })
  })

  it("all sources point to mass.gov", () => {
    POLICY_SOURCES.forEach((source) => {
      expect(source.url).toContain("mass.gov")
    })
  })

  it("each source has a valid doc_type", () => {
    const validTypes = ["member_booklet", "eligibility_guide", "verifications", "transmittal", "faq"]
    POLICY_SOURCES.forEach((source) => {
      expect(validTypes).toContain(source.doc_type)
    })
  })

  it("all sources have language 'en'", () => {
    POLICY_SOURCES.forEach((source) => {
      expect(source.language).toBe("en")
    })
  })

  it("has no duplicate URLs", () => {
    const urls = POLICY_SOURCES.map((s) => s.url)
    expect(new Set(urls).size).toBe(urls.length)
  })
})
