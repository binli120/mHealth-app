/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

import { toVectorLiteral, embedText, embedBatch } from "../embed"

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
    expect(toVectorLiteral(embedding)).toBe("[0.123456789,-0.987654321]")
  })

  it("handles negative values", () => {
    expect(toVectorLiteral([-1, 0, 1])).toBe("[-1,0,1]")
  })

  it("produces a string parseable back to the original array", () => {
    const embedding = [0.1, -0.2, 0.3]
    const parsed = JSON.parse(toVectorLiteral(embedding)) as number[]
    expect(parsed).toEqual(embedding)
  })
})

// ── embedText ─────────────────────────────────────────────────────────────────

describe("embedText", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns a 768-element embedding on success", async () => {
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

  it("sends the correct model and prompt to Ollama", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1] }),
      text: async () => "",
    })
    vi.stubGlobal("fetch", fetchMock)

    await embedText("test input")

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>
    expect(body.model).toBe("nomic-embed-text")
    expect(body.prompt).toBe("test input")
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

  it("throws when embedding field is missing from response", async () => {
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

  it("returns empty array for empty input without calling fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await embedBatch([], 0)
    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("calls fetch exactly once per text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [1, 2, 3] }),
      text: async () => "",
    })
    vi.stubGlobal("fetch", fetchMock)

    await embedBatch(["a", "b", "c"], 0)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("preserves order of embeddings matching input order", async () => {
    let callCount = 0
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      const idx = callCount++
      return Promise.resolve({
        ok: true,
        json: async () => ({ embedding: [idx] }),
        text: async () => "",
      })
    }))

    const result = await embedBatch(["first", "second", "third"], 0)
    expect(result[0]).toEqual([0])
    expect(result[1]).toEqual([1])
    expect(result[2]).toEqual([2])
  })
})
