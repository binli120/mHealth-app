/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tests for buildAppealTools().
 *
 * Strategy: mock every external dependency so no Ollama, DB, or network calls
 * are made. Each test calls the tool's execute() function directly and asserts
 * on mock invocations and return values.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/rag/retrieve", () => ({
  retrieveRelevantChunks: vi.fn(),
  formatChunksForPrompt: vi.fn(),
}))

import { buildAppealTools } from "@/lib/agents/appeal/tools"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import type { UIMessageStreamWriter } from "ai"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMockWriter() {
  return { write: vi.fn(), merge: vi.fn() } as unknown as UIMessageStreamWriter
}

async function exec<T>(
  tools: ReturnType<typeof buildAppealTools>,
  name: keyof ReturnType<typeof buildAppealTools>,
  args: T,
) {
  const t = tools[name] as { execute?: (args: T) => Promise<unknown> }
  return t.execute!(args)
}

const FINISH_ARGS = {
  explanation: "The denial was based on an incorrect income calculation.",
  appealLetter: "Dear MassHealth Hearings Unit,\n\nI am writing to appeal...\n\nSincerely,\n[APPLICANT NAME]",
  evidenceChecklist: ["Recent pay stubs (last 3 months)", "Tax return (prior year)", "Letter from employer"],
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(retrieveRelevantChunks).mockResolvedValue([])
  vi.mocked(formatChunksForPrompt).mockReturnValue("Appeal policy: 130 CMR 610.000 governs hearings...")
})

// ── retrieve_policy ───────────────────────────────────────────────────────────

describe("retrieve_policy tool", () => {
  it("calls retrieveRelevantChunks with the provided query", async () => {
    const tools = buildAppealTools(makeMockWriter())
    await exec(tools, "retrieve_policy", { query: "MassHealth income exceeds limit appeal procedures" })
    expect(retrieveRelevantChunks).toHaveBeenCalledWith(
      "MassHealth income exceeds limit appeal procedures",
      expect.any(Number),
    )
  })

  it("returns the formatted context string", async () => {
    const tools = buildAppealTools(makeMockWriter())
    const result = await exec(tools, "retrieve_policy", { query: "appeal rights" }) as { context: string }
    expect(result.context).toBe("Appeal policy: 130 CMR 610.000 governs hearings...")
  })

  it("returns a fallback message when no chunks are found", async () => {
    vi.mocked(formatChunksForPrompt).mockReturnValue("")
    const tools = buildAppealTools(makeMockWriter())
    const result = await exec(tools, "retrieve_policy", { query: "residency appeal" }) as { context: string }
    expect(result.context).toMatch(/no policy documents found/i)
  })

  it("gracefully handles retrieveRelevantChunks failures", async () => {
    vi.mocked(retrieveRelevantChunks).mockRejectedValue(new Error("DB unavailable"))
    const tools = buildAppealTools(makeMockWriter())
    await expect(exec(tools, "retrieve_policy", { query: "appeal" })).resolves.toBeDefined()
  })

  it("returns chunkCount reflecting the number of chunks retrieved", async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(["chunk1", "chunk2"] as never)
    const tools = buildAppealTools(makeMockWriter())
    const result = await exec(tools, "retrieve_policy", { query: "residency" }) as { chunkCount: number }
    expect(result.chunkCount).toBe(2)
  })
})

// ── finish_appeal ─────────────────────────────────────────────────────────────

describe("finish_appeal tool", () => {
  it("writes a data-masshealth annotation to the stream writer", async () => {
    const writer = makeMockWriter()
    const tools = buildAppealTools(writer)
    await exec(tools, "finish_appeal", FINISH_ARGS)

    expect(writer.write).toHaveBeenCalledOnce()
    const [written] = vi.mocked(writer.write).mock.calls[0]
    expect((written as { type: string }).type).toBe("data-masshealth")
  })

  it("annotation contains ok:true and the full analysis object", async () => {
    const writer = makeMockWriter()
    const tools = buildAppealTools(writer)
    await exec(tools, "finish_appeal", FINISH_ARGS)

    const [written] = vi.mocked(writer.write).mock.calls[0]
    const data = (written as { data: Record<string, unknown> }).data
    expect(data.ok).toBe(true)
    const analysis = data.analysis as typeof FINISH_ARGS
    expect(analysis.explanation).toBe(FINISH_ARGS.explanation)
    expect(analysis.appealLetter).toContain("[APPLICANT NAME]")
    expect(analysis.evidenceChecklist).toHaveLength(3)
  })

  it("returns committed:true", async () => {
    const tools = buildAppealTools(makeMockWriter())
    const result = await exec(tools, "finish_appeal", FINISH_ARGS) as { committed: boolean }
    expect(result.committed).toBe(true)
  })

  it("returns a nextStep instruction to stream a summary", async () => {
    const tools = buildAppealTools(makeMockWriter())
    const result = await exec(tools, "finish_appeal", FINISH_ARGS) as { nextStep: string }
    expect(result.nextStep).toMatch(/appeal letter/i)
  })

  it("does not call retrieveRelevantChunks — finish_appeal is write-only", async () => {
    const writer = makeMockWriter()
    const tools = buildAppealTools(writer)
    await exec(tools, "finish_appeal", FINISH_ARGS)
    expect(retrieveRelevantChunks).not.toHaveBeenCalled()
  })
})
