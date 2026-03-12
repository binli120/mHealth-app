import { describe, it, expect } from "vitest"

import { formatChunksForPrompt } from "@/lib/rag/retrieve"
import type { PolicyChunk } from "@/lib/rag/types"

function makeChunk(overrides: Partial<PolicyChunk> = {}): PolicyChunk {
  return {
    id: "chunk-1",
    documentId: "doc-1",
    chunkIndex: 0,
    content: "MassHealth provides health coverage to eligible Massachusetts residents.",
    score: 0.85,
    documentTitle: "MassHealth Member Booklet",
    ...overrides,
  }
}

// ── formatChunksForPrompt ─────────────────────────────────────────────────────

describe("formatChunksForPrompt", () => {
  it("returns empty string for empty chunk array", () => {
    expect(formatChunksForPrompt([])).toBe("")
  })

  it("formats a single chunk with index 1", () => {
    const result = formatChunksForPrompt([makeChunk()])
    expect(result).toContain("[1]")
    expect(result).toContain("MassHealth Member Booklet")
    expect(result).toContain("MassHealth provides health coverage")
  })

  it("numbers chunks sequentially starting at 1", () => {
    const chunks = [
      makeChunk({ id: "a", documentTitle: "Doc A", chunkIndex: 0 }),
      makeChunk({ id: "b", documentTitle: "Doc B", chunkIndex: 1 }),
      makeChunk({ id: "c", documentTitle: "Doc C", chunkIndex: 2 }),
    ]
    const result = formatChunksForPrompt(chunks)
    expect(result).toContain("[1]")
    expect(result).toContain("[2]")
    expect(result).toContain("[3]")
  })

  it("separates chunks with double newline", () => {
    const chunks = [makeChunk({ id: "a" }), makeChunk({ id: "b" })]
    const result = formatChunksForPrompt(chunks)
    expect(result).toContain("\n\n")
  })

  it("falls back to 'MassHealth Policy' when documentTitle is missing", () => {
    const chunk = makeChunk({ documentTitle: undefined })
    const result = formatChunksForPrompt([chunk])
    expect(result).toContain("MassHealth Policy")
  })

  it("truncates very long content to at most 600 chars in the prompt", () => {
    const longContent = "x".repeat(1200)
    const chunk = makeChunk({ content: longContent })
    const result = formatChunksForPrompt([chunk])
    // The content portion inside quotes should not exceed 600 chars
    const match = result.match(/"(.+)"/)
    expect(match?.[1]?.length).toBeLessThanOrEqual(600)
  })

  it("wraps content in double quotes", () => {
    const result = formatChunksForPrompt([makeChunk()])
    expect(result).toMatch(/"[^"]+"/)
  })

  it("collapses internal whitespace in content", () => {
    const chunk = makeChunk({ content: "word1   \n\n   word2" })
    const result = formatChunksForPrompt([chunk])
    expect(result).not.toContain("\n")
    expect(result).toContain("word1 word2")
  })
})
