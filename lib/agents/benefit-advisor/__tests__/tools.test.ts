/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tests for buildBenefitAdvisorTools().
 *
 * Strategy: mock every external dependency so no Ollama, DB, or network calls
 * are made. Each test calls the tool's execute() function directly and asserts
 * on mock invocations and return values.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/masshealth/fact-extraction", () => ({
  extractEligibilityFacts: vi.fn(),
  applyFactDefaults: vi.fn(),
  isSufficientForEvaluation: vi.fn(),
  summarizeExtractedFacts: vi.fn(),
}))

vi.mock("@/lib/eligibility-engine", () => ({
  runEligibilityCheck: vi.fn(),
}))

vi.mock("@/lib/rag/retrieve", () => ({
  retrieveRelevantChunks: vi.fn(),
  formatChunksForPrompt: vi.fn(),
}))

vi.mock("@/lib/agents/memory", () => ({
  mergeAndSaveAgentMemory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/agents/reflection/quality-gate", () => ({
  reviewEligibilityExplanationQuality: vi.fn(),
}))

import { buildBenefitAdvisorTools } from "@/lib/agents/benefit-advisor/tools"
import { extractEligibilityFacts, applyFactDefaults, isSufficientForEvaluation, summarizeExtractedFacts } from "@/lib/masshealth/fact-extraction"
import { runEligibilityCheck } from "@/lib/eligibility-engine"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import { mergeAndSaveAgentMemory } from "@/lib/agents/memory"
import { reviewEligibilityExplanationQuality } from "@/lib/agents/reflection/quality-gate"
import type { UIMessageStreamWriter } from "ai"
import type { PolicyChunk } from "@/lib/rag/types"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MESSAGES = [{ role: "user" as const, content: "I am 34, household of 4, earning $3k/month" }]
const LANGUAGE = "en" as const
const USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const POLICY_CHUNK: PolicyChunk = {
  id: "chunk-1",
  documentId: "doc-1",
  chunkIndex: 0,
  content: "CarePlus covers adults with income up to 138% FPL.",
  score: 0.88,
  documentTitle: "MassHealth Eligibility Guide",
  sourceUrl: "https://www.mass.gov/info-details/masshealth-careplus",
  docType: "eligibility_guide",
}

function makeMockWriter() {
  return { write: vi.fn(), merge: vi.fn() } as unknown as UIMessageStreamWriter
}

// Helper: call a tool's execute function via type assertion
async function exec<T>(tools: ReturnType<typeof buildBenefitAdvisorTools>, name: keyof typeof tools, args: T) {
  const t = tools[name] as { execute?: (args: T) => Promise<unknown> }
  return t.execute!(args)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(extractEligibilityFacts).mockResolvedValue({ age: 34, householdSize: 4, annualIncome: 36000 })
  vi.mocked(isSufficientForEvaluation).mockReturnValue(true)
  vi.mocked(summarizeExtractedFacts).mockReturnValue("Facts gathered so far: age=34")
  vi.mocked(applyFactDefaults).mockReturnValue({
    livesInMA: true, age: 34, householdSize: 4, annualIncome: 36000,
    isPregnant: false, hasDisability: false, hasMedicare: false,
    hasEmployerInsurance: false, citizenshipStatus: "citizen",
  })
  vi.mocked(runEligibilityCheck).mockReturnValue({
    fplPercent: 143, annualFPL: 31200, summary: "Likely eligible for CarePlus",
    results: [{ program: "MassHealth CarePlus", status: "likely", tagline: "Free health insurance", actionLabel: "Apply", actionHref: "/apply", color: "green" }],
  } as never)
  vi.mocked(retrieveRelevantChunks).mockResolvedValue([])
  vi.mocked(formatChunksForPrompt).mockReturnValue("Policy context: CarePlus covers adults...")
  vi.mocked(reviewEligibilityExplanationQuality).mockResolvedValue({
    finalText: "Reviewed eligibility explanation",
    review: {
      reviewed: true,
      factuallyAccurate: true,
      clearToLayperson: true,
      hasSpecificEvidence: true,
      issues: [],
    },
  })
})

// ── extract_eligibility_facts ─────────────────────────────────────────────────

