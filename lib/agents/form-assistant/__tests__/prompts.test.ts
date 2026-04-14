/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
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
    expect(prompt.toLowerCase()).toContain("never ask for ssn")
  })

  it("uses the correct language label for Portuguese", () => {
    const prompt = buildFormAssistantAgentSystemPrompt("pt-BR", "personal", "")
    expect(prompt).toContain("Portuguese")
  })
})
