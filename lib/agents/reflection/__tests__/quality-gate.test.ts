/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  outputObject: vi.fn((spec: unknown) => spec),
  getOllamaModel: vi.fn(() => "mock-model"),
}))

vi.mock("ai", () => ({
  generateText: mocks.generateText,
  Output: {
    object: mocks.outputObject,
  },
}))

vi.mock("@/lib/masshealth/ollama-provider", () => ({
  getOllamaModel: mocks.getOllamaModel,
}))

import {
  reviewAppealLetterQuality,
  reviewEligibilityExplanationQuality,
} from "@/lib/agents/reflection/quality-gate"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("reviewAppealLetterQuality", () => {
  it("returns the revised letter when reflection provides one", async () => {
    mocks.generateText.mockResolvedValue({
      output: {
        factuallyAccurate: false,
        clearToLayperson: true,
        hasSpecificEvidence: false,
        issues: ["Missing evidence."],
        revisedLetter: "Reviewed letter",
      },
    })

    const result = await reviewAppealLetterQuality({
      appealLetter: "Draft letter",
      explanation: "Draft explanation",
      evidenceChecklist: ["Pay stubs"],
      policyContext: "Policy context",
    })

    expect(result.finalText).toBe("Reviewed letter")
    expect(result.review).toMatchObject({
      reviewed: true,
      factuallyAccurate: false,
      clearToLayperson: true,
      hasSpecificEvidence: false,
      issues: ["Missing evidence."],
    })
  })

  it("returns the original letter when no revision is needed", async () => {
    mocks.generateText.mockResolvedValue({
      output: {
        factuallyAccurate: true,
        clearToLayperson: true,
        hasSpecificEvidence: true,
        issues: [],
      },
    })

    const result = await reviewAppealLetterQuality({
      appealLetter: "Draft letter",
      explanation: "Draft explanation",
      evidenceChecklist: ["Pay stubs"],
      policyContext: "Policy context",
    })

    expect(result.finalText).toBe("Draft letter")
    expect(result.review.reviewed).toBe(true)
  })

  it("fails open with the original letter when reflection is unavailable", async () => {
    mocks.generateText.mockRejectedValue(new Error("Ollama unavailable"))

    const result = await reviewAppealLetterQuality({
      appealLetter: "Draft letter",
      explanation: "Draft explanation",
      evidenceChecklist: ["Pay stubs"],
      policyContext: "Policy context",
    })

    expect(result.finalText).toBe("Draft letter")
    expect(result.review.reviewed).toBe(false)
    expect(result.review.issues[0]).toMatch(/unavailable/i)
  })
})

describe("reviewEligibilityExplanationQuality", () => {
  it("returns a revised eligibility explanation when reflection provides one", async () => {
    mocks.generateText.mockResolvedValue({
      output: {
        factuallyAccurate: true,
        clearToLayperson: false,
        hasSpecificEvidence: true,
        issues: ["Too much jargon."],
        revisedExplanation: "Reviewed explanation",
      },
    })

    const result = await reviewEligibilityExplanationQuality({
      explanation: "Draft explanation",
      eligibilityContext: "Deterministic result",
      policyContext: "Policy context",
      language: "en",
    })

    expect(result.finalText).toBe("Reviewed explanation")
    expect(result.review).toMatchObject({
      reviewed: true,
      clearToLayperson: false,
      issues: ["Too much jargon."],
    })
  })

  it("passes a structured-output schema to generateText", async () => {
    mocks.generateText.mockResolvedValue({
      output: {
        factuallyAccurate: true,
        clearToLayperson: true,
        hasSpecificEvidence: true,
        issues: [],
      },
    })

    await reviewEligibilityExplanationQuality({
      explanation: "Draft explanation",
      eligibilityContext: "Deterministic result",
      policyContext: "Policy context",
      language: "es",
    })

    expect(mocks.outputObject).toHaveBeenCalledOnce()
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: "mock-model",
      temperature: 0,
      output: expect.anything(),
      prompt: expect.stringContaining("language code: es"),
    }))
  })
})
