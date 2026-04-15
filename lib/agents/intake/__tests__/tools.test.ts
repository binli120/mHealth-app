/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tests for buildIntakeTools().
 *
 * Strategy: mock the household-relationships module so no real regex processing
 * is required. Each test calls the tool's execute() function directly.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/masshealth/household-relationships", () => ({
  extractHouseholdRelationshipHints: vi.fn(),
}))

import { buildIntakeTools } from "@/lib/agents/intake/tools"
import { extractHouseholdRelationshipHints } from "@/lib/masshealth/household-relationships"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LAST_MSG_WITH_HINTS = "My wife Sarah and son Tommy live with me"
const LAST_MSG_NO_HINTS = "I am not sure about the address"

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
    const tools = buildIntakeTools(LAST_MSG_WITH_HINTS)
    await exec(tools, "extract_household_hints")
    expect(extractHouseholdRelationshipHints).toHaveBeenCalledWith(LAST_MSG_WITH_HINTS)
  })

  it("returns empty hints array and a 'no hints' summary when nothing is found", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([])
    const tools = buildIntakeTools(LAST_MSG_NO_HINTS)
    const result = await exec(tools, "extract_household_hints") as { hints: unknown[]; summary: string }
    expect(result.hints).toHaveLength(0)
    expect(result.summary).toMatch(/no household relationship/i)
  })

  it("returns populated hints and a descriptive summary when relationships are found", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([
      { relationship: "spouse", memberName: "Sarah" },
      { relationship: "child", memberName: "Tommy" },
    ] as never)
    const tools = buildIntakeTools(LAST_MSG_WITH_HINTS)
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
    const tools = buildIntakeTools(LAST_MSG_WITH_HINTS)
    const result = await exec(tools, "extract_household_hints") as { instruction?: string }
    expect(result.instruction).toMatch(/do not ask/i)
  })

  it("does not include an instruction field when no hints are found", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([])
    const tools = buildIntakeTools(LAST_MSG_NO_HINTS)
    const result = await exec(tools, "extract_household_hints") as { instruction?: string }
    expect(result.instruction).toBeUndefined()
  })

  it("formats hint summary lines with member name when available", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([
      { relationship: "parent", memberName: "Rosa" },
    ] as never)
    const tools = buildIntakeTools("My mother Rosa lives with me")
    const result = await exec(tools, "extract_household_hints") as { summary: string }
    expect(result.summary).toContain("Rosa")
    expect(result.summary).toContain("parent")
  })

  it("formats hint summary lines without member name when none provided", async () => {
    vi.mocked(extractHouseholdRelationshipHints).mockReturnValue([
      { relationship: "sibling", memberName: undefined },
    ] as never)
    const tools = buildIntakeTools("I have a sibling living with me")
    const result = await exec(tools, "extract_household_hints") as { summary: string }
    expect(result.summary).toContain("sibling")
  })
})
