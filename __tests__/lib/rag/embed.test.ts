import { describe, it, expect, vi, beforeEach } from "vitest"

import { toVectorLiteral, embedText, embedBatch } from "@/lib/rag/embed"

// ── toVectorLiteral ───────────────────────────────────────────────────────────

describe("toVectorLiteral", () => {
  it("formats an empty array", () => {
    expect(toVectorLiteral([])).toBe("[]")
  })

  it("formats a single-element array", () => {
    expect(toVectorLiteral([0.5])).toBe("[0.5]")
  })

  it("formats a multi-element array without spaces", () => {
    expect(toVectorLiteral([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]")
  })

  it("preserves full float precision", () => {
    const embedding = [0.123456789, -0.987654321]
    const result = toVectorLiteral(embedding)
    expect(result).toBe("[0.123456789,-0.987654321]")
  })

  it("handles negative values", () => {
    expect(toVectorLiteral([-1, 0, 1])).toBe("[-1,0,1]")
  })

  it("produces a string parseable back to the original array", () => {
    const embedding = [0.1, -0.2, 0.3]
    const literal = toVectorLiteral(embedding)
    const parsed = JSON.parse(literal) as number[]
    expect(parsed).toEqual(embedding)
  })
})

// ── embedText ─────────────────────────────────────────────────────────────────

describe("embedText", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns embedding array on success", async () => {
    const fakeEmbedding = Array.from({ length: 768 }, (_, i) => i / 768)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: fakeEmbedding }),
      text: async () => "",
    }))

    const result = await embedText("hello world")
    expect(result).toHaveLength(768)
    expect(result[0]).toBeCloseTo(0)
  })

  it("throws when HTTP response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    }))

    await expect(embedText("test")).rejects.toThrow("503")
  })

  it("throws when Ollama returns empty embedding", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [] }),
      text: async () => "",
    }))

    await expect(embedText("test")).rejects.toThrow("empty embedding")
  })

  it("throws when embedding field is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => "",
    }))

    await expect(embedText("test")).rejects.toThrow("empty embedding")
  })
})

// ── embedBatch ────────────────────────────────────────────────────────────────

describe("embedBatch", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns an embedding for each input text", async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3]
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: fakeEmbedding }),
      text: async () => "",
    }))

    const result = await embedBatch(["text one", "text two", "text three"], 0)
    expect(result).toHaveLength(3)
    result.forEach((emb) => expect(emb).toEqual(fakeEmbedding))
  })

  it("returns empty array for empty input", async () => {
    const result = await embedBatch([], 0)
    expect(result).toEqual([])
  })

  it("calls fetch once per text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [1, 2, 3] }),
      text: async () => "",
    })
    vi.stubGlobal("fetch", fetchMock)

    await embedBatch(["a", "b", "c"], 0)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
