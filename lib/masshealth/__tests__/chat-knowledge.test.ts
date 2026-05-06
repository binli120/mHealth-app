/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import {
  getMassHealthGreeting,
  getMassHealthOutOfScopeResponse,
  getFormAssistantGreeting,
  getProfileAwareFormAssistantGreeting,
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

  it("names Compass in the application assistant greeting", () => {
    const greeting = getFormAssistantGreeting("en")
    expect(greeting).toContain("I am Compass")
    expect(greeting).toContain("I will guide you through your MassHealth application")
  })

  it("names Compass in the profile-aware application assistant greeting", () => {
    const greeting = getProfileAwareFormAssistantGreeting({
      firstName: "John",
      hasLastName: true,
      hasDob: true,
      hasPhone: false,
      hasAddress: false,
    }, "en")
    expect(greeting).toContain("Hi John! I am Compass.")
    expect(greeting).toContain("pre-fill")
  })
})
