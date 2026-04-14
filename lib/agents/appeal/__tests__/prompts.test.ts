/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"
import { buildAppealAgentSystemPrompt } from "@/lib/agents/appeal/prompts"
import type { DenialReasonOption } from "@/lib/appeals/types"

const INCOME_DENIAL: DenialReasonOption = {
  id: "income_exceeds_limit",
  label: "Income exceeds eligibility limit",
  description: "The household's reported income was above the threshold for the requested program.",
}

const RESIDENCY_DENIAL: DenialReasonOption = {
  id: "residency_not_verified",
  label: "Residency not verified",
  description: "The applicant could not prove Massachusetts residency with acceptable documents.",
}

describe("buildAppealAgentSystemPrompt", () => {
  it("includes the denial reason label", () => {
    const prompt = buildAppealAgentSystemPrompt(INCOME_DENIAL, "en")
    expect(prompt).toContain("Income exceeds eligibility limit")
  })

  it("includes the denial description", () => {
    const prompt = buildAppealAgentSystemPrompt(INCOME_DENIAL, "en")
    expect(prompt).toContain("above the threshold")
  })

  it("references both tool names", () => {
    const prompt = buildAppealAgentSystemPrompt(INCOME_DENIAL, "en")
    expect(prompt).toContain("retrieve_policy")
    expect(prompt).toContain("finish_appeal")
  })

  it("includes the MassHealth Hearings Unit address", () => {
    const prompt = buildAppealAgentSystemPrompt(INCOME_DENIAL, "en")
    expect(prompt).toContain("Milford, MA")
  })

  it("includes the placeholder instructions for the letter", () => {
    const prompt = buildAppealAgentSystemPrompt(INCOME_DENIAL, "en")
    expect(prompt).toContain("[APPLICANT NAME]")
    expect(prompt).toContain("[CASE NUMBER]")
  })

  it("instructs the agent not to invent regulations", () => {
    const prompt = buildAppealAgentSystemPrompt(INCOME_DENIAL, "en")
    expect(prompt.toLowerCase()).toContain("never invent")
  })

  it("references the fallback regulation when no context found", () => {
    const prompt = buildAppealAgentSystemPrompt(INCOME_DENIAL, "en")
    expect(prompt).toContain("130 CMR")
  })

  it("uses the correct language label for Haitian Creole", () => {
    const prompt = buildAppealAgentSystemPrompt(INCOME_DENIAL, "ht")
    expect(prompt).toContain("Haitian Creole")
  })

  it("reflects the correct denial label for a different denial reason", () => {
    const prompt = buildAppealAgentSystemPrompt(RESIDENCY_DENIAL, "en")
    expect(prompt).toContain("Residency not verified")
    expect(prompt).not.toContain("Income exceeds eligibility limit")
  })
})
