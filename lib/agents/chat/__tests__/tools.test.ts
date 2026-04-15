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
