/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"
import { buildChatAgentSystemPrompt } from "@/lib/agents/chat/prompts"

describe("buildChatAgentSystemPrompt", () => {
  it("includes 'English' for the default language", () => {
    const prompt = buildChatAgentSystemPrompt("en")
    expect(prompt).toContain("English")
  })

  it("includes the correct language label for Spanish", () => {
    const prompt = buildChatAgentSystemPrompt("es")
    expect(prompt).toContain("Spanish")
  })

  it("includes the correct language label for Simplified Chinese", () => {
    const prompt = buildChatAgentSystemPrompt("zh-CN")
    expect(prompt).toContain("Simplified Chinese")
  })

  it("includes the correct language label for Haitian Creole", () => {
    const prompt = buildChatAgentSystemPrompt("ht")
    expect(prompt).toContain("Haitian Creole")
  })

  it("references the retrieve_policy tool", () => {
    const prompt = buildChatAgentSystemPrompt("en")
    expect(prompt).toContain("retrieve_policy")
  })

  it("instructs the agent never to invent policy details", () => {
    const prompt = buildChatAgentSystemPrompt("en")
    expect(prompt.toLowerCase()).toContain("never invent")
  })

  it("includes the MassHealth phone number as a fallback reference", () => {
    const prompt = buildChatAgentSystemPrompt("en")
    expect(prompt).toContain("1-800-841-2900")
  })

  it("mentions the Benefit Advisor and Form Assistant for upsell routing", () => {
    const prompt = buildChatAgentSystemPrompt("en")
    expect(prompt).toContain("Benefit Advisor")
    expect(prompt).toContain("Form Assistant")
  })

  it("returns a non-empty string for every supported language", () => {
    const languages = ["en", "es", "zh-CN", "ht", "pt-BR", "vi"] as const
    for (const lang of languages) {
      expect(buildChatAgentSystemPrompt(lang).length).toBeGreaterThan(100)
    }
  })

  // ── Known-facts injection (read-only memory) ─────────────────────────────────

  it("does NOT include a known-facts section when knownFacts is empty or omitted", () => {
    expect(buildChatAgentSystemPrompt("en")).not.toMatch(/already known about this user/i)
    expect(buildChatAgentSystemPrompt("en", {})).not.toMatch(/already known about this user/i)
  })

  it("injects known facts already persisted from prior sessions", () => {
    const prompt = buildChatAgentSystemPrompt("en", { age: 42, citizenshipStatus: "citizen" })
    expect(prompt).toContain("Age: 42")
    expect(prompt).toContain("citizen")
    expect(prompt).toMatch(/already known about this user/i)
  })

  it("instructs the agent not to treat known facts as an eligibility determination", () => {
    const prompt = buildChatAgentSystemPrompt("en", { age: 42 })
    expect(prompt.toLowerCase()).toMatch(/redirect to the benefit advisor/i)
  })
})