describe("extract_eligibility_facts tool", () => {
  it("calls extractEligibilityFacts with the messages and language from closure", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    await exec(tools, "extract_eligibility_facts", {})
    expect(extractEligibilityFacts).toHaveBeenCalledWith(MESSAGES, LANGUAGE)
  })

  it("returns sufficient=true when isSufficientForEvaluation returns true", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    const result = await exec(tools, "extract_eligibility_facts", {}) as { sufficient: boolean }
    expect(result.sufficient).toBe(true)
  })

  it("returns sufficient=false and a prompt to ask when facts are missing", async () => {
    vi.mocked(extractEligibilityFacts).mockResolvedValue({})
    vi.mocked(isSufficientForEvaluation).mockReturnValue(false)
    vi.mocked(summarizeExtractedFacts).mockReturnValue("No eligibility facts extracted yet.")

    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    const result = await exec(tools, "extract_eligibility_facts", {}) as { sufficient: boolean; nextStep: string }
    expect(result.sufficient).toBe(false)
    expect(result.nextStep).toMatch(/ask/i)
  })

  it("includes the extracted facts in the returned object", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    const result = await exec(tools, "extract_eligibility_facts", {}) as { facts: Record<string, unknown> }
    expect(result.facts).toMatchObject({ age: 34, householdSize: 4, annualIncome: 36000 })
  })
})

// ── Phase 4: memory persistence ───────────────────────────────────────────────

describe("extract_eligibility_facts — Phase 4 memory persistence", () => {
  it("merges persisted known facts with newly extracted facts before checking sufficiency", async () => {
    vi.mocked(extractEligibilityFacts).mockResolvedValue({ householdSize: 4, annualIncome: 36000 })
    const tools = buildBenefitAdvisorTools(
      MESSAGES,
      LANGUAGE,
      makeMockWriter(),
      USER_ID,
      { age: 34 },
    )

    const result = await exec(tools, "extract_eligibility_facts", {}) as { facts: Record<string, unknown> }

    expect(result.facts).toEqual({ age: 34, householdSize: 4, annualIncome: 36000 })
    expect(isSufficientForEvaluation).toHaveBeenCalledWith({ age: 34, householdSize: 4, annualIncome: 36000 })
    expect(summarizeExtractedFacts).toHaveBeenCalledWith({ age: 34, householdSize: 4, annualIncome: 36000 })
  })

  it("lets newly extracted facts override stale persisted facts", async () => {
    vi.mocked(extractEligibilityFacts).mockResolvedValue({ age: 35, householdSize: 4, annualIncome: 36000 })
    const tools = buildBenefitAdvisorTools(
      MESSAGES,
      LANGUAGE,
      makeMockWriter(),
      USER_ID,
      { age: 34 },
    )

    const result = await exec(tools, "extract_eligibility_facts", {}) as { facts: Record<string, unknown> }

    expect(result.facts.age).toBe(35)
    expect(isSufficientForEvaluation).toHaveBeenCalledWith({ age: 35, householdSize: 4, annualIncome: 36000 })
  })

  it("calls mergeAndSaveAgentMemory with the extracted facts and userId", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    await exec(tools, "extract_eligibility_facts", {})

    // Allow the fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 0))

    expect(mergeAndSaveAgentMemory).toHaveBeenCalledWith(
      USER_ID,
      { extractedFacts: { age: 34, householdSize: 4, annualIncome: 36000 } },
    )
  })

  it("does NOT block the tool return even when mergeAndSaveAgentMemory rejects", async () => {
    vi.mocked(mergeAndSaveAgentMemory).mockRejectedValue(new Error("DB down"))
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)

    // The tool should still resolve successfully despite the DB failure
    await expect(exec(tools, "extract_eligibility_facts", {})).resolves.toBeDefined()
  })
})

// ── check_eligibility ─────────────────────────────────────────────────────────

describe("check_eligibility tool", () => {
  it("calls applyFactDefaults then runEligibilityCheck with the defaults", async () => {
    const writer = makeMockWriter()
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, writer, USER_ID)
    await exec(tools, "check_eligibility", { age: 34, householdSize: 4, annualIncome: 36000 })

    expect(applyFactDefaults).toHaveBeenCalledWith({ age: 34, householdSize: 4, annualIncome: 36000 })
    expect(runEligibilityCheck).toHaveBeenCalled()
  })

  it("writes a data-masshealth annotation to the stream writer", async () => {
    const writer = makeMockWriter()
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, writer, USER_ID)
    await exec(tools, "check_eligibility", { age: 34, householdSize: 4, annualIncome: 36000 })

    expect(writer.write).toHaveBeenCalledOnce()
    const [written] = vi.mocked(writer.write).mock.calls[0]
    expect((written as { type: string }).type).toBe("data-masshealth")
  })

  it("annotation contains ok:true and eligibilityResults", async () => {
    const writer = makeMockWriter()
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, writer, USER_ID)
    await exec(tools, "check_eligibility", { age: 34, householdSize: 4, annualIncome: 36000 })

    const [written] = vi.mocked(writer.write).mock.calls[0]
    const data = (written as { data: Record<string, unknown> }).data
    expect(data.ok).toBe(true)
    expect(data.outOfScope).toBe(false)
    expect(data.eligibilityResults).toBeDefined()
  })

  it("returns fplPercent, summary, and topPrograms from the eligibility report", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    const result = await exec(tools, "check_eligibility", { age: 34, householdSize: 4, annualIncome: 36000 }) as {
      fplPercent: number; summary: string; topPrograms: string[]
    }
    expect(result.fplPercent).toBe(143)
    expect(result.summary).toBe("Likely eligible for CarePlus")
    expect(result.topPrograms).toContain("MassHealth CarePlus")
  })
})

