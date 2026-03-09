import { describe, expect, it } from "vitest"

import {
  getMassHealthGreeting,
  getMassHealthOutOfScopeResponse,
  MASSHEALTH_COMMON_QUESTIONS,
  MASSHEALTH_OUT_OF_SCOPE_RESPONSE,
  isMassHealthTopic,
} from "@/lib/masshealth/chat-knowledge"

describe("lib/masshealth/chat-knowledge", () => {
  it("provides a non-empty FAQ list", () => {
    expect(MASSHEALTH_COMMON_QUESTIONS.length).toBeGreaterThanOrEqual(8)
    expect(MASSHEALTH_COMMON_QUESTIONS[0]?.question.length).toBeGreaterThan(10)
  })

  it("detects in-scope MassHealth prompts", () => {
    expect(isMassHealthTopic("How do I renew my MassHealth coverage?")).toBe(true)
    expect(isMassHealthTopic("Can I appeal a denied MassHealth decision?")).toBe(true)
    expect(isMassHealthTopic("What documents do I need to apply for coverage?")).toBe(true)
  })

  it("rejects clearly out-of-scope prompts", () => {
    expect(isMassHealthTopic("Who won the game last night?")).toBe(false)
    expect(MASSHEALTH_OUT_OF_SCOPE_RESPONSE).toContain("Sorry")
  })

  it("returns language-aware helper copy", () => {
    expect(getMassHealthGreeting("en")).toContain("MassHealth assistant")
    expect(getMassHealthOutOfScopeResponse("es")).toContain("MassHealth")
  })
})
