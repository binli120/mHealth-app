/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tests for buildFormAssistantTools().
 *
 * Strategy: mock every external dependency so no Ollama, DB, or network calls
 * are made. Each test calls the tool's execute() function directly and asserts
 * on mock invocations and return values.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/masshealth/form-field-extraction", () => ({
  extractFormFields: vi.fn(),
}))

vi.mock("@/lib/rag/retrieve", () => ({
  retrieveRelevantChunks: vi.fn(),
  formatChunksForPrompt: vi.fn(),
}))

import { buildFormAssistantTools } from "@/lib/agents/form-assistant/tools"
import { extractFormFields } from "@/lib/masshealth/form-field-extraction"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import type { UIMessageStreamWriter } from "ai"
import type { FormAssistantToolContext } from "@/lib/agents/form-assistant/tools"
import type { PolicyChunk } from "@/lib/rag/types"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CTX: FormAssistantToolContext = {
  messages: [{ role: "user" as const, content: "My name is Maria, I live at 100 Main St" }],
  language: "en" as const,
  collectedSummary: "firstName: Maria",
  currentSection: "personal" as const,
  existingMembers: [],
  existingSources: [],
}

const POLICY_CHUNK: PolicyChunk = {
  id: "chunk-1",
  documentId: "doc-1",
  chunkIndex: 0,
  content: "Applicants may need proof of citizenship.",
  score: 0.79,
  documentTitle: "Acceptable Verifications List",
  sourceUrl: "https://www.mass.gov/doc/acceptable-verifications/download",
  docType: "verifications",
}

function makeMockWriter() {
  return { write: vi.fn(), merge: vi.fn() } as unknown as UIMessageStreamWriter
}

async function exec<T>(
  tools: ReturnType<typeof buildFormAssistantTools>,
  name: keyof ReturnType<typeof buildFormAssistantTools>,
  args: T,
) {
  const t = tools[name] as { execute?: (args: T) => Promise<unknown> }
  return t.execute!(args)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(extractFormFields).mockResolvedValue({
    fields: { firstName: "Maria", lastName: "Rossi" },
    noHouseholdMembers: false,
    noIncome: false,
    extractionFailed: false,
  })
  vi.mocked(retrieveRelevantChunks).mockResolvedValue([])
  vi.mocked(formatChunksForPrompt).mockReturnValue("Policy context: personal section requires legal name...")
})

// ── extract_form_fields ───────────────────────────────────────────────────────

describe("extract_form_fields tool", () => {
  it("calls extractFormFields with the full context from closure", async () => {
    const writer = makeMockWriter()
    const tools = buildFormAssistantTools(CTX, writer)
    await exec(tools, "extract_form_fields", {})

    expect(extractFormFields).toHaveBeenCalledWith(
      CTX.messages,
      CTX.collectedSummary,
      CTX.currentSection,
      CTX.existingMembers,
      CTX.existingSources,
      CTX.language,
    )
  })

  it("writes a data-masshealth annotation with extracted fields", async () => {
    const writer = makeMockWriter()
    const tools = buildFormAssistantTools(CTX, writer)
    await exec(tools, "extract_form_fields", {})

    expect(writer.write).toHaveBeenCalledOnce()
    const [written] = vi.mocked(writer.write).mock.calls[0]
    expect((written as { type: string }).type).toBe("data-masshealth")
  })

  it("annotation contains ok:true and extractedFields", async () => {
    const writer = makeMockWriter()
    const tools = buildFormAssistantTools(CTX, writer)
    await exec(tools, "extract_form_fields", {})

    const [written] = vi.mocked(writer.write).mock.calls[0]
    const data = (written as { data: Record<string, unknown> }).data
    expect(data.ok).toBe(true)
    expect(data.extractedFields).toMatchObject({ firstName: "Maria", lastName: "Rossi" })
    expect(data.extractionFailed).toBe(false)
  })

  it("returns extractedFields, currentSection, and a nextStep string", async () => {
    const tools = buildFormAssistantTools(CTX, makeMockWriter())
    const result = await exec(tools, "extract_form_fields", {}) as {
      extractedFields: Record<string, unknown>
      currentSection: string
      nextStep: string
    }
    expect(result.extractedFields).toMatchObject({ firstName: "Maria" })
    expect(result.currentSection).toBe("personal")
    expect(result.nextStep).toMatch(/extraction succeeded/i)
  })

  it("returns a failure nextStep when extractionFailed is true", async () => {
    vi.mocked(extractFormFields).mockResolvedValue({
      fields: {},
      noHouseholdMembers: false,
      noIncome: false,
      extractionFailed: true,
    })

    const tools = buildFormAssistantTools(CTX, makeMockWriter())
    const result = await exec(tools, "extract_form_fields", {}) as { nextStep: string }
    expect(result.nextStep).toMatch(/extraction failed/i)
  })

  it("uses 'Nothing collected yet.' as collectedSummary when ctx summary is empty", async () => {
    const emptyCtx = { ...CTX, collectedSummary: "" }
    const tools = buildFormAssistantTools(emptyCtx, makeMockWriter())
    const result = await exec(tools, "extract_form_fields", {}) as { collectedSummary: string }
    expect(result.collectedSummary).toBe("Nothing collected yet.")
  })
})

// ── retrieve_policy ───────────────────────────────────────────────────────────

describe("retrieve_policy tool", () => {
  it("calls retrieveRelevantChunks with the provided query", async () => {
    const tools = buildFormAssistantTools(CTX, makeMockWriter())
    await exec(tools, "retrieve_policy", { query: "citizenship documentation requirements" })
    expect(retrieveRelevantChunks).toHaveBeenCalledWith("citizenship documentation requirements", expect.any(Number))
  })

  it("returns the formatted context string", async () => {
    const tools = buildFormAssistantTools(CTX, makeMockWriter())
    const result = await exec(tools, "retrieve_policy", { query: "personal section" }) as { context: string }
    expect(result.context).toBe("Policy context: personal section requires legal name...")
  })

  it("returns and emits RAG quality metadata", async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue([POLICY_CHUNK])
    const writer = makeMockWriter()
    const tools = buildFormAssistantTools(CTX, writer)

    const result = await exec(tools, "retrieve_policy", { query: "citizenship documentation requirements" }) as {
      rag: { returnedChunkCount: number; sources: Array<{ sourceType?: string }> }
    }

    expect(result.rag.returnedChunkCount).toBe(1)
    expect(result.rag.sources[0]).toMatchObject({ sourceType: "verifications" })
    expect(writer.write).toHaveBeenCalledWith({
      type: "data-masshealth",
      data: expect.objectContaining({
        ok: true,
        rag: expect.objectContaining({ returnedChunkCount: 1 }),
      }),
    })
  })

  it("returns a fallback message when no chunks are found", async () => {
    vi.mocked(formatChunksForPrompt).mockReturnValue("")
    const tools = buildFormAssistantTools(CTX, makeMockWriter())
    const result = await exec(tools, "retrieve_policy", { query: "anything" }) as { context: string }
    expect(result.context).toMatch(/no policy documents found/i)
  })

  it("gracefully handles retrieveRelevantChunks failures", async () => {
    vi.mocked(retrieveRelevantChunks).mockRejectedValue(new Error("DB unavailable"))
    const tools = buildFormAssistantTools(CTX, makeMockWriter())
    await expect(exec(tools, "retrieve_policy", { query: "residency" })).resolves.toBeDefined()
  })
})
