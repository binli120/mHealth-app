/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tests for buildChatTools().
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/rag/retrieve", () => ({
  retrieveRelevantChunks: vi.fn(),
  formatChunksForPrompt: vi.fn(),
}))

import { buildChatTools } from "@/lib/agents/chat/tools"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import type { PolicyChunk } from "@/lib/rag/types"

const POLICY_CHUNK: PolicyChunk = {
  id: "chunk-1",
  documentId: "doc-1",
  chunkIndex: 0,
  content: "CarePlus covers adults.",
  score: 0.86,
  documentTitle: "MassHealth Member Booklet",
  sourceUrl: "https://www.mass.gov/doc/member-booklet/download",
  docType: "member_booklet",
}

function makeMockWriter() {
  return { write: vi.fn(), merge: vi.fn() }
}

async function exec<T>(
  tools: ReturnType<typeof buildChatTools>,
  name: keyof ReturnType<typeof buildChatTools>,
  args: T,
) {
  const t = tools[name] as { execute?: (args: T) => Promise<unknown> }
  return t.execute!(args)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(retrieveRelevantChunks).mockResolvedValue([])
  vi.mocked(formatChunksForPrompt).mockReturnValue("Policy context: CarePlus covers adults 21-64...")
})

describe("retrieve_policy tool", () => {
  it("calls retrieveRelevantChunks with the provided query", async () => {
    const tools = buildChatTools()
    await exec(tools, "retrieve_policy", { query: "MassHealth CarePlus income limits" })
    expect(retrieveRelevantChunks).toHaveBeenCalledWith("MassHealth CarePlus income limits", expect.any(Number))
  })

  it("returns the formatted context string", async () => {
    const tools = buildChatTools()
    const result = await exec(tools, "retrieve_policy", { query: "CarePlus" }) as { context: string }
    expect(result.context).toBe("Policy context: CarePlus covers adults 21-64...")
  })

  it("returns RAG quality metadata with source scores", async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue([POLICY_CHUNK])
    const tools = buildChatTools()
    const result = await exec(tools, "retrieve_policy", { query: "CarePlus" }) as {
      rag: { confidence: string; sources: Array<{ score: number; sourceTier: string }> }
    }

    expect(result.rag.confidence).toBe("high")
    expect(result.rag.sources[0]).toMatchObject({ score: 0.86, sourceTier: "official" })
  })

  it("emits RAG quality metadata when a stream writer is provided", async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue([POLICY_CHUNK])
    const writer = makeMockWriter()
    const tools = buildChatTools(writer as never)

    await exec(tools, "retrieve_policy", { query: "CarePlus" })

    expect(writer.write).toHaveBeenCalledWith({
      type: "data-masshealth",
      data: expect.objectContaining({
        ok: true,
        rag: expect.objectContaining({ confidence: "high" }),
      }),
    })
  })

  it("returns a fallback message when no chunks are found", async () => {
    vi.mocked(formatChunksForPrompt).mockReturnValue("")
    const tools = buildChatTools()
    const result = await exec(tools, "retrieve_policy", { query: "something obscure" }) as { context: string }
    expect(result.context).toMatch(/no policy documents found/i)
  })

  it("returns chunkCount reflecting how many chunks were retrieved", async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(["chunk1", "chunk2", "chunk3"] as never)
    const tools = buildChatTools()
    const result = await exec(tools, "retrieve_policy", { query: "appeal" }) as { chunkCount: number }
    expect(result.chunkCount).toBe(3)
  })

  it("uses the custom topK when provided", async () => {
    const tools = buildChatTools()
    await exec(tools, "retrieve_policy", { query: "income", topK: 2 })
    expect(retrieveRelevantChunks).toHaveBeenCalledWith("income", 2)
  })

  it("gracefully handles retrieveRelevantChunks failures", async () => {
    vi.mocked(retrieveRelevantChunks).mockRejectedValue(new Error("DB unavailable"))
    const tools = buildChatTools()
    await expect(exec(tools, "retrieve_policy", { query: "CarePlus" })).resolves.toBeDefined()
  })
})
