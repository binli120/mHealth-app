/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
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

  it("references all four tool names", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en")
    expect(prompt).toContain("extract_eligibility_facts")
    expect(prompt).toContain("check_eligibility")
    expect(prompt).toContain("retrieve_policy")
    expect(prompt).toContain("finish_eligibility_explanation")
  })

  it("requires reflection review before streaming the final eligibility explanation", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en")
    expect(prompt).toMatch(/reflection review/i)
    expect(prompt).toMatch(/finalExplanation exactly/i)
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

  // ── Phase 4: known-facts injection ─────────────────────────────────────────

  it("does NOT include a known-facts section when knownFacts is empty", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en", {})
    expect(prompt).not.toMatch(/already known from this user/i)
  })

  it("injects known age into the system prompt", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en", { age: 42 })
    expect(prompt).toContain("Age: 42")
  })

  it("injects known household size and annual income", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en", { householdSize: 3, annualIncome: 45000 })
    expect(prompt).toContain("Household size: 3")
    expect(prompt).toContain("Annual income: $45,000")
  })

  it("injects citizenship status when known", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en", { citizenshipStatus: "citizen" })
    expect(prompt).toContain("citizen")
  })

  it("instructs the agent NOT to re-ask for known facts", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en", { age: 30 })
    expect(prompt).toMatch(/do not ask.*already listed|not.*re.?ask/i)
  })

  it("works correctly when knownFacts param is omitted (default to no facts section)", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en")
    expect(prompt).not.toMatch(/already known from this user/i)
  })

  // ── Staleness framing ────────────────────────────────────────────────────────

  it("uses the 'do not ask again' framing when facts are fresh", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en", { age: 30 }, false, 5)
    expect(prompt).toMatch(/already known from this user/i)
    expect(prompt).not.toMatch(/may be out of date/i)
  })

  it("switches to a confirm-before-relying framing when facts are stale", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en", { age: 30 }, true, 120)
    expect(prompt).toMatch(/120 days ago/i)
    expect(prompt).toMatch(/may be out of date/i)
    expect(prompt).toMatch(/confirm/i)
  })

  it("does not show staleness framing when there are no facts, even if isStale is true", () => {
    const prompt = buildBenefitAdvisorAgentSystemPrompt("en", {}, true, 120)
    expect(prompt).not.toMatch(/may be out of date/i)
  })
})
