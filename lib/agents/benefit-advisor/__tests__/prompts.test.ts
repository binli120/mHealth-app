/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"
import { buildBenefitAdvisorAgentSystemPrompt } from "@/lib/agents/benefit-advisor/prompts"

describe("buildBenefitAdvisorAgentSystemPrompt", () => {
  it("includes 'English' for the default language", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en")
    expect(prompt).toContain("English")
  })

  it("includes the correct language label for Spanish", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("es")
    expect(prompt).toContain("Spanish")
  })

  it("includes the correct language label for Simplified Chinese", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("zh-CN")
    expect(prompt).toContain("Simplified Chinese")
  })

  it("references all three tool names", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en")
    expect(prompt).toContain("extract_eligibility_facts")
    expect(prompt).toContain("check_eligibility")
    expect(prompt).toContain("retrieve_policy")
  })

  it("instructs the agent to ask ONE question when facts are missing", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en")
    expect(prompt.toLowerCase()).toMatch(/one.*question|ask.*one/i)
  })

  it("instructs the agent to never invent eligibility rules", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en")
    expect(prompt.toLowerCase()).toContain("never invent")
  })

  it("returns a non-empty string for every supported language", () => {
    const languages = ["en", "es", "zh-CN", "ht", "pt-BR", "vi"] as const
    for (const lang of languages) {
      const prompt = buildBenefitAdvisorAgentSystemPrompt(lang)
      expect(prompt.length).toBeGreaterThan(100)
    }
  })
})