// ── retrieve_policy ───────────────────────────────────────────────────────────

describe("retrieve_policy tool", () => {
  it("calls retrieveRelevantChunks with the provided query", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    await exec(tools, "retrieve_policy", { query: "MassHealth CarePlus income limits" })
    expect(retrieveRelevantChunks).toHaveBeenCalledWith("MassHealth CarePlus income limits", expect.any(Number))
  })

  it("returns the formatted context string", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    const result = await exec(tools, "retrieve_policy", { query: "CarePlus" }) as { context: string }
    expect(result.context).toBe("Policy context: CarePlus covers adults...")
  })

  it("returns and emits RAG quality metadata", async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue([POLICY_CHUNK])
    const writer = makeMockWriter()
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, writer, USER_ID)

    const result = await exec(tools, "retrieve_policy", { query: "CarePlus" }) as {
      rag: { confidence: string; sources: Array<{ sourceTier: string; score: number }> }
    }

    expect(result.rag.confidence).toBe("high")
    expect(result.rag.sources[0]).toMatchObject({ sourceTier: "official", score: 0.88 })
    expect(writer.write).toHaveBeenCalledWith({
      type: "data-masshealth",
      data: expect.objectContaining({
        ok: true,
        outOfScope: false,
        rag: expect.objectContaining({ confidence: "high" }),
      }),
    })
  })

  it("returns a fallback message when no chunks are found", async () => {
    vi.mocked(formatChunksForPrompt).mockReturnValue("")
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    const result = await exec(tools, "retrieve_policy", { query: "CarePlus" }) as { context: string }
    expect(result.context).toMatch(/no policy documents found/i)
  })

  it("gracefully handles retrieveRelevantChunks failures", async () => {
    vi.mocked(retrieveRelevantChunks).mockRejectedValue(new Error("DB unavailable"))
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)
    await expect(exec(tools, "retrieve_policy", { query: "CarePlus" })).resolves.toBeDefined()
  })
})

// ── finish_eligibility_explanation ───────────────────────────────────────────

describe("finish_eligibility_explanation tool", () => {
  it("reviews the drafted explanation before writing it to the client", async () => {
    const writer = makeMockWriter()
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, writer, USER_ID)
    await exec(tools, "check_eligibility", { age: 34, householdSize: 4, annualIncome: 36000 })
    await exec(tools, "retrieve_policy", { query: "CarePlus" })

    await exec(tools, "finish_eligibility_explanation", { explanation: "Draft explanation" })

    expect(reviewEligibilityExplanationQuality).toHaveBeenCalledWith({
      explanation: "Draft explanation",
      eligibilityContext: expect.stringContaining("MassHealth CarePlus"),
      policyContext: "Policy context: CarePlus covers adults...",
      language: LANGUAGE,
    })
  })

  it("writes the reviewed explanation and reflection annotation", async () => {
    const writer = makeMockWriter()
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, writer, USER_ID)

    await exec(tools, "finish_eligibility_explanation", { explanation: "Draft explanation" })

    expect(writer.write).toHaveBeenCalledOnce()
    const [written] = vi.mocked(writer.write).mock.calls[0]
    const data = (written as { data: Record<string, unknown> }).data
    expect(data.eligibilityExplanation).toBe("Reviewed eligibility explanation")
    expect(data.reflection).toMatchObject({ reviewed: true, factuallyAccurate: true })
  })

  it("returns finalExplanation from the quality gate", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter(), USER_ID)

    const result = await exec(tools, "finish_eligibility_explanation", { explanation: "Draft explanation" }) as {
      finalExplanation: string
      nextStep: string
    }

    expect(result.finalExplanation).toBe("Reviewed eligibility explanation")
    expect(result.nextStep).toMatch(/finalExplanation exactly/i)
  })
})
