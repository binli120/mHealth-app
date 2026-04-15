/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"
import { buildIntakeAgentSystemPrompt } from "@/lib/agents/intake/prompts"

describe("buildIntakeAgentSystemPrompt", () => {
  it("references the extract_household_hints tool", () => {
    const prompt = buildIntakeAgentSystemPrompt("en")
    expect(prompt).toContain("extract_household_hints")
  })

  it("includes the application type when provided", () => {
    const prompt = buildIntakeAgentSystemPrompt("en", "ACA-3")
    expect(prompt).toContain("ACA-3")
  })

  it("does not include application type when omitted", () => {
    const prompt = buildIntakeAgentSystemPrompt("en")
    expect(prompt).not.toContain("application type:")
  })

  it("instructs one question per message", () => {
    const prompt = buildIntakeAgentSystemPrompt("en")
    expect(prompt).toMatch(/ONE question|one question/i)
  })

  it("includes the interview field order", () => {
    const prompt = buildIntakeAgentSystemPrompt("en")
    expect(prompt).toContain("first name")
    expect(prompt).toContain("household")
    expect(prompt).toContain("income")
  })

  it("mentions never asking for SSN", () => {
    const prompt = buildIntakeAgentSystemPrompt("en")
    expect(prompt.toLowerCase()).toContain("ssn")
    expect(prompt.toLowerCase()).toContain("never ask for ssn")
  })

  it("uses the correct language label for Vietnamese", () => {
    const prompt = buildIntakeAgentSystemPrompt("vi")
    expect(prompt).toContain("Vietnamese")
  })

  it("returns a non-empty string for every supported language", () => {
    const languages = ["en", "es", "zh-CN", "ht", "pt-BR", "vi"] as const
    for (const lang of languages) {
      expect(buildIntakeAgentSystemPrompt(lang).length).toBeGreaterThan(100)
    }
  })
})
