/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Tests for buildIntakeTools().
 *
 * Strategy: mock household-relationships, fact-extraction, and the memory
 * layer so no real regex/LLM/DB work is required. Each test calls the tool's
 * execute() function directly.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/masshealth/household-relationships", () => ({
  extractHouseholdRelationshipHints: vi.fn(),
}))

vi.mock("@/lib/masshealth/fact-extraction", () => ({
  extractEligibilityFacts: vi.fn(),
  summarizeExtractedFacts: vi.fn(() => "summary"),
}))

vi.mock("@/lib/agents/memory", () => ({
  mergeAndSaveAgentMemory: vi.fn(() => Promise.resolve()),
}))

import { buildIntakeTools, type IntakeToolContext } from "@/lib/agents/intake/tools"
import { extractHouseholdRelationshipHints } from "@/lib/masshealth/household-relationships"
import { extractEligibilityFacts } from "@/lib/masshealth/fact-extraction"
import { mergeAndSaveAgentMemory } from "@/lib/agents/memory"
import type { ChatMessage } from "@/lib/masshealth/types"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LAST_MSG_WITH_HINTS = "My wife Sarah and son Tommy live with me"
const LAST_MSG_NO_HINTS = "I am not sure about the address"
const USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const MESSAGES: ChatMessage[] = [{ role: "user", content: LAST_MSG_NO_HINTS }]

function makeContext(overrides: Partial<IntakeToolContext> = {}): IntakeToolContext {
  return {
    lastUserMessage: LAST_MSG_NO_HINTS,
    messages: MESSAGES,
    language: "en",
    userId: USER_ID,
    ...overrides,
  }
}

async function exec(
  tools: ReturnType<typeof buildIntakeTools>,
  name: keyof ReturnType<typeof buildIntakeTools>,
  args: Record<string, unknown> = {},
) {
  const t = tools[name] as { execute?: (args: typeof args) => Promise<unknown> }
  return t.execute!(args)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── extract_household_hints ───────────────────────────────────────────────────

describe("extract_household_hints tool", () => {
  it("calls extractHouseholdRelationshipHints with the message captured in closure", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([])
    const tools = buildIntakeTools(makeContext({ lastUserMessage: LAST_MSG_WITH_HINTS }))
    await exec(tools, "extract_household_hints")
    expect(extractHouseholdRelationshipHints).toHaveBeenCalledWith(LAST_MSG_WITH_HINTS)
  })

  it("returns empty hints array and a 'no hints' summary when nothing is found", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([])
    const tools = buildIntakeTools(makeContext({ lastUserMessage: LAST_MSG_NO_HINTS }))
    const result = await exec(tools, "extract_household_hints") as { hints: unknown[]; summary: string }
    expect(result.hints).toHaveLength(0)
    expect(result.summary).toMatch(/no household relationship/i)
  })

  it("returns populated hints and a descriptive summary when relationships are found", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([
      { relationship: "spouse", memberName: "Sarah" },
      { relationship: "child", memberName: "Tommy" },
    ] as never)
    const tools = buildIntakeTools(makeContext({ lastUserMessage: LAST_MSG_WITH_HINTS }))
    const result = await exec(tools, "extract_household_hints") as {
      hints: unknown[]
      summary: string
      instruction?: string
    }
    expect(result.hints).toHaveLength(2)
    expect(result.summary).toContain("Sarah")
    expect(result.summary).toContain("Tommy")
  })

  it("includes an instruction not to re-ask when hints are found", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([
      { relationship: "spouse", memberName: "Sarah" },
    ] as never)
    const tools = buildIntakeTools(makeContext({ lastUserMessage: LAST_MSG_WITH_HINTS }))
    const result = await exec(tools, "extract_household_hints") as { instruction?: string }
    expect(result.instruction).toMatch(/do not ask/i)
  })

  it("does not include an instruction field when no hints are found", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([])
    const tools = buildIntakeTools(makeContext({ lastUserMessage: LAST_MSG_NO_HINTS }))
    const result = await exec(tools, "extract_household_hints") as { instruction?: string }
    expect(result.instruction).toBeUndefined()
  })

  it("formats hint summary lines with member name when available", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([
      { relationship: "parent", memberName: "Rosa" },
    ] as never)
    const tools = buildIntakeTools(makeContext({ lastUserMessage: "My mother Rosa lives with me" }))
    const result = await exec(tools, "extract_household_hints") as { summary: string }
    expect(result.summary).toContain("Rosa")
    expect(result.summary).toContain("parent")
  })

  it("formats hint summary lines without member name when none provided", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([
      { relationship: "sibling", memberName: undefined },
    ] as never)
    const tools = buildIntakeTools(makeContext({ lastUserMessage: "I have a sibling living with me" }))
    const result = await exec(tools, "extract_household_hints") as { summary: string }
    expect(result.summary).toContain("sibling")
  })
})

// ── extract_eligibility_facts ─────────────────────────────────────────────────

describe("extract_eligibility_facts tool", () => {
  it("calls extractEligibilityFacts with the conversation and language captured in closure", async () => {
    vi.mocked(extractEligibilityFacts).mockResolvedValue({ age: 34 })
    const tools = buildIntakeTools(makeContext({ messages: MESSAGES, language: "es" }))
    await exec(tools, "extract_eligibility_facts")
    expect(extractEligibilityFacts).toHaveBeenCalledWith(MESSAGES, "es")
  })

  it("persists non-empty extracted facts to agent memory", async () => {
    vi.mocked(extractEligibilityFacts).mockResolvedValue({ annualIncome: 36000 })
    const tools = buildIntakeTools(makeContext({ userId: USER_ID }))
    await exec(tools, "extract_eligibility_facts")
    expect(mergeAndSaveAgentMemory).toHaveBeenCalledWith(USER_ID, {
      extractedFacts: { annualIncome: 36000 },
    })
  })

  it("does not call mergeAndSaveAgentMemory when no facts were extracted", async () => {
    vi.mocked(extractEligibilityFacts).mockResolvedValue({})
    const tools = buildIntakeTools(makeContext())
    await exec(tools, "extract_eligibility_facts")
    expect(mergeAndSaveAgentMemory).not.toHaveBeenCalled()
  })

  it("returns the extracted facts and a summary", async () => {
    vi.mocked(extractEligibilityFacts).mockResolvedValue({ hasMedicare: true })
    const tools = buildIntakeTools(makeContext())
    const result = await exec(tools, "extract_eligibility_facts") as {
      facts: unknown
      summary: string
    }
    expect(result.facts).toEqual({ hasMedicare: true })
    expect(result.summary).toBe("summary")
  })

  it("does not block on a memory save rejection", async () => {
    vi.mocked(extractEligibilityFacts).mockResolvedValue({ age: 40 })
    vi.mocked(mergeAndSaveAgentMemory).mockRejectedValue(new Error("DB down"))
    const tools = buildIntakeTools(makeContext())
    await expect(exec(tools, "extract_eligibility_facts")).resolves.toBeDefined()
  })
})
