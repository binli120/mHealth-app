/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"
import { buildFormAssistantAgentSystemPrompt } from "@/lib/agents/form-assistant/prompts"

describe("buildFormAssistantAgentSystemPrompt", () => {
  it("mentions the current section in the prompt", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("en", "household", "")
    expect(prompt).toContain("household")
  })

  it("describes the fields for the personal section", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("en", "personal", "")
    expect(prompt).toContain("first name")
    expect(prompt).toContain("last name")
    expect(prompt).toContain("date of birth")
  })

  it("describes the fields for the income section", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("en", "income", "")
    expect(prompt).toContain("income")
  })

  it("includes the collected summary when provided", () => {
    const summary = "firstName: Maria, lastName: Rossi"
    const prompt = buildFormAssistantAgentSystemPrompt("en", "contact", summary)
    expect(prompt).toContain(summary)
  })

  it("shows 'Nothing yet' when no summary provided", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("en", "contact", "")
    expect(prompt).toContain("Nothing yet")
  })

  it("references both tool names", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("en", "personal", "")
    expect(prompt).toContain("extract_form_fields")
    expect(prompt).toContain("retrieve_policy")
  })

  it("instructs the agent to ask ONE field at a time", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("en", "personal", "")
    expect(prompt).toMatch(/ONE field|one field/i)
  })

  it("instructs the agent never to ask for SSN", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("en", "personal", "")
    expect(prompt.toLowerCase()).toContain("ssn")
    expect(prompt.toLowerCase()).toContain("never mention ssn")
  })

  it("uses the correct language label for Portuguese", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("pt-BR", "personal", "")
    expect(prompt).toContain("Portuguese")
  })

  // ── Known-facts injection (read-only memory, filtered to current section) ────

  it("does NOT include a known-facts section when knownFacts is empty or omitted", () => {
    expect(buildFormAssistantAgentSystemPrompt("en", "personal", "")).not.toMatch(/earlier session/i)
    expect(buildFormAssistantAgentSystemPrompt("en", "personal", "", {})).not.toMatch(/earlier session/i)
  })

  it("injects citizenship status only while on the personal section", () => {
    const facts = { citizenshipStatus: "citizen" as const }
    const onSection = buildFormAssistantAgentSystemPrompt("en", "personal", "", facts)
    const offSection = buildFormAssistantAgentSystemPrompt("en", "income", "", facts)
    expect(onSection).toContain("Citizenship status: citizen")
    expect(offSection).not.toMatch(/earlier session/i)
  })

  it("injects household size only while on the household section", () => {
    const facts = { householdSize: 4 }
    const onSection = buildFormAssistantAgentSystemPrompt("en", "household", "", facts)
    const offSection = buildFormAssistantAgentSystemPrompt("en", "personal", "", facts)
    expect(onSection).toContain("Household size: 4")
    expect(offSection).not.toMatch(/earlier session/i)
  })

  it("injects annual income only while on the income section", () => {
    const facts = { annualIncome: 36000 }
    const onSection = buildFormAssistantAgentSystemPrompt("en", "income", "", facts)
    const offSection = buildFormAssistantAgentSystemPrompt("en", "contact", "", facts)
    expect(onSection).toContain("Annual income: $36,000")
    expect(offSection).not.toMatch(/earlier session/i)
  })

  it("does not leak facts irrelevant to any form section (e.g. pregnancy) into the prompt", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("en", "personal", "", { isPregnant: true })
    expect(prompt).not.toMatch(/earlier session/i)
    expect(prompt).not.toMatch(/pregnan/i)
  })

  it("instructs the agent to confirm rather than silently fill known facts", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("en", "income", "", { annualIncome: 36000 })
    expect(prompt.toLowerCase()).toMatch(/confirm/)
    expect(prompt.toLowerCase()).toMatch(/official application/)
  })
})
