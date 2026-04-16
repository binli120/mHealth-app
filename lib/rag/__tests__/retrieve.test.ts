/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect } from "vitest"

import { formatChunksForPrompt } from "../retrieve"
import { buildRagQualityMetadata } from "../metadata"
import type { PolicyChunk } from "../types"

function makeChunk(overrides: Partial<PolicyChunk> = {}): PolicyChunk {
  return {
    id: "chunk-1",
    documentId: "doc-1",
    chunkIndex: 0,
    content: "MassHealth provides health coverage to eligible Massachusetts residents.",
    score: 0.85,
    documentTitle: "MassHealth Member Booklet",
    sourceUrl: "https://www.mass.gov/doc/member-booklet/download",
    docType: "member_booklet",
    ...overrides,
  }
}

// ── formatChunksForPrompt ─────────────────────────────────────────────────────

describe("formatChunksForPrompt", () => {
  it("returns empty string for empty array", () => {
    expect(formatChunksForPrompt([])).toBe("")
  })

  it("formats a single chunk with label [1]", () => {
    const result = formatChunksForPrompt([makeChunk()])
    expect(result).toContain("[1]")
    expect(result).toContain("MassHealth Member Booklet")
    expect(result).toContain("MassHealth provides health coverage")
  })

  it("numbers multiple chunks sequentially from 1", () => {
    const chunks = [
      makeChunk({ id: "a", documentTitle: "Doc A" }),
      makeChunk({ id: "b", documentTitle: "Doc B" }),
      makeChunk({ id: "c", documentTitle: "Doc C" }),
    ]
    const result = formatChunksForPrompt(chunks)
    expect(result).toContain("[1]")
    expect(result).toContain("[2]")
    expect(result).toContain("[3]")
    expect(result).not.toContain("[4]")
  })

  it("separates chunks with a double newline", () => {
    const chunks = [makeChunk({ id: "a" }), makeChunk({ id: "b" })]
    expect(formatChunksForPrompt(chunks)).toContain("\n\n")
  })

  it("falls back to 'MassHealth Policy' when documentTitle is undefined", () => {
    const result = formatChunksForPrompt([makeChunk({ documentTitle: undefined })])
    expect(result).toContain("MassHealth Policy")
  })

  it("truncates content longer than 600 chars", () => {
    const chunk = makeChunk({ content: "x".repeat(1200) })
    const result = formatChunksForPrompt([chunk])
    const match = result.match(/"(.+)"/)
    expect(match?.[1]?.length).toBeLessThanOrEqual(600)
  })

  it("wraps content in double quotes", () => {
    expect(formatChunksForPrompt([makeChunk()])).toMatch(/"[^"]+"/)
  })

  it("collapses internal whitespace and newlines in content", () => {
    const chunk = makeChunk({ content: "word1   \n\n   word2" })
    const result = formatChunksForPrompt([chunk])
    expect(result).not.toContain("\n")
    expect(result).toContain("word1 word2")
  })

  it("includes the document title before the content", () => {
    const chunk = makeChunk({ documentTitle: "Eligibility Guide", content: "Income limits apply." })
    const result = formatChunksForPrompt([chunk])
    const titleIndex = result.indexOf("Eligibility Guide")
    const contentIndex = result.indexOf("Income limits apply.")
    expect(titleIndex).toBeLessThan(contentIndex)
  })
})

// ── buildRagQualityMetadata ──────────────────────────────────────────────────

describe("buildRagQualityMetadata", () => {
  it("summarizes chunk scores and official source metadata", () => {
    const result = buildRagQualityMetadata("CarePlus", [
      makeChunk({ id: "a", score: 0.9 }),
      makeChunk({ id: "b", score: 0.8, documentTitle: "Eligibility Guide", docType: "eligibility_guide" }),
    ], 4)

    expect(result.query).toBe("CarePlus")
    expect(result.requestedTopK).toBe(4)
    expect(result.returnedChunkCount).toBe(2)
    expect(result.confidence).toBe("high")
    expect(result.maxScore).toBe(0.9)
    expect(result.averageScore).toBe(0.85)
    expect(result.citationCoverage).toEqual({
      citedChunkCount: 2,
      coverageRatio: 1,
      hasCitations: true,
    })
    expect(result.sources[0]).toMatchObject({
      title: "MassHealth Member Booklet",
      sourceTier: "official",
      sourceType: "member_booklet",
      score: 0.9,
    })
  })

  it("returns confidence none when no policy chunks are retrieved", () => {
    const result = buildRagQualityMetadata("unknown", [], 4)

    expect(result.returnedChunkCount).toBe(0)
    expect(result.confidence).toBe("none")
    expect(result.maxScore).toBeNull()
    expect(result.averageScore).toBeNull()
    expect(result.citationCoverage.hasCitations).toBe(false)
  })

  it("ignores malformed chunk values when building metadata", () => {
    const result = buildRagQualityMetadata("appeal", ["chunk1", null, makeChunk()] as unknown[], 4)

    expect(result.returnedChunkCount).toBe(1)
    expect(result.sources).toHaveLength(1)
  })
})
