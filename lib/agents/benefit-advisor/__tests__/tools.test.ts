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

import { buildBenefitAdvisorTools } from "@/lib/agents/benefit-advisor/tools"
import { extractEligibilityFacts, applyFactDefaults, isSufficientForEvaluation, summarizeExtractedFacts } from "@/lib/masshealth/fact-extraction"
import { runEligibilityCheck } from "@/lib/eligibility-engine"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import type { UIMessageStreamWriter } from "ai"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MESSAGES = [{ role: "user" as const, content: "I am 34, household of 4, earning $3k/month" }]
const LANGUAGE = "en" as const

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
})

// ── extract_eligibility_facts ─────────────────────────────────────────────────

describe("extract_eligibility_facts tool", () => {
  it("calls extractEligibilityFacts with the messages and language from closure", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter())
    await exec(tools, "extract_eligibility_facts", {})
    expect(extractEligibilityFacts).toHaveBeenCalledWith(MESSAGES, LANGUAGE)
  })

  it("returns sufficient=true when isSufficientForEvaluation returns true", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter())
    const result = await exec(tools, "extract_eligibility_facts", {}) as { sufficient: boolean }
    expect(result.sufficient).toBe(true)
  })

  it("returns sufficient=false and a prompt to ask when facts are missing", async () => {
    vi.mocked(extractEligibilityFacts).mockResolvedValue({})
    vi.mocked(isSufficientForEvaluation).mockReturnValue(false)
    vi.mocked(summarizeExtractedFacts).mockReturnValue("No eligibility facts extracted yet.")

    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter())
    const result = await exec(tools, "extract_eligibility_facts", {}) as { sufficient: boolean; nextStep: string }
    expect(result.sufficient).toBe(false)
    expect(result.nextStep).toMatch(/ask/i)
  })

  it("includes the extracted facts in the returned object", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter())
    const result = await exec(tools, "extract_eligibility_facts", {}) as { facts: Record<string, unknown> }
    expect(result.facts).toMatchObject({ age: 34, householdSize: 4, annualIncome: 36000 })
  })
})

// ── check_eligibility ─────────────────────────────────────────────────────────

describe("check_eligibility tool", () => {
  it("calls applyFactDefaults then runEligibilityCheck with the defaults", async () => {
    const writer = makeMockWriter()
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, writer)
    await exec(tools, "check_eligibility", { age: 34, householdSize: 4, annualIncome: 36000 })

    expect(applyFactDefaults).toHaveBeenCalledWith({ age: 34, householdSize: 4, annualIncome: 36000 })
    expect(runEligibilityCheck).toHaveBeenCalled()
  })

  it("writes a data-masshealth annotation to the stream writer", async () => {
    const writer = makeMockWriter()
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, writer)
    await exec(tools, "check_eligibility", { age: 34, householdSize: 4, annualIncome: 36000 })

    expect(writer.write).toHaveBeenCalledOnce()
    const [written] = vi.mocked(writer.write).mock.calls[0]
    expect((written as { type: string }).type).toBe("data-masshealth")
  })

  it("annotation contains ok:true and eligibilityResults", async () => {
    const writer = makeMockWriter()
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, writer)
    await exec(tools, "check_eligibility", { age: 34, householdSize: 4, annualIncome: 36000 })

    const [written] = vi.mocked(writer.write).mock.calls[0]
    const data = (written as { data: Record<string, unknown> }).data
    expect(data.ok).toBe(true)
    expect(data.outOfScope).toBe(false)
    expect(data.eligibilityResults).toBeDefined()
  })

  it("returns fplPercent, summary, and topPrograms from the eligibility report", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter())
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
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter())
    await exec(tools, "retrieve_policy", { query: "MassHealth CarePlus income limits" })
    expect(retrieveRelevantChunks).toHaveBeenCalledWith("MassHealth CarePlus income limits", expect.any(Number))
  })

  it("returns the formatted context string", async () => {
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter())
    const result = await exec(tools, "retrieve_policy", { query: "CarePlus" }) as { context: string }
    expect(result.context).toBe("Policy context: CarePlus covers adults...")
  })

  it("returns a fallback message when no chunks are found", async () => {
    vi.mocked(formatChunksForPrompt).mockReturnValue("")
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter())
    const result = await exec(tools, "retrieve_policy", { query: "CarePlus" }) as { context: string }
    expect(result.context).toMatch(/no policy documents found/i)
  })

  it("gracefully handles retrieveRelevantChunks failures", async () => {
    vi.mocked(retrieveRelevantChunks).mockRejectedValue(new Error("DB unavailable"))
    const tools = buildBenefitAdvisorTools(MESSAGES, LANGUAGE, makeMockWriter())
    await expect(exec(tools, "retrieve_policy", { query: "CarePlus" })).resolves.toBeDefined()
  })
})
